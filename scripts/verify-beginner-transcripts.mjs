#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const japaneseDir = join(root, "public", "transcripts", "jp");
const rubyDir = join(root, "public", "transcripts", "jp-ruby");
const audioDir = join(root, "public", "audio");

const zhDir = join(root, "public", "transcripts", "zh");
const enDir = join(root, "public", "transcripts", "en");

// Single source of truth shared with the app (src/react-app/transcriptParsing.ts).
const { sentenceCounts, dialogueGroupSizes } = JSON.parse(
	readFileSync(join(root, "src", "react-app", "beginnerDialogueGroups.json"), "utf8"),
);

function stripRuby(text) {
	return text.replace(/\{\{([^|{}]+)\|[^{}]+\}\}/g, "$1");
}

function fail(message) {
	throw new Error(message);
}

let audioCount = 0;
let dialogueLineCount = 0;
for (let section = 1; section <= sentenceCounts.length; section += 1) {
	const id = String(section).padStart(2, "0");
	const plainPath = join(japaneseDir, `${id}.txt`);
	const rubyPath = join(rubyDir, `${id}.txt`);
	if (!existsSync(plainPath) || !existsSync(rubyPath)) fail(`Section ${id}: transcript file missing`);

	const plain = readFileSync(plainPath, "utf8");
	const ruby = readFileSync(rubyPath, "utf8");
	if (stripRuby(ruby) !== plain) fail(`Section ${id}: ruby surface text differs from canonical Japanese`);
	if (/文本待校对|[●■◆◇]|(?:^|\n)Unit\b|(?:^|\n)section\b/i.test(plain)) {
		fail(`Section ${id}: placeholder or OCR layout noise remains`);
	}

	if (section <= 54) {
		const lines = plain.trim().split("\n");
		if (lines.some((line) => !/^[AB]：\S/.test(line))) fail(`Section ${id}: malformed dialogue line`);
		const sizes = dialogueGroupSizes[String(section)];
		if (!sizes || sizes.length !== sentenceCounts[section - 1]) fail(`Section ${id}: group sizes do not match the audio clip count`);
		const expectedLines = sizes.reduce((total, size) => total + size, 0);
		if (lines.length !== expectedLines) fail(`Section ${id}: expected ${expectedLines} dialogue lines, found ${lines.length}`);
		const speakers = lines.map((line) => line[0]).join("");
		// Translations are split into cards with the same group sizes, so they
		// must have exactly one line per Japanese line, with the same speaker.
		for (const [language, dir] of [["zh", zhDir], ["en", enDir]]) {
			const translated = readFileSync(join(dir, `${id}.txt`), "utf8").trim().split("\n");
			if (translated.some((line) => !/^[AB]：\S/.test(line))) fail(`Section ${id}: malformed ${language} dialogue line`);
			if (translated.length !== lines.length) fail(`Section ${id}: ${language} has ${translated.length} lines, Japanese has ${lines.length}`);
			if (translated.map((line) => line[0]).join("") !== speakers) fail(`Section ${id}: ${language} speaker order differs from Japanese`);
		}
		dialogueLineCount += lines.length;
	} else {
		const headings = plain.split("\n").filter((line) => /^（.+）$/.test(line));
		if (headings.length !== 2) fail(`Section ${id}: expected two narrative headings`);
		for (const [language, dir] of [["zh", zhDir], ["en", enDir]]) {
			const translated = readFileSync(join(dir, `${id}.txt`), "utf8");
			if (translated.split("\n").filter((line) => /^（.+）$/.test(line)).length !== 2) fail(`Section ${id}: expected two ${language} narrative headings`);
		}
	}

	for (let sentence = 1; sentence <= sentenceCounts[section - 1]; sentence += 1) {
		const audio = join(audioDir, `${id}-${sentence}.mp3`);
		if (!existsSync(audio)) fail(`Section ${id}: missing audio ${id}-${sentence}.mp3`);
		audioCount += 1;
	}
}

const section24 = readFileSync(join(japaneseDir, "24.txt"), "utf8").trim().split("\n");
const expectedSection24Sentence10 = [
	"A：ちょっと会わないうちに、ずいぶん日本語が上手になったね。",
	"B：またまた～。でも、ありがとう。",
];
if (section24.slice(-2).join("\n") !== expectedSection24Sentence10.join("\n")) {
	fail("Section 24 sentence 10 regression: text does not match the PDF-reviewed source");
}

console.log(`Verified 56 beginner sections, ${dialogueLineCount} dialogue lines, and ${audioCount} sentence audio files.`);
