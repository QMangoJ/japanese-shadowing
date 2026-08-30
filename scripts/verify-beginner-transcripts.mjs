#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const japaneseDir = join(root, "public", "transcripts", "jp");
const rubyDir = join(root, "public", "transcripts", "jp-ruby");
const audioDir = join(root, "public", "audio");

const sentenceCounts = [
	10, 10, 10, 10, 10, 10, 10, 10, 10, 6,
	10, 10, 10, 10, 10, 10, 10, 10, 6, 6,
	10, 10, 10, 10, 10, 10, 10, 6, 5, 5,
	10, 10, 10, 10, 10, 10, 10, 10, 6, 6,
	6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6,
	2, 2, 2, 2,
];

const dialogueGroupSizes = {
	4: [2, 2, 2, 2, 2, 2, 4, 2, 2, 2],
	10: [4, 4, 4, 4, 4, 4],
	19: [4, 4, 4, 4, 4, 4],
	20: [4, 4, 4, 4, 4, 4],
	25: [2, 2, 2, 2, 2, 2, 2, 3, 2, 2],
	28: [4, 4, 4, 4, 4, 4],
	29: [4, 4, 4, 4, 4],
	30: [4, 4, 4, 4, 4],
	39: [4, 4, 4, 4, 4, 4],
	40: [4, 4, 4, 4, 4, 4],
	41: [4, 4, 4, 4, 4, 4],
	42: [4, 4, 4, 4, 4, 4],
	43: [4, 4, 4, 4, 4, 4],
	44: [4, 4, 4, 4, 4, 4],
	45: [4, 4, 4, 4, 4, 4],
	46: [4, 4, 4, 4, 4, 4],
	47: [4, 4, 4, 4, 4, 4],
	48: [4, 4, 4, 4, 4, 4],
	49: [4, 4, 4, 4, 4, 4],
	50: [4, 4, 4, 4, 4, 4],
	51: [4, 4, 4, 4, 4, 4],
	52: [4, 4, 4, 4, 4, 4],
	53: [12, 12],
	54: [8, 10],
};

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
		const sizes = dialogueGroupSizes[section] ?? Array.from({ length: sentenceCounts[section - 1] }, () => 2);
		const expectedLines = sizes.reduce((total, size) => total + size, 0);
		if (lines.length !== expectedLines) fail(`Section ${id}: expected ${expectedLines} dialogue lines, found ${lines.length}`);
		dialogueLineCount += lines.length;
	} else {
		const headings = plain.split("\n").filter((line) => /^（.+）$/.test(line));
		if (headings.length !== 2) fail(`Section ${id}: expected two narrative headings`);
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
