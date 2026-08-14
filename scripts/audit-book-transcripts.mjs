#!/usr/bin/env node

/**
 * Turn raw, page-level OCR output into auditable dialogue candidates.
 *
 * This never writes public/transcripts. It creates normalized candidates and
 * a per-section report so a source-page review happens before publication.
 */

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const input = resolve(process.argv[2] ?? join(root, "tmp/pdfs/vision-candidates"));
const output = resolve(process.argv[3] ?? join(root, "tmp/pdfs/normalized-candidates"));

function isDecorative(line) {
	return !line ||
		/^(?:Unit|section|[0-9①-⑳]+|[ぁ-ゖァ-ヺー・]+|[A-Za-z]|[—–—•·.\-]+)$/.test(line) ||
		/^[^\p{L}\p{N}]+$/u.test(line);
}

function joinContinuation(previous, next, language) {
	if (language === "en") {
		if (previous.endsWith("-")) return `${previous.slice(0, -1)}${next}`;
		return `${previous} ${next}`;
	}
	return `${previous}${next}`;
}

function parseDialogue(raw, language) {
	const lines = [];
	let active = -1;
	for (const sourceLine of raw.split("\n")) {
		const line = sourceLine.trim();
		if (isDecorative(line)) continue;
		const marker = line.match(/^.*([AB])\s*[:：]\s*(.*)$/i);
		if (marker && marker[2].trim()) {
			lines.push(`${marker[1].toUpperCase()}: ${marker[2].trim()}`);
			active = lines.length - 1;
			continue;
		}
		if (active >= 0) lines[active] = joinContinuation(lines[active], line, language);
	}
	return lines.map((line) => line
		.replace(/\s+([,.:;!?])/g, "$1")
		.replace(/\s{2,}/g, " ")
		.trim());
}

async function readText(path) {
	return readFile(path, "utf8");
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const report = [];
for (let section = 1; section <= 56; section += 1) {
	const id = String(section).padStart(2, "0");
	const directory = join(input, id);
	const sectionOutput = join(output, id);
	await mkdir(sectionOutput, { recursive: true });
	const counts = {};
	for (const [candidateName, publicName, language] of [
		["jp", "jp", "jp"], ["zh", "zh", "zh"], ["en", "en", "en"],
	]) {
		const candidate = parseDialogue(await readText(join(directory, `${candidateName}.txt`)), language);
		const published = parseDialogue(await readText(join(root, "public/transcripts", publicName, `${id}.txt`)), language);
		await writeFile(join(sectionOutput, `${language}.txt`), `${candidate.join("\n")}\n`);
		counts[language] = { candidate: candidate.length, published: published.length };
	}
	const matchingCandidateCounts = new Set(Object.values(counts).map((value) => value.candidate)).size === 1;
	report.push({ section, ...counts, matchingCandidateCounts });
}
await writeFile(join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);

const failures = report.filter((item) => !item.matchingCandidateCounts);
console.log(`Normalized ${report.length} sections. ${failures.length} sections have a cross-language turn-count mismatch.`);
if (failures.length) console.table(failures);
