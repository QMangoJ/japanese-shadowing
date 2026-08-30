import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const projectRoot = path.resolve(import.meta.dirname, "..");
const vocabularyPath = path.join(projectRoot, "src/react-app/reviewedVocabulary.ts");
const source = fs.readFileSync(vocabularyPath, "utf8");
const javascript = ts.transpileModule(source, {
	compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`;
const { reviewedVocabulary } = await import(moduleUrl);

const duplicateTerms = reviewedVocabulary
	.map((entry) => entry.term)
	.filter((term, index, terms) => terms.indexOf(term) !== index);
if (duplicateTerms.length > 0) {
	throw new Error(`重复词条: ${[...new Set(duplicateTerms)].join("、")}`);
}

for (const entry of reviewedVocabulary) {
	if (!entry.term || !entry.meaning || !entry.detail) throw new Error(`词条字段不完整: ${JSON.stringify(entry)}`);
}
const briefEntries = reviewedVocabulary.filter((entry) => entry.detail.length < 10).map((entry) => entry.term);
if (briefEntries.length > 0) throw new Error(`释义说明过短: ${briefEntries.join("、")}`);

const transcriptRoot = path.join(projectRoot, "public/transcripts/jp-ruby");
const coverage = [];
for (let section = 11; section <= 56; section += 1) {
	const file = path.join(transcriptRoot, `${String(section).padStart(2, "0")}.txt`);
	const text = fs.readFileSync(file, "utf8")
		.replace(/\{\{(.+?)\|.*?\}\}/g, "$1")
		.replace(/\s+/g, "");
	const matches = reviewedVocabulary.filter((entry) => [entry.term, ...(entry.aliases ?? [])].some((form) => text.includes(form)));
	if (matches.length === 0) throw new Error(`Section ${section} 没有匹配到已复核词条`);
	coverage.push(`Section ${section}: ${matches.length}`);
}

const required = reviewedVocabulary.find((entry) => entry.term === "ぼったくり");
if (!required || !required.meaning.includes("宰客") || !required.detail.includes("ぼったくる")) {
	throw new Error("ぼったくり的释义或用法说明不完整");
}

console.log(`已检查 ${reviewedVocabulary.length} 个 N4+／口语词条。`);
console.log(coverage.join("\n"));
