#!/usr/bin/env node

/**
 * Rebuild OCR candidates for the beginner-to-intermediate book.
 *
 * The PDF is a scan.  Each dialogue uses two pages: a Japanese source page,
 * followed by a three-column translation page (English / Chinese / Korean).
 * Do not run a mixed-language OCR pass across the whole page: it joins the
 * three columns and mistakes furigana for dialogue text.  This tool crops
 * each language region first, then runs its dedicated OCR model.
 *
 * Examples:
 *   node scripts/reprocess-book-ocr.mjs --section 10 --images ../tmp/pdfs/book-pages --output tmp/ocr-candidates
 *   node scripts/reprocess-book-ocr.mjs --all --images ../tmp/pdfs/book-pages --output tmp/ocr-candidates
 *
 * Generated files are review candidates. They are intentionally kept outside
 * public/transcripts until the confidence report and sentence segmentation
 * agree with the matching audio track.
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { spawn } from "node:child_process";

const sourcePages = [
	24, 26, 28, 30, 32, 34, 36, 38, 40, 42,
	48, 50, 52, 54, 56, 58, 60, 62, 64, 66,
	72, 74, 76, 78, 80, 82, 84, 86, 88, 90,
	98, 100, 102, 104, 106, 108, 110, 112, 114, 116,
	124, 126, 128, 130, 132, 134, 136, 138, 140, 142,
	144, 146, 154, 156, 158, 160,
];

function parseArgs(argv) {
	const result = { all: false, images: "../tmp/pdfs/book-pages", output: "../tmp/pdfs/ocr-candidates", section: [] };
	for (let index = 0; index < argv.length; index += 1) {
		const value = argv[index];
		if (value === "--all") result.all = true;
		else if (value === "--images") result.images = argv[++index] ?? result.images;
		else if (value === "--output") result.output = argv[++index] ?? result.output;
		else if (value === "--section") result.section.push(...(argv[++index] ?? "").split(",").map(Number));
		else if (value === "--help") {
			console.log("Usage: node scripts/reprocess-book-ocr.mjs (--section 10,11 | --all) [--images DIR] [--output DIR]");
			process.exit(0);
		}
	}
	return result;
}

function run(command, args) {
	return new Promise((resolveRun, reject) => {
		const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (chunk) => { stdout += chunk; });
		child.stderr.on("data", (chunk) => { stderr += chunk; });
		child.on("error", reject);
		child.on("close", (code) => {
			if (code === 0) resolveRun(stdout);
			else reject(new Error(`${command} failed (${code}): ${stderr.trim()}`));
		});
	});
}

function pageImage(images, page) {
	return join(images, `page-${String(page).padStart(3, "0")}.jpg`);
}

function cleanText(text, language) {
	return text
		.replace(/\r/g, "")
		.replace(/[ \t]+\n/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.replace(language === "jpn" ? /\s*([、。！？?])/g : /[ \t]+([,.:;!?])/g, "$1")
		.trim() + "\n";
}

function confidence(tsv) {
	const rows = tsv.split("\n").slice(1)
		.map((line) => line.split("\t"))
		.filter((parts) => parts.length >= 12 && parts[11].trim() && Number(parts[10]) >= 0);
	const scores = rows.map((parts) => Number(parts[10]));
	const average = scores.length ? scores.reduce((total, score) => total + score, 0) / scores.length : 0;
	const low = rows.filter((parts) => Number(parts[10]) < 70).map((parts) => parts[11]);
	return { average: Number(average.toFixed(1)), wordCount: scores.length, lowConfidenceTokens: [...new Set(low)].slice(0, 40) };
}

async function crop(source, destination, { height, width, top, left }) {
	await run("sips", ["--cropToHeightWidth", String(height), String(width), "--cropOffset", String(top), String(left), source, "--out", destination]);
}

async function recognize(image, language, psm) {
	const text = await run("tesseract", [image, "stdout", "-l", language, "--psm", String(psm)]);
	const tsv = await run("tesseract", [image, "stdout", "-l", language, "--psm", String(psm), "tsv"]);
	return { text: cleanText(text, language), confidence: confidence(tsv) };
}

async function processSection(section, imageDirectory, outputDirectory) {
	const sourcePage = sourcePages[section - 1];
	if (!sourcePage) throw new Error(`Unknown section: ${section}`);
	const sectionId = String(section).padStart(2, "0");
	const sectionDirectory = join(outputDirectory, sectionId);
	const japaneseImage = pageImage(imageDirectory, sourcePage);
	const translationsImage = pageImage(imageDirectory, sourcePage + 1);
	await mkdir(sectionDirectory, { recursive: true });

	// Source page: keep the main Japanese type but exclude page header/footer.
	// PSM 4 preserves dialogue rows better than a sparse-text pass. A second
	// sparse pass collects furigana candidates for later ruby reconstruction.
	const japaneseCrop = join(sectionDirectory, "jp-source.jpg");
	const rubyCrop = join(sectionDirectory, "jp-furigana.jpg");
	const englishCrop = join(sectionDirectory, "en-source.jpg");
	const chineseCrop = join(sectionDirectory, "zh-source.jpg");
	await Promise.all([
		crop(japaneseImage, japaneseCrop, { height: 2260, width: 1640, top: 130, left: 55 }),
		crop(japaneseImage, rubyCrop, { height: 2260, width: 1640, top: 130, left: 55 }),
		// Translation-page columns: English, Chinese, then Korean (ignored).
		crop(translationsImage, englishCrop, { height: 2200, width: 560, top: 160, left: 150 }),
		crop(translationsImage, chineseCrop, { height: 2200, width: 480, top: 160, left: 720 }),
	]);

	const [jp, ruby, en, zh] = await Promise.all([
		recognize(japaneseCrop, "jpn", 4),
		recognize(rubyCrop, "jpn", 11),
		recognize(englishCrop, "eng", 6),
		recognize(chineseCrop, "chi_sim", 6),
	]);
	await Promise.all([
		writeFile(join(sectionDirectory, "jp.txt"), jp.text),
		writeFile(join(sectionDirectory, "jp-furigana-candidates.txt"), ruby.text),
		writeFile(join(sectionDirectory, "en.txt"), en.text),
		writeFile(join(sectionDirectory, "zh.txt"), zh.text),
		writeFile(join(sectionDirectory, "report.json"), `${JSON.stringify({
			section,
			sourcePages: { japanese: sourcePage, translations: sourcePage + 1 },
			confidence: { japanese: jp.confidence, furiganaCandidates: ruby.confidence, english: en.confidence, chinese: zh.confidence },
			status: "candidate - do not publish without sentence/audio validation",
		}, null, 2)}\n`),
	]);
	await Promise.all([rm(japaneseCrop), rm(rubyCrop), rm(englishCrop), rm(chineseCrop)]);
	return { section, japanese: jp.confidence.average, english: en.confidence.average, chinese: zh.confidence.average };
}

const options = parseArgs(process.argv.slice(2));
const sections = options.all ? sourcePages.map((_, index) => index + 1) : [...new Set(options.section.filter((section) => Number.isInteger(section) && section >= 1 && section <= sourcePages.length))];
if (!sections.length) throw new Error("Choose at least one section with --section, or use --all.");

const imageDirectory = resolve(options.images);
const outputDirectory = resolve(options.output);
await mkdir(outputDirectory, { recursive: true });
const results = [];
for (const section of sections) {
	results.push(await processSection(section, imageDirectory, outputDirectory));
	console.log(`Section ${String(section).padStart(2, "0")} complete`);
}
await writeFile(join(outputDirectory, "summary.json"), `${JSON.stringify({ generatedAt: new Date().toISOString(), source: basename(imageDirectory), results }, null, 2)}\n`);
console.table(results);
