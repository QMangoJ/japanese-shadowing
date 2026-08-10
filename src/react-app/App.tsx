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

const speeds = [0.75, 1, 1.25, 1.5];

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
			if (text) spoken.push(`${match[1].toUpperCase()}: ${text.replace(/太野/g, "大野")}`);
			else pendingSpeaker = match[1].toUpperCase();
			continue;
		}
		if (pendingSpeaker && line) {
			spoken.push(`${pendingSpeaker}: ${line.replace(/太野/g, "大野")}`);
			pendingSpeaker = null;
			continue;
		}
		if (attachReadings && spoken.length > 0 && /^[ぁ-ゖァ-ヺー・]+$/.test(line)) {
			spoken[spoken.length - 1] += `（${line}）`;
		}
	}
	return spoken;
}

function groupSentences(lines: string[], sentenceCount: number) {
	const linesPerSentence = lines.length / sentenceCount;
	if (!Number.isInteger(linesPerSentence) || linesPerSentence < 2) {
		return Array.from({ length: sentenceCount }, () => "文本待校对");
	}
	return Array.from({ length: sentenceCount }, (_, index) => {
		const dialogue = lines.slice(index * linesPerSentence, (index + 1) * linesPerSentence);
		return dialogue.length > 0 ? dialogue.join("\n") : "文本待校对";
	});
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

function App() {
	const audioRef = useRef<HTMLAudioElement>(null);
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
	const [playWholeSection, setPlayWholeSection] = useState(false);
	const [selectedUnit, setSelectedUnit] = useState(() => courses[initialProgress.courseId].units.find((item) => initialProgress.currentIndex + 1 >= item.start && initialProgress.currentIndex + 1 <= item.end)?.number ?? 1);
	const [query, setQuery] = useState("");
	const [transcript, setTranscript] = useState<Transcript | null>(null);
	const [screen, setScreen] = useState<"practice" | "guide">("practice");
	const [showTranscript, setShowTranscript] = useState(false);

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
				const hasReliableGroups = [japaneseLines, chineseLines, englishLines].every((lines) =>
					lines.length >= current.sentenceCount * 2 && Number.isInteger(lines.length / current.sentenceCount),
				);
				const placeholders = Array.from({ length: current.sentenceCount }, () => "文本待校对");
				setTranscript({
					jp: course.trackAudio ? [jp] : hasReliableGroups ? groupSentences(japaneseLines, current.sentenceCount) : placeholders,
					zh: course.trackAudio ? [zh] : hasReliableGroups ? groupSentences(chineseLines, current.sentenceCount) : placeholders,
					en: course.trackAudio ? [en] : hasReliableGroups ? groupSentences(englishLines, current.sentenceCount) : placeholders,
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
			if (event.code === "Space" && !(event.target instanceof HTMLInputElement)) {
				event.preventDefault();
				void togglePlayback();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	});

	function selectLesson(index: number) {
		resumeRef.current = null;
		setCurrentTime(0);
		setDuration(0);
		setTranscript(null);
		setCurrentIndex(index);
		setCurrentSentence(1);
		const parentUnit = units.find((item) => index + 1 >= item.start && index + 1 <= item.end);
		if (parentUnit) setSelectedUnit(parentUnit.number);
		setPlayWholeSection(true);
		requestPlayback();
		setShowTranscript(false);
	}

	function selectCourse(nextCourse: CourseId) {
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
		setPlayWholeSection(false);
		setIsPlaying(false);
		setShowTranscript(false);
	}

	function playSentence(sentence: number) {
		resumeRef.current = null;
		setCurrentTime(0);
		setDuration(0);
		setCurrentSentence(sentence);
		setPlayWholeSection(false);
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
		setPlayWholeSection(false);
		requestPlayback();
		const parentUnit = units.find((item) => nextLesson.index >= item.start && nextLesson.index <= item.end);
		if (parentUnit) setSelectedUnit(parentUnit.number);
	}

	function handleLoadedMetadata(event: React.SyntheticEvent<HTMLAudioElement>) {
		const audio = event.currentTarget;
		setDuration(audio.duration);
		const saved = resumeRef.current;
		if (!saved || saved.courseId !== courseId || saved.currentIndex !== currentIndex || saved.currentSentence !== currentSentence) return;
		const resumeTime = Math.min(saved.currentTime, Math.max(0, audio.duration - .1));
		audio.currentTime = resumeTime;
		setCurrentTime(resumeTime);
		resumeRef.current = null;
	}

	function handleEnded() {
		if (loop) return;
		if (playWholeSection && currentSentence < current.sentenceCount) {
			setCurrentSentence((sentence) => sentence + 1);
			setCurrentTime(0);
			setDuration(0);
			requestPlayback();
			return;
		}
		setIsPlaying(false);
		setPlayWholeSection(false);
	}

	return (
		<div className="app-shell">
			<a className="skip-link" href="#practice-list">跳到练习列表</a>
			<header className="topbar">
				<button className="brand" onClick={() => setScreen("practice")} aria-label="日本語Shadowing 首页">
					<span className="brand-mark">日</span>
					<span>日本語Shadowing</span>
				</button>
				<button className="guide-link" onClick={() => setScreen("guide")}>使用方法</button>
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
				</section> : <>
				<section className="library course-library" aria-label="选择教材">
					<div className="library-header"><div><p className="eyebrow">选择教材</p><h2>{course.title}</h2></div></div>
					<div className="filter-row" role="group" aria-label="教材切换">
						<button className={courseId === "beginner" ? "selected" : ""} onClick={() => selectCourse("beginner")}>初～中级编<small>56 个 section</small></button>
						<button className={courseId === "intermediate" ? "selected" : ""} onClick={() => selectCourse("intermediate")}>中～上级编<small>74 段音频 · 8 Unit</small></button>
					</div>
				</section>

				<section className="desktop-practice-layout">
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
							<p className="now-playing-translation"><small>{translation === "zh" ? "中文" : "EN"}</small>{nowPlayingTranslation}</p>
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
								onChange={(event) => {
									const value = Number(event.target.value);
									if (audioRef.current) audioRef.current.currentTime = value;
									setCurrentTime(value);
								}}
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

				</section>

				{current.hasBookText && <section className="source-card" aria-label="源书对话与翻译">
					<div className="source-heading">
						<div><p className="eyebrow">{course.trackAudio ? "整段文本" : "逐句文本"}</p><h2>{current.label}</h2><p>日语、中文与英文均为可选择、可复制的文本；日语句中的汉字均会显示读音。</p></div>
						<div className="translation-tabs" role="group" aria-label="翻译语言">
							<button className={translation === "zh" ? "selected" : ""} onClick={() => setTranslation("zh")}>中文</button>
							<button className={translation === "en" ? "selected" : ""} onClick={() => setTranslation("en")}>English</button>
						</div>
					</div>
					{transcript ? <div className="transcript-list">
						{transcript.jp.map((japanese, index) => <article key={index} className={`transcript-row ${currentSentence === index + 1 ? "active" : ""}`}>
							<button className={`sentence-play-button ${currentSentence === index + 1 && isPlaying ? "playing" : ""}`} onClick={() => toggleSentencePlayback(index + 1)} aria-label={currentSentence === index + 1 && isPlaying ? `暂停第 ${index + 1} 句` : `播放第 ${index + 1} 句`}>
								<span>{String(index + 1).padStart(2, "0")}</span><b>{currentSentence === index + 1 && isPlaying ? "Ⅱ" : "▶"}</b>
							</button>
							<div className="transcript-text">
								<p className="japanese-text"><FuriganaText text={japanese} /></p>
								<p className="translation-text"><small>{translation === "zh" ? "中文" : "EN"}</small>{translation === "zh" ? transcript.zh[index] : transcript.en[index]}</p>
							</div>
						</article>)}
					</div> : <p className="transcript-loading">正在加载该 section 的可选择文本…</p>}
				</section>}

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
				</section>
				</>}
			</main>

			{screen === "practice" && <>
				<div className="mobile-now-playing" aria-label="当前播放文案">
					<div className="mobile-now-copy"><span>{current.label} · {String(currentSentence).padStart(2, "0")}</span><p><FuriganaText text={nowPlayingText} /></p><small>{nowPlayingTranslation}</small></div>
					<div className="mobile-now-actions"><button onClick={() => void togglePlayback()} aria-label={isPlaying ? "暂停" : "播放"}>{isPlaying ? "Ⅱ" : "▶"}</button><button onClick={() => setShowTranscript(true)}>全文</button></div>
				</div>
				{showTranscript && transcript && <div className="transcript-sheet" role="dialog" aria-modal="true" aria-label="当前文本">
					<div className="sheet-panel"><div className="sheet-heading"><div><p className="eyebrow">当前文本</p><h2>{current.label}</h2></div><button onClick={() => setShowTranscript(false)} aria-label="关闭全文">×</button></div>
						<div className="transcript-list">{transcript.jp.map((japanese, index) => <article key={index} className={`transcript-row ${currentSentence === index + 1 ? "active" : ""}`}><button className={`sentence-play-button ${currentSentence === index + 1 && isPlaying ? "playing" : ""}`} onClick={() => { const isCurrentSentence = currentSentence === index + 1; toggleSentencePlayback(index + 1); if (!isCurrentSentence) setShowTranscript(false); }} aria-label={currentSentence === index + 1 && isPlaying ? `暂停第 ${index + 1} 句` : `播放第 ${index + 1} 句`}><span>{String(index + 1).padStart(2, "0")}</span><b>{currentSentence === index + 1 && isPlaying ? "Ⅱ" : "▶"}</b></button><div className="transcript-text"><p className="japanese-text"><FuriganaText text={japanese} /></p><p className="translation-text"><small>{translation === "zh" ? "中文" : "EN"}</small>{translation === "zh" ? transcript.zh[index] : transcript.en[index]}</p></div></article>)}</div>
					</div>
				</div>}
			</>}

			<footer>© 2026 日本語Shadowing · 日语 Shadowing 练习</footer>
			<audio
				ref={audioRef}
				src={audioSource}
				loop={loop}
				onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
				onLoadedMetadata={handleLoadedMetadata}
				onPlay={() => setIsPlaying(true)}
				onPause={() => setIsPlaying(false)}
				onEnded={handleEnded}
			/>
		</div>
	);
}

export default App;
