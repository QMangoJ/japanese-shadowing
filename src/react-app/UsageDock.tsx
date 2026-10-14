import { useEffect, useState, useSyncExternalStore } from "react";

import {
	jstDayKey,
	setUsageAudioPlaying,
	startUsageTracker,
	subscribeUsage,
	usageSnapshot,
	type UsageSnapshot,
} from "./usageTime";
import "./usage.css";

const EMPTY: UsageSnapshot = { days: {}, signedIn: false, synced: false, kind: "shadowing" };

function duration(seconds: number): string {
	const total = Math.max(0, Math.floor(seconds));
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	if (hours && minutes) return `${hours} 小时 ${minutes} 分`;
	if (hours) return `${hours} 小时`;
	if (minutes) return `${minutes} 分`;
	return `${total} 秒`;
}

function dayLabel(day: string): string {
	const [year, month, date] = day.split("-");
	return `${year}年${Number(month)}月${Number(date)}日`;
}

export function UsageDock() {
	const [open, setOpen] = useState(false);
	const snap = useSyncExternalStore(subscribeUsage, usageSnapshot, () => EMPTY);
	useEffect(() => startUsageTracker("shadowing"), []);
	useEffect(() => {
		const onPlay = (event: Event) => {
			if (event.target instanceof HTMLMediaElement) setUsageAudioPlaying(true);
		};
		const onStop = (event: Event) => {
			if (event.target instanceof HTMLMediaElement) setUsageAudioPlaying(false);
		};
		document.addEventListener("play", onPlay, true);
		document.addEventListener("pause", onStop, true);
		document.addEventListener("ended", onStop, true);
		const audio = document.querySelector("audio");
		setUsageAudioPlaying(Boolean(audio && !audio.paused));
		return () => {
			document.removeEventListener("play", onPlay, true);
			document.removeEventListener("pause", onStop, true);
			document.removeEventListener("ended", onStop, true);
			setUsageAudioPlaying(false);
		};
	}, []);

	const today = jstDayKey(Date.now());
	const days = Object.entries(snap.days).sort((a, b) => (a[0] < b[0] ? 1 : -1));
	const total = days.reduce((sum, [, sec]) => sum + sec, 0);
	return (
		<>
			<button type="button" className="usage-dock-open" onClick={() => setOpen(true)}>
				时间
			</button>
			{open ? (
				<div className="usage-dock" role="dialog" aria-modal="true" aria-label="使用时间">
					<section className="usage-dock-card">
						<p className="usage-dock-kicker">Shadowing</p>
						<h2>使用时间</h2>
						<p>
							页面在前台，并且 3 分钟内有点击、按键或滚动时计时。音频播放时继续计时，包括锁屏。一天最多 16 小时，按日本时间切天。
						</p>
						<p>{snap.synced ? "已记在服务器上，按天永久保存。" : "先记在这台设备，网络恢复后会补传。"}</p>
						<div className="usage-dock-stats">
							<div>
								<span>今天</span>
								<b>{duration(snap.days[today] || 0)}</b>
							</div>
							<div>
								<span>累计</span>
								<b>{duration(total)}</b>
							</div>
						</div>
						{days.length ? (
							<div className="usage-dock-days">
								{days.map(([day, sec]) => (
									<div className={day === today ? "today" : ""} key={day}>
										<span>{dayLabel(day)}</span>
										<b>{duration(sec)}</b>
									</div>
								))}
							</div>
						) : (
							<p>今天还没有记录。留下练习，或开始播放，时间会按天累加。</p>
						)}
						<button type="button" className="usage-dock-close" onClick={() => setOpen(false)}>
							返回练习
						</button>
					</section>
				</div>
			) : null}
		</>
	);
}
