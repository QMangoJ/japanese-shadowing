import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

type PracticeItem = {
	index: number;
	label: string;
	audio: string;
	hasBookText: boolean;
	sentenceCount: number;
};

type Unit = { number: number; start: number; end: number };
type Transcript = { jp: string[]; zh: string[]; en: string[] };
type CourseId = "beginner" | "intermediate";
type Course = { title: string; units: Unit[]; lessons: PracticeItem[]; trackAudio: boolean };
type SavedProgress = { courseId: CourseId; currentIndex: number; currentSentence: number; currentTime: number };
type FavoritePosition = { left: number; top: number; placement: "above" | "below" };
type Favorite = {
	id: string;
	text: string;
	courseId: CourseId;
	courseTitle: string;
	lesson: string;
	sentence: number;
	translation: string;
	createdAt: string;
};

const beginnerUnits: Unit[] = [
	{ number: 1, start: 1, end: 10 },
	{ number: 2, start: 11, end: 20 },
	{ number: 3, start: 21, end: 30 },
	{ number: 4, start: 31, end: 40 },
	{ number: 5, start: 41, end: 52 },
	{ number: 6, start: 53, end: 56 },
];

const sentenceCounts = [
	...Array(9).fill(10), 6,
	...Array(8).fill(10), 6, 6,
	...Array(7).fill(10), 6, 5, 5,
	...Array(8).fill(10), 6, 6,
	...Array(12).fill(6),
	...Array(4).fill(2),
];

const beginnerLessons: PracticeItem[] = Array.from({ length: 56 }, (_, position) => {
	const index = position + 1;
	const padded = String(index).padStart(2, "0");
	return {
		index,
		label: `Section ${padded}`,
		audio: `/audio/${padded}-1.mp3`,
		hasBookText: true,
		sentenceCount: sentenceCounts[position],
	};
});

const intermediateUnits: Unit[] = [
	{ number: 1, start: 1, end: 8 }, { number: 2, start: 9, end: 17 },
	{ number: 3, start: 18, end: 26 }, { number: 4, start: 27, end: 38 },
	{ number: 5, start: 39, end: 47 }, { number: 6, start: 48, end: 56 },
	{ number: 7, start: 57, end: 64 }, { number: 8, start: 65, end: 74 },
];

function intermediateSection(index: number) {
	const ranges = [7, 15, 25, 37, 46, 54, 63];
	if (index >= 65) return "上级";
	return ranges.some((end) => index <= end) ? "Section 1 · 中级" : "Section 2 · 上级";
}

const intermediateLessons: PracticeItem[] = Array.from({ length: 74 }, (_, position) => {
	const index = position + 1;
	return { index, label: `Track ${String(index).padStart(2, "0")}`, audio: `/audio-intermediate/${String(index).padStart(2, "0")}.mp3`, hasBookText: true, sentenceCount: 1 };
});

const courses: Record<CourseId, Course> = {
	beginner: { title: "初～中级编", units: beginnerUnits, lessons: beginnerLessons, trackAudio: false },
	intermediate: { title: "中～上级编", units: intermediateUnits, lessons: intermediateLessons, trackAudio: true },
};

const progressStorageKey = "kagekoe-shadowing-progress";
const favoritesStorageKey = "kagekoe-shadowing-favorites";

function readSavedProgress(): SavedProgress {
	const fallback: SavedProgress = { courseId: "beginner", currentIndex: 0, currentSentence: 1, currentTime: 0 };
	if (typeof window === "undefined") return fallback;
	try {
		const saved = JSON.parse(window.localStorage.getItem(progressStorageKey) ?? "{}") as Partial<SavedProgress>;
		if (saved.courseId !== "beginner" && saved.courseId !== "intermediate") return fallback;
		const lessons = courses[saved.courseId].lessons;
		const currentIndex = Number.isInteger(saved.currentIndex) ? Math.max(0, Math.min(saved.currentIndex!, lessons.length - 1)) : 0;
		const sentenceCount = lessons[currentIndex].sentenceCount;
		const currentSentence = Number.isInteger(saved.currentSentence) ? Math.max(1, Math.min(saved.currentSentence!, sentenceCount)) : 1;
		const currentTime = Number.isFinite(saved.currentTime) ? Math.max(0, saved.currentTime!) : 0;
		return { courseId: saved.courseId, currentIndex, currentSentence, currentTime };
	} catch {
		return fallback;
	}
}

function readFavorites(): Favorite[] {
	if (typeof window === "undefined") return [];
	try {
		const saved = JSON.parse(window.localStorage.getItem(favoritesStorageKey) ?? "[]") as unknown;
		if (!Array.isArray(saved)) return [];
		return saved.filter((item): item is Favorite => Boolean(
			item && typeof item === "object" &&
			typeof (item as Favorite).id === "string" &&
			typeof (item as Favorite).text === "string" &&
			((item as Favorite).courseId === "beginner" || (item as Favorite).courseId === "intermediate"),
		));
	} catch {
		return [];
	}
}

const speeds = [0.75, 1, 1.25, 1.5];

const dialogueLineCounts: Record<number, number[]> = {
	4: [2, 2, 2, 2, 2, 2, 4, 2, 2, 2],
	10: [4, 4, 4, 4, 4, 4],
	19: [4, 4, 4, 4, 4, 4],
	25: [2, 2, 2, 2, 2, 2, 2, 3, 2, 2],
	40: [4, 4, 4, 4, 4, 5],
	43: [4, 4, 4, 4, 4, 4],
	45: [4, 4, 4, 4, 4, 5],
	47: [4, 4, 4, 4, 4, 4],
};

function formatTime(seconds: number) {
	if (!Number.isFinite(seconds)) return "0:00";
	const minutes = Math.floor(seconds / 60);
	const remaining = Math.floor(seconds % 60).toString().padStart(2, "0");
	return `${minutes}:${remaining}`;
}

function extractSpokenLines(raw: string, attachReadings = false) {
	const spoken: string[] = [];
	let pendingSpeaker: string | null = null;
	for (const untrimmed of raw.split("\n")) {
		const line = untrimmed.trim();
		const match = line.match(/([AB])\s*[:：]\s*(.*)$/i);
		if (match) {
			const text = match[2].trim();
			if (text) {
				pendingSpeaker = null;
				spoken.push(`${match[1].toUpperCase()}: ${text.replace(/太野/g, "大野")}`);
			}
			else pendingSpeaker = match[1].toUpperCase();
			continue;
		}
		if (/^[AB]$/i.test(line)) {
			pendingSpeaker = line.toUpperCase();
			continue;
		}
		if (pendingSpeaker && line) {
			spoken.push(`${pendingSpeaker}: ${line.replace(/太野/g, "大野")}`);
			pendingSpeaker = null;
			continue;
		}
		const missingA = line.match(/^[:：]\s*(.+)$/);
		const malformedB = line.match(/^(?:[2２]日|日)\s*[:：]\s*(.+)$/);
		if ((malformedB && spoken.length > 0) || (missingA && (spoken.length > 0 || /[ぁ-んァ-ン一-龯]/.test(missingA[1])))) {
			spoken.push(`${missingA ? "A" : "B"}: ${(missingA?.[1] ?? malformedB?.[1] ?? "").trim().replace(/太野/g, "大野")}`);
			continue;
		}
		if (attachReadings && spoken.length > 0 && /^[ぁ-ゖァ-ヺー・]+$/.test(line)) {
			spoken[spoken.length - 1] += `（${line}）`;
			continue;
		}
		if (spoken.length > 0 && line && !/^(?:Unit|section|[0-9①-⑳]+|[（(].*[）)])$/.test(line)) {
			spoken[spoken.length - 1] += `\n${line}`;
		}
	}
	return spoken;
}

function groupSentences(lines: string[], sentenceCount: number, sectionIndex: number) {
	const override = dialogueLineCounts[sectionIndex];
	const baseSize = Math.floor(lines.length / sentenceCount);
	const remainder = lines.length % sentenceCount;
	const groupSizes = override?.reduce((total, size) => total + size, 0) === lines.length ? override : (baseSize > 0
		? Array.from({ length: sentenceCount }, (_, index) => baseSize + (index < remainder ? 1 : 0))
		: null);
	if (!groupSizes || groupSizes.reduce((total, size) => total + size, 0) !== lines.length) {
		return Array.from({ length: sentenceCount }, () => "文本待校对");
	}
	let offset = 0;
	return groupSizes.map((size) => {
		const dialogue = lines.slice(offset, offset + size);
		offset += size;
		return dialogue.length > 0 ? dialogue.join("\n") : "文本待校对";
	});
}

function groupNarratives(raw: string, sectionIndex: number) {
	const headingPatterns = sectionIndex === 55
		? [/^（(?:意見|Stating|意见)/, /^（(?:面接|At an Interview|面试)/]
		: [/^（(?:旅先|What Happened|在旅行)/, /^（(?:映画|Impression|电影)/];
	const lines = raw.split("\n").map((line) => line.trim());
	const starts = headingPatterns.map((pattern) => lines.findIndex((line) => pattern.test(line)));
	if (starts.some((start) => start < 0)) return ["文本待校对", "文本待校对"];
	return starts.map((start, index) => lines.slice(start, starts[index + 1] ?? lines.length)
		.filter((line) => line && !/^[ぁ-ゖァ-ヺー・]+$/.test(line) && !/^(?:Unit|section|[0-9①-⑳]+)$/.test(line))
		.join("\n"));
}

function FuriganaText({ text }: { text: string }) {
	return <>{text.split("\n").map((line, lineIndex) => {
		const parts = line.split(/(\{\{.*?\|.*?\}\})/g);
		return <span key={`${line}-${lineIndex}`} className="japanese-line">
			{parts.map((part, partIndex) => {
				const match = part.match(/^\{\{(.+?)\|(.+?)\}\}$/);
				return match
					? <ruby key={`${part}-${partIndex}`}>{match[1]}<rt>{match[2]}</rt></ruby>
					: part;
			})}
		</span>;
	})}</>;
}

function FloatingFavoriteAction({ selectedText, notice, position, onSave }: { selectedText: string; notice: string; position: FavoritePosition | null; onSave: () => void }) {
	if ((!selectedText && !notice) || !position) return null;
	return <div className={`floating-favorite-action ${position.placement}`} style={{ left: position.left, top: position.top }} aria-live="polite">
		{selectedText ? <><span>收藏所选内容</span><button type="button" onClick={onSave}>收藏</button></> : <span>{notice}</span>}
	</div>;
}

function App() {
	const audioRef = useRef<HTMLAudioElement>(null);
	const pendingSeekRef = useRef<number | null>(null);
	const [initialProgress] = useState(readSavedProgress);
	const resumeRef = useRef<SavedProgress | null>(initialProgress.currentTime > 0 ? initialProgress : null);
	const [courseId, setCourseId] = useState<CourseId>(initialProgress.courseId);
	const [currentIndex, setCurrentIndex] = useState(initialProgress.currentIndex);
	const [currentSentence, setCurrentSentence] = useState(initialProgress.currentSentence);
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [speed, setSpeed] = useState(1);
	const [loop, setLoop] = useState(false);
	const [translation, setTranslation] = useState<"zh" | "en">("zh");
	const playAfterChangeRef = useRef(false);
	const [playRequest, setPlayRequest] = useState(0);
	const [selectedUnit, setSelectedUnit] = useState(() => courses[initialProgress.courseId].units.find((item) => initialProgress.currentIndex + 1 >= item.start && initialProgress.currentIndex + 1 <= item.end)?.number ?? 1);
	const [query, setQuery] = useState("");
	const [transcript, setTranscript] = useState<Transcript | null>(null);
	const [screen, setScreen] = useState<"practice" | "guide" | "favorites">("practice");
	const [showTranscript, setShowTranscript] = useState(false);
	const [favorites, setFavorites] = useState<Favorite[]>(readFavorites);
	const [selectedText, setSelectedText] = useState("");
	const [selectedSentence, setSelectedSentence] = useState(initialProgress.currentSentence);
	const [favoriteNotice, setFavoriteNotice] = useState("");
	const [favoritePosition, setFavoritePosition] = useState<FavoritePosition | null>(null);

	const course = courses[courseId];
	const lessons = course.lessons;
	const units = course.units;
	const current = lessons[currentIndex];
	const audioSource = course.trackAudio
		? `/audio-intermediate/${String(current.index).padStart(2, "0")}.mp3`
		: `/audio/${String(current.index).padStart(2, "0")}-${currentSentence}.mp3`;
	const unit = units.find((item) => item.number === selectedUnit) ?? units[0];
	const nowPlayingText = transcript?.jp[currentSentence - 1] ?? "正在加载当前文案…";
	const nowPlayingTranslation = transcript ? (translation === "zh" ? transcript.zh[currentSentence - 1] : transcript.en[currentSentence - 1]) : "";
	const filteredLessons = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();
		return lessons.filter((lesson) => {
			const matchesUnit = lesson.index >= unit.start && lesson.index <= unit.end;
			const matchesQuery =
				normalizedQuery.length === 0 ||
				lesson.label.toLowerCase().includes(normalizedQuery) ||
				String(lesson.index).includes(normalizedQuery);
			return matchesUnit && matchesQuery;
		});
	}, [lessons, query, unit]);

	useEffect(() => {
		const audio = audioRef.current;
		if (!audio) return;
		audio.playbackRate = speed;
	}, [speed]);

	useEffect(() => {
		const audio = audioRef.current;
		if (!audio) return;
		if (!playAfterChangeRef.current) return;
		playAfterChangeRef.current = false;
		void audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
	}, [courseId, currentIndex, currentSentence, playRequest]);

	useEffect(() => {
		if (resumeRef.current) return;
		window.localStorage.setItem(progressStorageKey, JSON.stringify({ courseId, currentIndex, currentSentence, currentTime }));
	}, [courseId, currentIndex, currentSentence, currentTime]);

	useEffect(() => {
		window.localStorage.setItem(favoritesStorageKey, JSON.stringify(favorites));
	}, [favorites]);

	useEffect(() => {
		const onSelectionChange = () => {
			const selection = window.getSelection();
			if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
				return;
			}
			const anchor = selection.anchorNode;
			const element = anchor instanceof Element ? anchor : anchor?.parentElement;
			const transcriptElement = element?.closest<HTMLElement>(".selectable-transcript");
			if (!transcriptElement) {
				return;
			}
			const fragment = selection.getRangeAt(0).cloneContents();
			fragment.querySelectorAll("rt, rp").forEach((reading) => reading.remove());
			const text = (fragment.textContent ?? selection.toString()).replace(/\s+/g, " ").trim();
			if (!text) return;
			const range = selection.getRangeAt(0);
			const rects = range.getClientRects();
			const rect = rects.length > 0 ? rects[rects.length - 1] : range.getBoundingClientRect();
			if (rect.width === 0 && rect.height === 0) return;
			const placement = rect.top > 58 ? "above" : "below";
			setFavoritePosition({
				left: Math.max(84, Math.min(rect.left + rect.width / 2, window.innerWidth - 84)),
				top: placement === "above" ? rect.top - 8 : rect.bottom + 8,
				placement,
			});
			setSelectedText(text);
			const sentence = Number(transcriptElement.closest<HTMLElement>("[data-sentence]")?.dataset.sentence);
			setSelectedSentence(Number.isInteger(sentence) && sentence > 0 ? sentence : currentSentence);
		};
		document.addEventListener("selectionchange", onSelectionChange);
		return () => document.removeEventListener("selectionchange", onSelectionChange);
	}, [currentSentence]);

	useEffect(() => {
		if (!favoriteNotice) return;
		const timeout = window.setTimeout(() => {
			setFavoriteNotice("");
			setFavoritePosition(null);
		}, 2200);
		return () => window.clearTimeout(timeout);
	}, [favoriteNotice]);

	useEffect(() => {
		let disposed = false;
		const id = String(current.index).padStart(2, "0");
		const folder = course.trackAudio ? "intermediate" : "";
		const languagePaths = course.trackAudio
			? ["jp-ruby", "zh", "en"].map((language) => `/transcripts/${folder}/${language}/${id}.txt`)
			: ["jp-ruby", "zh", "en"].map((language) => `/transcripts/${language}/${id}.txt`);
		void Promise.all(languagePaths.map((source) => fetch(source).then((response) => response.text())))
			.then(([jp, zh, en]) => {
				if (disposed) return;
				const japaneseLines = extractSpokenLines(jp, true);
				const chineseLines = extractSpokenLines(zh);
				const englishLines = extractSpokenLines(en);
				const isNarrative = !course.trackAudio && current.index >= 55;
				setTranscript({
					jp: course.trackAudio ? [jp] : isNarrative ? groupNarratives(jp, current.index) : groupSentences(japaneseLines, current.sentenceCount, current.index),
					zh: course.trackAudio ? [zh] : isNarrative ? groupNarratives(zh, current.index) : groupSentences(chineseLines, current.sentenceCount, current.index),
					en: course.trackAudio ? [en] : isNarrative ? groupNarratives(en, current.index) : groupSentences(englishLines, current.sentenceCount, current.index),
				});
			})
			.catch(() => { if (!disposed) setTranscript(null); });
		return () => { disposed = true; };
	}, [course.trackAudio, current.index, current.sentenceCount]);

	useEffect(() => {
		if (!transcript) return;
		const frame = window.requestAnimationFrame(() => {
			document.querySelectorAll<HTMLElement>(".transcript-row.active").forEach((row) => {
				row.scrollIntoView({ behavior: "smooth", block: "nearest" });
			});
		});
		return () => window.cancelAnimationFrame(frame);
	}, [courseId, currentIndex, currentSentence, showTranscript, transcript]);

	async function startPlayback() {
		const audio = audioRef.current;
		if (!audio) return;
		try {
			await audio.play();
			setIsPlaying(true);
		} catch {
			setIsPlaying(false);
		}
	}

	async function togglePlayback() {
		const audio = audioRef.current;
		if (!audio) return;
		if (audio.paused) {
			await startPlayback();
		} else {
			audio.pause();
			setIsPlaying(false);
		}
	}

	function requestPlayback() {
		playAfterChangeRef.current = true;
		setPlayRequest((request) => request + 1);
	}

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape" && showTranscript) {
				setShowTranscript(false);
				return;
			}
			if (event.code === "Space" && !(event.target instanceof HTMLInputElement)) {
				event.preventDefault();
				void togglePlayback();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	});

	function clearTextSelection() {
		window.getSelection()?.removeAllRanges();
		setSelectedText("");
		setFavoriteNotice("");
		setFavoritePosition(null);
	}

	function seekTo(value: number) {
		const audio = audioRef.current;
		if (!audio || !Number.isFinite(value)) return;
		const maximum = duration || (Number.isFinite(audio.duration) ? audio.duration : 0);
		const nextTime = Math.max(0, Math.min(value, maximum || value));
		pendingSeekRef.current = nextTime;
		setCurrentTime(nextTime);
		resumeRef.current = null;
		if (audio.readyState >= HTMLMediaElement.HAVE_METADATA && Number.isFinite(audio.duration)) {
			audio.currentTime = nextTime;
			pendingSeekRef.current = null;
		}
	}

	function seekFromPointer(event: React.PointerEvent<HTMLInputElement>) {
		if (duration <= 0) return;
		const track = event.currentTarget.getBoundingClientRect();
		if (track.width <= 0) return;
		const progress = Math.max(0, Math.min(1, (event.clientX - track.left) / track.width));
		seekTo(progress * duration);
	}

	function saveSelectedText() {
		const text = selectedText.trim();
		if (!text) return;
		const sentence = Math.min(Math.max(selectedSentence, 1), current.sentenceCount);
		const id = `${courseId}-${current.index}-${sentence}-${text}`;
		const alreadySaved = favorites.some((favorite) => favorite.id === id);
		if (!alreadySaved) {
			setFavorites((items) => [{
				id,
				text,
				courseId,
				courseTitle: course.title,
				lesson: current.label,
				sentence,
				translation: transcript ? (translation === "zh" ? transcript.zh[sentence - 1] : transcript.en[sentence - 1]) : "",
				createdAt: new Date().toISOString(),
			}, ...items]);
		}
		setFavoriteNotice(alreadySaved ? "这段文字已在收藏中" : "已添加到收藏");
		window.getSelection()?.removeAllRanges();
		setSelectedText("");
	}

	function selectLesson(index: number) {
		clearTextSelection();
		resumeRef.current = null;
		setCurrentTime(0);
		setDuration(0);
		setTranscript(null);
		setCurrentIndex(index);
		setCurrentSentence(1);
		const parentUnit = units.find((item) => index + 1 >= item.start && index + 1 <= item.end);
		if (parentUnit) setSelectedUnit(parentUnit.number);
		requestPlayback();
		setShowTranscript(false);
	}

	function selectCourse(nextCourse: CourseId) {
		clearTextSelection();
		resumeRef.current = null;
		setCurrentTime(0);
		setDuration(0);
		setTranscript(null);
		audioRef.current?.pause();
		setCourseId(nextCourse);
		setCurrentIndex(0);
		setCurrentSentence(1);
		setSelectedUnit(1);
		setQuery("");
		setIsPlaying(false);
		setShowTranscript(false);
	}

	function playSentence(sentence: number) {
		clearTextSelection();
		resumeRef.current = null;
		setCurrentTime(0);
		setDuration(0);
		setCurrentSentence(sentence);
		requestPlayback();
	}

	function toggleSentencePlayback(sentence: number) {
		if (sentence === currentSentence) {
			void togglePlayback();
			return;
		}
		playSentence(sentence);
	}

	function moveSentence(direction: -1 | 1) {
		resumeRef.current = null;
		if (direction === -1 && currentSentence > 1) {
			playSentence(currentSentence - 1);
			return;
		}
		if (direction === 1 && currentSentence < current.sentenceCount) {
			playSentence(currentSentence + 1);
			return;
		}

		const nextIndex = (currentIndex + direction + lessons.length) % lessons.length;
		const nextLesson = lessons[nextIndex];
		const nextSentence = direction === -1 ? nextLesson.sentenceCount : 1;
		setCurrentIndex(nextIndex);
		setCurrentSentence(nextSentence);
		setCurrentTime(0);
		setDuration(0);
		setTranscript(null);
		requestPlayback();
		const parentUnit = units.find((item) => nextLesson.index >= item.start && nextLesson.index <= item.end);
		if (parentUnit) setSelectedUnit(parentUnit.number);
	}

	function handleLoadedMetadata(event: React.SyntheticEvent<HTMLAudioElement>) {
		const audio = event.currentTarget;
		setDuration(audio.duration);
		const pendingSeek = pendingSeekRef.current;
		if (pendingSeek !== null) {
			const nextTime = Math.min(pendingSeek, Math.max(0, audio.duration - .1));
			audio.currentTime = nextTime;
			setCurrentTime(nextTime);
			pendingSeekRef.current = null;
			return;
		}
		const saved = resumeRef.current;
		if (!saved || saved.courseId !== courseId || saved.currentIndex !== currentIndex || saved.currentSentence !== currentSentence) return;
		const resumeTime = Math.min(saved.currentTime, Math.max(0, audio.duration - .1));
		audio.currentTime = resumeTime;
		setCurrentTime(resumeTime);
		resumeRef.current = null;
	}

	function handleEnded() {
		if (loop) return;
		if (currentSentence < current.sentenceCount) {
			setCurrentSentence((sentence) => sentence + 1);
			setCurrentTime(0);
			setDuration(0);
			requestPlayback();
			return;
		}
		setIsPlaying(false);
	}

	return (
		<div className="app-shell">
			<a className="skip-link" href="#practice-list">跳到练习列表</a>
			<header className="topbar">
				<button className="brand" onClick={() => setScreen("practice")} aria-label="日本語Shadowing 首页">
					<span className="brand-mark">日</span>
					<span>日本語Shadowing</span>
				</button>
				<div className="topbar-actions">
					<button className="guide-link favorite-link" onClick={() => { clearTextSelection(); setShowTranscript(false); setScreen("favorites"); }} aria-current={screen === "favorites" ? "page" : undefined}>收藏{favorites.length ? ` ${favorites.length}` : ""}</button>
					<button className="guide-link" onClick={() => { clearTextSelection(); setShowTranscript(false); setScreen("guide"); }} aria-current={screen === "guide" ? "page" : undefined}>使用方法</button>
				</div>
			</header>

			<main id="top">
				{screen === "guide" ? <section className="guide-page">
					<p className="eyebrow">Shadowing guide</p>
					<h1>听见一句，<br /><em>跟上一步。</em></h1>
					<p className="hero-copy">每次用 10 分钟，选择一段音频，先听再跟读。不要等到每个词都懂才开口。</p>
					<ol className="guide-steps">
						<li><span>01</span><div><strong>先听一遍</strong><p>不看文字，感受节奏、重音和停顿。</p></div></li>
						<li><span>02</span><div><strong>立即跟读</strong><p>让自己的声音比原声慢半拍；跟不上就从下一句继续。</p></div></li>
						<li><span>03</span><div><strong>循环打磨</strong><p>对难句打开循环，先稳定节奏，再追求自然。</p></div></li>
					</ol>
					<button className="back-to-practice" onClick={() => setScreen("practice")}>返回练习</button>
				</section> : screen === "favorites" ? <section className="favorites-page">
					<p className="eyebrow">我的生词本</p>
					<h1>收藏的文本</h1>
					<p className="hero-copy">在全文或逐句文本中选中任意日语、中文或英文，再点“收藏”即可保存到这里。</p>
					{favorites.length > 0 ? <div className="favorites-list">
						{favorites.map((favorite) => <article className="favorite-item" key={favorite.id}>
							<div><p className="favorite-text">{favorite.text}</p><p className="favorite-meta">{favorite.courseTitle} · {favorite.lesson} · 第 {favorite.sentence} 句</p>{favorite.translation && <p className="favorite-translation">{favorite.translation}</p>}</div>
							<button type="button" onClick={() => setFavorites((items) => items.filter((item) => item.id !== favorite.id))} aria-label={`删除收藏：${favorite.text}`}>删除</button>
						</article>)}
					</div> : <div className="favorites-empty"><p>还没有收藏内容。</p><p>打开“全文”，长按选中需要记忆的文字，然后点收藏。</p></div>}
					<button className="back-to-practice" onClick={() => setScreen("practice")}>返回练习</button>
				</section> : <>
				<section className="library course-library" aria-label="选择教材">
					<div className="library-header"><div><p className="eyebrow">选择教材</p><h2>{course.title}</h2></div></div>
					<div className="filter-row" role="group" aria-label="教材切换">
						<button className={courseId === "beginner" ? "selected" : ""} onClick={() => selectCourse("beginner")}>初～中级编<small>56 个 section</small></button>
						<button className={courseId === "intermediate" ? "selected" : ""} onClick={() => selectCourse("intermediate")}>中～上级编<small>74 段音频 · 8 Unit</small></button>
					</div>
				</section>

				<section className="desktop-practice-layout">
				<div className="left-practice-column">
				<section className="workspace" aria-label="播放器与练习列表">
					<article className="player-card">
						<div className="player-heading">
							<div>
								<p className="eyebrow">正在练习</p>
								<h2>{current.label}{course.trackAudio ? " · 整段练习" : ` · 第 ${currentSentence} 句`}</h2>
							</div>
							<span className="level-badge">音频 {String(current.index).padStart(2, "0")}</span>
						</div>

						<div className="now-playing-preview" aria-live="polite">
							<p className="now-playing-japanese"><FuriganaText text={nowPlayingText} /></p>
							<p className="now-playing-translation">{nowPlayingTranslation}</p>
						</div>

						<div className="waveform" aria-hidden="true">
							{Array.from({ length: 42 }, (_, index) => <i key={index} style={{ height: `${18 + ((index * 31) % 60)}%` }} />)}
						</div>

						<div className="progress-row">
							<span>{formatTime(currentTime)}</span>
							<input
								aria-label="播放进度"
								type="range"
								min="0"
								max={duration || 0}
								step="0.1"
								value={Math.min(currentTime, duration || 0)}
								onPointerDown={seekFromPointer}
								onInput={(event) => seekTo(Number(event.currentTarget.value))}
								onChange={(event) => seekTo(Number(event.currentTarget.value))}
								onClick={(event) => seekTo(Number(event.currentTarget.value))}
							/>
							<span>{formatTime(duration)}</span>
						</div>

						<div className="transport" aria-label="播放控制">
							<button className="round-button" onClick={() => moveSentence(-1)} aria-label="上一句">↶</button>
							<button className="play-button" onClick={() => void togglePlayback()} aria-label={isPlaying ? "暂停" : "播放"}>
								{isPlaying ? "Ⅱ" : "▶"}
							</button>
							<button className="round-button" onClick={() => moveSentence(1)} aria-label="下一句">↷</button>
						</div>

						<div className="player-options">
							<div className="speed-control" aria-label="播放速度">
								{speeds.map((value) => <button key={value} className={speed === value ? "selected" : ""} onClick={() => setSpeed(value)}>{value}×</button>)}
							</div>
							<button className={`loop-button ${loop ? "active" : ""}`} onClick={() => setLoop((value) => !value)} aria-pressed={loop}>↻ 当前句循环</button>
						</div>
					</article>

					<div className="mobile-now-playing" aria-label="当前播放文案" aria-live="polite">
						<div className="mobile-now-copy selectable-transcript"><span>{current.label} · {String(currentSentence).padStart(2, "0")}</span><p><FuriganaText text={nowPlayingText} /></p><small>{nowPlayingTranslation}</small></div>
						<div className="mobile-now-actions"><button onClick={() => void togglePlayback()} aria-label={isPlaying ? "暂停" : "播放"}>{isPlaying ? "Ⅱ" : "▶"}</button><button type="button" onClick={() => { setSelectedText(""); setShowTranscript(true); }}>全文</button></div>
					</div>

				</section>

				<section className="library" id="practice-list">
					<div className="library-header">
						<div><p className="eyebrow">课程单元</p><h2>选择一个 section</h2></div>
						<label className="search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索编号" aria-label="搜索练习编号" /></label>
					</div>
					<div className="filter-row" role="group" aria-label="单元筛选">
						{units.map((item) => <button key={item.number} className={selectedUnit === item.number ? "selected" : ""} onClick={() => { setSelectedUnit(item.number); setQuery(""); }}>Unit {item.number}<small>{String(item.start).padStart(2, "0")}–{String(item.end).padStart(2, "0")}</small></button>)}
					</div>
					<div className="lesson-grid">
						{filteredLessons.map((lesson) => {
							const active = lesson.index - 1 === currentIndex;
							return <button key={lesson.index} className={`lesson-row ${active ? "active" : ""}`} onClick={() => selectLesson(lesson.index - 1)}>
								<span className="lesson-number">{String(lesson.index).padStart(2, "0")}</span>
								<span className="lesson-title"><strong>{lesson.label}</strong><small>{active ? (course.trackAudio ? "正在播放此 Track" : `正在第 ${currentSentence} 句`) : (course.trackAudio ? `${intermediateSection(lesson.index)} · 整段播放` : `${lesson.sentenceCount} 句 · 连续播放`)}</small></span>
								<span className="lesson-play">{active && isPlaying ? "Ⅱ" : "▶"}</span>
							</button>;
						})}
					</div>
					{filteredLessons.length === 0 && <p className="empty-state">没有匹配的练习，请换一个编号试试。</p>}
				</section>
				</div>

				{current.hasBookText && <section className="source-card" aria-label="源书对话与翻译">
					<div className="source-heading">
						<div><p className="eyebrow">{course.trackAudio ? "整段文本" : "逐句文本"}</p><h2>{current.label}</h2><p>日语、中文与英文均为可选择、可复制的文本；日语句中的汉字均会显示读音。</p></div>
						<div className="translation-tabs" role="group" aria-label="翻译语言">
							<button className={translation === "zh" ? "selected" : ""} onClick={() => setTranslation("zh")}>中文</button>
							<button className={translation === "en" ? "selected" : ""} onClick={() => setTranslation("en")}>English</button>
						</div>
					</div>
					{transcript ? <div className="transcript-list">
						{transcript.jp.map((japanese, index) => <article key={index} data-sentence={index + 1} className={`transcript-row ${currentSentence === index + 1 ? "active" : ""}`}>
							<button className={`sentence-play-button ${currentSentence === index + 1 && isPlaying ? "playing" : ""}`} onClick={() => toggleSentencePlayback(index + 1)} aria-label={currentSentence === index + 1 && isPlaying ? `暂停第 ${index + 1} 句` : `播放第 ${index + 1} 句`}>
								<span>{String(index + 1).padStart(2, "0")}</span><b>{currentSentence === index + 1 && isPlaying ? "Ⅱ" : "▶"}</b>
							</button>
							<div className="transcript-text selectable-transcript">
								<p className="japanese-text"><FuriganaText text={japanese} /></p>
								<p className="translation-text">{translation === "zh" ? transcript.zh[index] : transcript.en[index]}</p>
							</div>
						</article>)}
					</div> : <p className="transcript-loading">正在加载该 section 的可选择文本…</p>}
				</section>}
				</section>
				</>}
			</main>

			{screen === "practice" && <>
				{showTranscript && transcript && <div className="transcript-sheet" role="dialog" aria-modal="true" aria-label="当前文本" onClick={(event) => { if (event.target === event.currentTarget) setShowTranscript(false); }}>
					<div className="sheet-panel" onClick={(event) => event.stopPropagation()}><div className="sheet-heading"><div><p className="eyebrow">当前文本</p><h2>{current.label}</h2></div><button type="button" className="sheet-close" onClick={() => setShowTranscript(false)} aria-label="关闭全文">关闭</button></div>
						<div className="transcript-list">{transcript.jp.map((japanese, index) => <article key={index} data-sentence={index + 1} className={`transcript-row ${currentSentence === index + 1 ? "active" : ""}`}><button className={`sentence-play-button ${currentSentence === index + 1 && isPlaying ? "playing" : ""}`} onClick={() => { const isCurrentSentence = currentSentence === index + 1; toggleSentencePlayback(index + 1); if (!isCurrentSentence) setShowTranscript(false); }} aria-label={currentSentence === index + 1 && isPlaying ? `暂停第 ${index + 1} 句` : `播放第 ${index + 1} 句`}><span>{String(index + 1).padStart(2, "0")}</span><b>{currentSentence === index + 1 && isPlaying ? "Ⅱ" : "▶"}</b></button><div className="transcript-text selectable-transcript"><p className="japanese-text"><FuriganaText text={japanese} /></p><p className="translation-text">{translation === "zh" ? transcript.zh[index] : transcript.en[index]}</p></div></article>)}</div>
					</div>
				</div>}
			</>}
			<FloatingFavoriteAction selectedText={selectedText} notice={favoriteNotice} position={favoritePosition} onSave={saveSelectedText} />

			<footer>© 2026 日本語Shadowing · 日语 Shadowing 练习</footer>
			<audio
				ref={audioRef}
				src={audioSource}
				loop={loop}
				onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
				onLoadedMetadata={handleLoadedMetadata}
				onSeeked={(event) => setCurrentTime(event.currentTarget.currentTime)}
				onPlay={() => setIsPlaying(true)}
				onPause={() => setIsPlaying(false)}
				onEnded={handleEnded}
			/>
		</div>
	);
}

export default App;
