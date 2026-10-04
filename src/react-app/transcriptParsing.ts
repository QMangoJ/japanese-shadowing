// Transcript parsing shared by the app and the audit scripts.

import beginnerData from "./beginnerDialogueGroups.json" with { type: "json" };

/** Number of sentence audio clips (audio/NN-k.mp3) in each beginner section. */
export const beginnerSentenceCounts: readonly number[] = beginnerData.sentenceCounts;

/** For dialogue sections 1-54: how many transcript lines belong to each audio clip. */
const beginnerDialogueGroupSizes: Record<string, number[]> = beginnerData.dialogueGroupSizes;

export const transcriptPlaceholder = "文本待校对";

/**
 * Parse a canonical beginner dialogue transcript: one "A：…" / "B：…" line per
 * spoken turn. Returns null when any line is not a well-formed dialogue line,
 * so OCR noise can never silently add or remove a line and shift the cards.
 */
export function parseDialogueLines(raw: string): string[] | null {
	const lines = raw.split("\n").map((line) => line.trim()).filter(Boolean);
	const parsed: string[] = [];
	for (const line of lines) {
		const match = line.match(/^([AB])[：:]\s*(\S.*)$/);
		if (!match) return null;
		parsed.push(`${match[1]}: ${match[2].trim()}`);
	}
	return parsed;
}

/**
 * Split one language of a beginner dialogue section into per-clip cards using
 * the audio-verified group sizes. Every language uses the same sizes, and a
 * line-count mismatch yields placeholders instead of shifted text.
 */
export function groupBeginnerDialogue(raw: string, sectionIndex: number): string[] {
	const sizes = beginnerDialogueGroupSizes[String(sectionIndex)];
	const sentenceCount = beginnerSentenceCounts[sectionIndex - 1] ?? 0;
	const lines = parseDialogueLines(raw);
	if (!sizes || !lines || sizes.reduce((total, size) => total + size, 0) !== lines.length) {
		return Array.from({ length: sentenceCount }, () => transcriptPlaceholder);
	}
	let offset = 0;
	return sizes.map((size) => {
		const group = lines.slice(offset, offset + size);
		offset += size;
		return group.join("\n");
	});
}


function isOcrNoise(line: string) {
	return !line ||
		/^[ぁ-ゖァ-ヺー・]+$/.test(line) ||
		/^(?:Unit|section|[0-9①-⑳]+|[A-Za-z])$/.test(line);
}

function appendOcrContinuation(lines: string[], continuation: string) {
	const previous = lines[lines.length - 1];
	const text = continuation.trim();
	if (!previous || !text) return;
	if (/^[（(].*[）)]$/.test(previous)) {
		lines.push(text);
		return;
	}
	if (previous.endsWith("-")) {
		lines[lines.length - 1] = `${previous.slice(0, -1)}${text}`;
		return;
	}
	const needsSpace = /[A-Za-z0-9]$/.test(previous) && /^[A-Za-z0-9]/.test(text);
	lines[lines.length - 1] = `${previous}${needsSpace ? " " : ""}${text}`;
}

export function normalizeOcrBlock(raw: string) {
	const normalized: string[] = [];
	for (const untrimmed of raw.split("\n")) {
		const line = untrimmed.trim();
		if (/^[AB]$/i.test(line)) {
			normalized.push(line.toUpperCase());
			continue;
		}
		if (isOcrNoise(line)) continue;
		// In the scanned intermediate book, a colon is sometimes recognized as
		// i / I / | (for example, "Bi わかってる"). Treat those as speaker marks.
		const speaker = line.match(/^.*([AB])\s*(?::|：|[iI|])\s*(.*)$/i);
		if (speaker) {
			const name = speaker[1].toUpperCase();
			const text = speaker[2].trim();
			normalized.push(text ? `${name}: ${text.replace(/太野/g, "大野")}` : name);
			continue;
		}
		// Book headings are semantic paragraph boundaries; all other breaks are
		// scan-layout wraps and should not appear as a new line on the site.
		if (/^[（(].*[）)]$/.test(line)) {
			normalized.push(line);
			continue;
		}
		appendOcrContinuation(normalized, line);
	}
	return normalized.join("\n");
}

export function groupNarratives(raw: string, sectionIndex: number) {
	const headingPatterns = sectionIndex === 55
		? [/^（(?:意見|Stating|意见)/, /^（(?:面接|At an Interview|面试)/]
		: [/^（(?:旅先|What Happened|在旅行)/, /^（(?:映画|Impression|电影)/];
	const lines = raw.split("\n").map((line) => line.trim());
	const starts = headingPatterns.map((pattern) => lines.findIndex((line) => pattern.test(plainJapaneseText(line))));
	if (starts.some((start) => start < 0)) return [transcriptPlaceholder, transcriptPlaceholder];
	return starts.map((start, index) => lines.slice(start, starts[index + 1] ?? lines.length)
		.filter((line) => line && !/^[ぁ-ゖァ-ヺー・]+$/.test(line) && !/^(?:Unit|section|[0-9①-⑳]+)$/.test(line))
		.join("\n"));
}

export function plainJapaneseText(text: string) {
	return text.replace(/\{\{(.+?)\|.*?\}\}/g, "$1");
}
