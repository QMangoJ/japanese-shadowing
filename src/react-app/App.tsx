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

const units: Unit[] = [
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

const lessons: PracticeItem[] = Array.from({ length: 56 }, (_, position) => {
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

const speeds = [0.75, 1, 1.25, 1.5];

function formatTime(seconds: number) {
	if (!Number.isFinite(seconds)) return "0:00";
	const minutes = Math.floor(seconds / 60);
	const remaining = Math.floor(seconds % 60).toString().padStart(2, "0");
	return `${minutes}:${remaining}`;
}

function extractSpokenLines(raw: string, attachReadings = false) {
	const spoken: string[] = [];
	for (const untrimmed of raw.split("\n")) {
		const line = untrimmed.trim();
		const match = line.match(/([AB])\s*[:：]\s*(.+)/i);
		if (match) {
			spoken.push(`${match[1].toUpperCase()}: ${match[2].trim().replace(/太野/g, "大野")}`);
			continue;
		}
		if (attachReadings && spoken.length > 0 && /^[ぁ-ゖァ-ヺー・]+$/.test(line)) {
			spoken[spoken.length - 1] += `（${line}）`;
		}
	}
	return spoken;
}

function groupSentences(lines: string[], sentenceCount: number) {
	return Array.from({ length: sentenceCount }, (_, index) => {
		const pair = lines.slice(index * 2, index * 2 + 2);
		return pair.length > 0 ? pair.join("\n") : "识别文本待校对";
	});
}

function FuriganaText({ text }: { text: string }) {
	return <>{text.split("\n").map((line, index) => {
		const match = line.match(/^(.*)([一-龯々〆ヶ]+)([^（）]*?)（([ぁ-ゖァ-ヺー]+)）$/);
		return <span key={`${line}-${index}`} className="japanese-line">
			{match ? <>{match[1]}<ruby>{match[2]}<rt>{match[4]}</rt></ruby>{match[3]}</> : line}
		</span>;
	})}</>;
}

function App() {
	const audioRef = useRef<HTMLAudioElement>(null);
	const [currentIndex, setCurrentIndex] = useState(0);
	const [currentSentence, setCurrentSentence] = useState(1);
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [speed, setSpeed] = useState(1);
	const [loop, setLoop] = useState(false);
	const [translation, setTranslation] = useState<"zh" | "en">("zh");
	const [playAfterChange, setPlayAfterChange] = useState(false);
	const [playWholeSection, setPlayWholeSection] = useState(false);
	const [selectedUnit, setSelectedUnit] = useState(1);
	const [query, setQuery] = useState("");
	const [transcript, setTranscript] = useState<Transcript | null>(null);

	const current = lessons[currentIndex];
	const audioSource = `/audio/${String(current.index).padStart(2, "0")}-${currentSentence}.mp3`;
	const unit = units.find((item) => item.number === selectedUnit) ?? units[0];
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
	}, [query, unit]);

	useEffect(() => {
		const audio = audioRef.current;
		if (!audio) return;
		audio.playbackRate = speed;
	}, [speed]);

	useEffect(() => {
		const audio = audioRef.current;
		if (!audio) return;
		setCurrentTime(0);
		setDuration(0);
		if (!playAfterChange) return;
		void audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
		setPlayAfterChange(false);
	}, [currentIndex, currentSentence, playAfterChange]);

	useEffect(() => {
		let disposed = false;
		setTranscript(null);
		const id = String(current.index).padStart(2, "0");
		void Promise.all(["jp", "zh", "en"].map((language) => fetch(`/transcripts/${language}/${id}.txt`).then((response) => response.text())))
			.then(([jp, zh, en]) => {
				if (disposed) return;
				setTranscript({
					jp: groupSentences(extractSpokenLines(jp, true), current.sentenceCount),
					zh: groupSentences(extractSpokenLines(zh), current.sentenceCount),
					en: groupSentences(extractSpokenLines(en), current.sentenceCount),
				});
			})
			.catch(() => { if (!disposed) setTranscript(null); });
		return () => { disposed = true; };
	}, [current.index, current.sentenceCount]);

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

	function selectLesson(index: number) {
		setCurrentIndex(index);
		setCurrentSentence(1);
		const parentUnit = units.find((item) => index + 1 >= item.start && index + 1 <= item.end);
		if (parentUnit) setSelectedUnit(parentUnit.number);
		setPlayWholeSection(true);
		setPlayAfterChange(true);
	}

	function playSentence(sentence: number) {
		setCurrentSentence(sentence);
		setPlayWholeSection(false);
		setPlayAfterChange(true);
	}

	function moveLesson(direction: -1 | 1) {
		const next = (currentIndex + direction + lessons.length) % lessons.length;
		selectLesson(next);
	}

	function handleEnded() {
		if (loop) return;
		if (playWholeSection && currentSentence < current.sentenceCount) {
			setCurrentSentence((sentence) => sentence + 1);
			setPlayAfterChange(true);
			return;
		}
		setIsPlaying(false);
		setPlayWholeSection(false);
	}

	return (
		<div className="app-shell">
			<a className="skip-link" href="#practice-list">跳到练习列表</a>
			<header className="topbar">
				<a className="brand" href="#top" aria-label="KAGEKOE 首页">
					<span className="brand-mark">声</span>
					<span>KAGEKOE</span>
				</a>
				<div className="topbar-note"><span className="pulse-dot" />Shadowing practice</div>
			</header>

			<main id="top">
				<section className="hero">
					<div>
						<p className="eyebrow">日语跟读练习</p>
						<h1>听见一句，<br /><em>跟上一步。</em></h1>
						<p className="hero-copy">从单元进入 section，先听原声，再紧跟复述。每个 section 均按书中编号播放同名 MP3。</p>
					</div>
					<div className="hero-card" aria-label="今日练习提示">
							<span>课程结构</span>
							<strong>6 个单元</strong>
							<p>56 个 section，包含日语原文、振假名、中文与英文翻译。</p>
					</div>
				</section>

				<section className="workspace" aria-label="播放器与练习列表">
					<article className="player-card">
						<div className="player-heading">
							<div>
								<p className="eyebrow">正在练习</p>
								<h2>{current.label} · 第 {currentSentence} 句</h2>
							</div>
							<span className="level-badge">音频 {String(current.index).padStart(2, "0")}</span>
						</div>

						<p className="sentence-placeholder">点击 section 卡片即可从第 1 句连续播放；点击下方原文句块，则播放该句的对应 MP3。</p>

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
							<button className="round-button" onClick={() => moveLesson(-1)} aria-label="上一句">↶</button>
							<button className="play-button" onClick={() => void togglePlayback()} aria-label={isPlaying ? "暂停" : "播放"}>
								{isPlaying ? "Ⅱ" : "▶"}
							</button>
							<button className="round-button" onClick={() => moveLesson(1)} aria-label="下一句">↷</button>
						</div>

						<div className="player-options">
							<div className="speed-control" aria-label="播放速度">
								{speeds.map((value) => <button key={value} className={speed === value ? "selected" : ""} onClick={() => setSpeed(value)}>{value}×</button>)}
							</div>
							<button className={`loop-button ${loop ? "active" : ""}`} onClick={() => setLoop((value) => !value)} aria-pressed={loop}>↻ 当前句循环</button>
						</div>
					</article>

					<aside className="how-to-card">
						<p className="eyebrow">怎么练</p>
						<ol>
							<li><span>01</span><div><strong>先听</strong><p>不看文字，捕捉语调。</p></div></li>
							<li><span>02</span><div><strong>紧跟</strong><p>比原声慢半拍开口。</p></div></li>
							<li><span>03</span><div><strong>重复</strong><p>打开循环，直到顺畅。</p></div></li>
						</ol>
					</aside>
				</section>

				{current.hasBookText && <section className="source-card" aria-label="源书对话与翻译">
					<div className="source-heading">
						<div><p className="eyebrow">逐句文本</p><h2>Section {String(current.index).padStart(2, "0")}</h2><p>日语、中文与英文均为可选择、可复制的文本；原书识别到的振假名会显示在相应汉字上方。</p></div>
						<div className="translation-tabs" role="group" aria-label="翻译语言">
							<button className={translation === "zh" ? "selected" : ""} onClick={() => setTranslation("zh")}>中文</button>
							<button className={translation === "en" ? "selected" : ""} onClick={() => setTranslation("en")}>English</button>
						</div>
					</div>
					{transcript ? <div className="transcript-list">
						{transcript.jp.map((japanese, index) => <article key={index} className={`transcript-row ${currentSentence === index + 1 ? "active" : ""}`}>
							<button className="sentence-play-button" onClick={() => playSentence(index + 1)} aria-label={`播放第 ${index + 1} 句`}>
								<span>{String(index + 1).padStart(2, "0")}</span><b>▶</b>
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
								<span className="lesson-title"><strong>{lesson.label}</strong><small>{lesson.sentenceCount} 句 · 连续播放</small></span>
								<span className="lesson-play">{active && isPlaying ? "Ⅱ" : "▶"}</span>
							</button>;
						})}
					</div>
					{filteredLessons.length === 0 && <p className="empty-state">没有匹配的练习，请换一个编号试试。</p>}
				</section>
			</main>

			<footer>© 2026 KAGEKOE · 日语 Shadowing 练习</footer>
			<audio
				ref={audioRef}
				src={audioSource}
				loop={loop}
				onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
				onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
				onPlay={() => setIsPlaying(true)}
				onPause={() => setIsPlaying(false)}
				onEnded={handleEnded}
			/>
		</div>
	);
}

export default App;
