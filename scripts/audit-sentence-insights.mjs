#!/usr/bin/env node
// Fails when any beginner sentence card would show a placeholder, an empty
// 生词 / 语法 section, or a grammar note that does not belong to its text.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");
const appDir = path.join(root, "src", "react-app");

// Transpile the app modules we need into a temp dir so this runs on plain Node.
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "sentence-insights-"));
for (const name of ["sentenceAnalysis", "sentenceNotes", "reviewedVocabulary", "transcriptParsing"]) {
	const source = fs.readFileSync(path.join(appDir, `${name}.ts`), "utf8");
	const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
		.replace(/from "\.\/([A-Za-z]+)"/g, 'from "./$1.mjs"');
	fs.writeFileSync(path.join(outDir, `${name}.mjs`), output);
}
fs.copyFileSync(path.join(appDir, "beginnerDialogueGroups.json"), path.join(outDir, "beginnerDialogueGroups.json"));
const load = (name) => import(pathToFileURL(path.join(outDir, `${name}.mjs`)).href);
const { getSentenceInsight, plainSentenceText, resolveGrammar, sentenceKey } = await load("sentenceAnalysis");
const { grammarPatterns, sentenceNotes } = await load("sentenceNotes");
const { groupBeginnerDialogue, groupNarratives, transcriptPlaceholder } = await load("transcriptParsing");
fs.rmSync(outDir, { recursive: true, force: true });

const genericPhrases = ["基础表达为主", "基础陈述或会话回应", "先结合译文跟读", "重点留意语序", "根据前后文理解", "结合语境理解", "需按句意判断"];
const errors = [];
const fail = (key, message) => errors.push(`${key}: ${message}`);

// The old generic fallback text must not come back into the UI.
const appSource = fs.readFileSync(path.join(appDir, "App.tsx"), "utf8");
for (const phrase of genericPhrases) if (appSource.includes(phrase)) fail("App.tsx", `contains placeholder text 「${phrase}」`);

for (const [key, pattern] of Object.entries(grammarPatterns)) {
	if (!pattern.point || pattern.explanation.length < 8) fail(`pattern ${key}`, "point or explanation is missing/too short");
	if (genericPhrases.some((phrase) => pattern.explanation.includes(phrase))) fail(`pattern ${key}`, "generic explanation");
}

const seen = new Set();
let cards = 0;
for (let section = 3; section <= 56; section += 1) {
	const id = String(section).padStart(2, "0");
	const raw = fs.readFileSync(path.join(root, "public", "transcripts", "jp-ruby", `${id}.txt`), "utf8");
	const texts = section >= 55 ? groupNarratives(raw, section) : groupBeginnerDialogue(raw, section);
	texts.forEach((text, index) => {
		cards += 1;
		const key = sentenceKey(section, index + 1);
		seen.add(key);
		if (text === transcriptPlaceholder) return fail(key, "transcript placeholder");
		const plain = plainSentenceText(text);
		const note = sentenceNotes[key];
		if (!note) return fail(key, "no hand-written notes");
		if (!note.g?.length) fail(key, "no grammar notes");
		const points = new Set();
		for (const ref of note.g ?? []) {
			let grammar;
			try { grammar = resolveGrammar(ref); } catch (error) { fail(key, error.message); continue; }
			if (points.has(grammar.point)) fail(key, `duplicate grammar point ${grammar.point}`);
			points.add(grammar.point);
			if (!grammar.explanation || grammar.explanation.length < 6) fail(key, `grammar 「${grammar.point}」 has no real explanation`);
			if (genericPhrases.some((phrase) => grammar.explanation.includes(phrase))) fail(key, `grammar 「${grammar.point}」 is generic`);
			if (grammar.literal !== undefined) {
				if (!grammar.literal || !plain.includes(grammar.literal)) fail(key, `grammar 「${grammar.point}」 cites 「${grammar.literal}」, which is not in the sentence`);
			} else {
				const pattern = grammarPatterns[grammar.pattern];
				if (pattern.test.source === ".") fail(key, `grammar 「${grammar.point}」 must cite the words it explains (use "${grammar.pattern}@…")`);
				else if (!pattern.test.test(plain)) fail(key, `grammar 「${grammar.point}」 does not occur in the sentence`);
			}
		}
		for (const word of note.v ?? []) {
			if (!word.meaning || !word.detail || word.detail.length < 6) fail(key, `word ${word.term} has no real explanation`);
			if (![word.term, ...(word.aliases ?? [])].some((form) => plain.includes(form))) fail(key, `word ${word.term} is not in the sentence`);
		}
		const insight = getSentenceInsight(section, index + 1, text);
		if (!insight?.vocabulary.length) fail(key, "生词 would be empty");
		if (!insight?.grammar.length) fail(key, "语法 would be empty");
	});
}
for (const key of Object.keys(sentenceNotes)) if (!seen.has(key)) fail(key, "notes for a card that does not exist (alignment drift?)");

// Known mismatches that must stay fixed: [card, word that must not be shown].
const forbidden = [["6-5", "丈夫"], ["25-8", "丈夫"], ["30-5", "申し上げる"], ["33-7", "申し上げる"], ["16-8", "会う"], ["27-5", "つい"], ["27-5", "だし"], ["45-5", "ポイントがたまる"], ["46-5", "ラッシュ"], ["10-5", "パス"], ["9-5", "日"], ["34-9", "気をつける"], ["51-6", "軽く"]];
for (const [key, term] of forbidden) {
	const [section, sentence] = key.split("-").map(Number);
	const raw = fs.readFileSync(path.join(root, "public", "transcripts", "jp-ruby", `${String(section).padStart(2, "0")}.txt`), "utf8");
	const text = (section >= 55 ? groupNarratives(raw, section) : groupBeginnerDialogue(raw, section))[sentence - 1];
	if (getSentenceInsight(section, sentence, text)?.vocabulary.some((word) => word.term === term)) fail(key, `shows mismatched word ${term}`);
}

// Regression: Section 25 · 第6句 used to show only the generic placeholders.
{
	const raw = fs.readFileSync(path.join(root, "public", "transcripts", "jp-ruby", "25.txt"), "utf8");
	const insight = getSentenceInsight(25, 6, groupBeginnerDialogue(raw, 25)[5]);
	const points = insight.grammar.map((item) => item.point).join(" ");
	const words = insight.vocabulary.map((item) => item.term);
	if (!points.includes("〜てた") || !points.includes("でしょう") || !points.includes("実はね") || !words.includes("彼氏")) fail("25-6", "regression: missing 〜てた／でしょう／実はね／彼氏");
}

if (errors.length) {
	console.error(`Sentence insight audit failed (${errors.length}):\n${errors.join("\n")}`);
	process.exit(1);
}
console.log(`Checked ${cards} beginner sentence cards: every card has real 生词 and 语法 notes that match its text.`);
