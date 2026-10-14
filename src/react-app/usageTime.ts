export const USAGE_DAY_CAP_SEC = 16 * 60 * 60;
export const USAGE_IDLE_MS = 3 * 60 * 1000;
export const USAGE_ENDPOINT = "https://japanese-fullstack.alanjwakawaka.workers.dev/api/usage";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_KEY = "usage-time-v1";
const LOCK_KEY = "usage-time-lock";
const IDLE_SLICE_MS = 60_000;

export type DayMap = Record<string, number>;
export type UsageKind = "account" | "shadowing" | "reading";

export type UsageSnapshot = {
	days: DayMap;
	signedIn: boolean;
	synced: boolean;
	kind: UsageKind;
};

type LocalUsage = { days: DayMap; synced: DayMap };

export function jstDayKey(ms: number): string {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Tokyo",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(ms);
}

/** Next midnight in Asia/Tokyo, as a UTC timestamp. */
export function nextJstMidnight(ms: number): number {
	const [year, month, day] = jstDayKey(ms).split("-").map(Number);
	const start = Date.UTC(year, month - 1, day) - 9 * 60 * 60 * 1000;
	const next = start + 24 * 60 * 60 * 1000;
	return next > ms ? next : ms + 1000;
}

export function sanitizeDays(value: unknown): DayMap {
	if (!value || typeof value !== "object" || Array.isArray(value)) return {};
	const out: DayMap = {};
	for (const [day, sec] of Object.entries(value as Record<string, unknown>)) {
		if (!DAY.test(day) || typeof sec !== "number" || !Number.isInteger(sec) || sec <= 0) continue;
		out[day] = Math.min(USAGE_DAY_CAP_SEC, sec);
	}
	return out;
}

export function parseUsageDelta(body: unknown): DayMap | null {
	if (!body || typeof body !== "object" || Array.isArray(body) || !("days" in body)) return null;
	const days = (body as { days: unknown }).days;
	if (!days || typeof days !== "object" || Array.isArray(days)) return null;
	return sanitizeDays(days);
}

function shiftDay(day: string, days: number): string {
	const [year, month, date] = day.split("-").map(Number);
	return new Date(Date.UTC(year, month - 1, date + days)).toISOString().slice(0, 10);
}

export function applyUsageDelta(stored: DayMap, delta: DayMap, now = Date.now()): DayMap {
	const next = { ...sanitizeDays(stored) };
	const latest = shiftDay(jstDayKey(now), 1);
	for (const [day, sec] of Object.entries(delta).slice(0, 400)) {
		if (!DAY.test(day) || day > latest || !Number.isInteger(sec) || sec <= 0) continue;
		next[day] = Math.min(USAGE_DAY_CAP_SEC, (next[day] || 0) + Math.min(sec, USAGE_DAY_CAP_SEC));
	}
	return next;
}

export function addSecondsAcrossDays(days: DayMap, startMs: number, endMs: number): DayMap {
	if (!(endMs > startMs)) return days;
	const next = { ...days };
	let cursor = startMs;
	while (cursor < endMs) {
		const boundary = nextJstMidnight(cursor);
		const sliceEnd = Math.min(endMs, boundary);
		const sec = Math.floor((sliceEnd - cursor) / 1000);
		if (sec > 0) {
			const day = jstDayKey(cursor);
			next[day] = Math.min(USAGE_DAY_CAP_SEC, (next[day] || 0) + sec);
		}
		if (sliceEnd <= cursor) break;
		cursor = sliceEnd;
	}
	return next;
}

export function pendingDelta(local: DayMap, synced: DayMap, remote: DayMap): DayMap {
	const out: DayMap = {};
	for (const day of Object.keys(local)) {
		const pending = Math.max(0, (local[day] || 0) - (synced[day] || 0));
		const room = Math.max(0, USAGE_DAY_CAP_SEC - (remote[day] || 0));
		const send = Math.min(pending, room);
		if (send > 0) out[day] = send;
	}
	return out;
}

export function displayDays(remote: DayMap, local: DayMap, synced: DayMap): DayMap {
	const out: DayMap = {};
	for (const day of new Set([...Object.keys(remote), ...Object.keys(local)])) {
		const pending = Math.max(0, (local[day] || 0) - (synced[day] || 0));
		const total = (remote[day] || 0) + pending;
		if (total > 0) out[day] = Math.min(USAGE_DAY_CAP_SEC, total);
	}
	return out;
}

export function usageEndpoint(kind: UsageKind): string {
	if (kind === "shadowing") return `${USAGE_ENDPOINT}?app=shadowing`;
	if (kind === "reading") return `${USAGE_ENDPOINT}?app=reading`;
	return "/api/usage";
}

const EMPTY_SNAPSHOT: UsageSnapshot = { days: {}, signedIn: false, synced: false, kind: "account" };

let kind: UsageKind = "account";
let remote: DayMap = {};
let local: LocalUsage = { days: {}, synced: {} };
let signedIn = false;
let lastSyncOk = false;
let audioPlaying = false;
let segmentStart: number | null = null;
let lastInput = 0;
let snapshot: UsageSnapshot = EMPTY_SNAPSHOT;
let timer = 0;
let started = 0;
let syncing: Promise<void> | null = null;
const listeners = new Set<() => void>();
const tabId = `t${Math.random().toString(36).slice(2)}`;

function emptyLocal(): LocalUsage {
	return { days: {}, synced: {} };
}

function loadLocal(): LocalUsage {
	if (typeof localStorage === "undefined") return emptyLocal();
	try {
		const raw = JSON.parse(localStorage.getItem(LOCAL_KEY) || "");
		if (!raw || typeof raw !== "object") return emptyLocal();
		return { days: sanitizeDays(raw.days), synced: sanitizeDays(raw.synced) };
	} catch {
		return emptyLocal();
	}
}

function saveLocal() {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.setItem(LOCAL_KEY, JSON.stringify(local));
	} catch {
		/* Private mode can refuse the write. The in-memory day still updates. */
	}
}

function publish() {
	snapshot = { days: displayDays(remote, local.days, local.synced), signedIn, synced: lastSyncOk, kind };
	for (const listener of listeners) listener();
}

function lockOwner(now = Date.now()): string | null {
	if (typeof localStorage === "undefined") return tabId;
	try {
		const raw = localStorage.getItem(LOCK_KEY);
		if (!raw) return null;
		const cur = JSON.parse(raw) as { id?: string; ts?: number };
		if (!cur.id || typeof cur.ts !== "number" || now - cur.ts > 5000) return null;
		return cur.id;
	} catch {
		return null;
	}
}

function claimLock(now = Date.now()): boolean {
	const owner = lockOwner(now);
	if (owner && owner !== tabId && !audioPlaying) return false;
	if (typeof localStorage === "undefined") return true;
	try {
		localStorage.setItem(LOCK_KEY, JSON.stringify({ id: tabId, ts: now }));
		return lockOwner(now) === tabId;
	} catch {
		return true;
	}
}

function counting(now: number): boolean {
	if (audioPlaying) return true;
	if (typeof document !== "undefined" && document.hidden) return false;
	return now - lastInput <= USAGE_IDLE_MS;
}

function commit(start: number, end: number, fromAudio: boolean) {
	const capEnd = fromAudio ? end : Math.min(end, start + IDLE_SLICE_MS);
	if (capEnd <= start) return;
	local = { ...local, days: addSecondsAcrossDays(local.days, start, capEnd) };
	saveLocal();
	publish();
}

function closeSegment(now = Date.now()) {
	if (segmentStart == null) return;
	commit(segmentStart, now, audioPlaying);
	segmentStart = null;
}

function tick() {
	const now = Date.now();
	const active = counting(now);
	const mine = active || segmentStart != null ? claimLock(now) : false;
	if (!mine) {
		if (segmentStart != null) closeSegment(now);
		return;
	}
	if (segmentStart == null) {
		if (active) segmentStart = now;
		return;
	}
	const end = audioPlaying ? now : Math.min(now, lastInput + USAGE_IDLE_MS);
	if (now - segmentStart >= 5000 || !active) {
		commit(segmentStart, end, audioPlaying);
		segmentStart = active ? now : null;
	}
}

function onOnline() {
	void syncNow();
}

function onPageHide() {
	if (!audioPlaying) closeSegment();
}

function credentials(): RequestCredentials {
	return kind === "account" ? "include" : "omit";
}

async function refreshAccount() {
	if (kind !== "account" || typeof fetch === "undefined") return;
	try {
		const res = await fetch("/api/me", { credentials: "include", cache: "no-store" });
		if (!res.ok) {
			signedIn = false;
			return;
		}
		const data = (await res.json()) as { user?: { id?: string } | null };
		signedIn = Boolean(data?.user?.id);
	} catch {
		signedIn = false;
	}
	publish();
}

async function doSync() {
	if (kind === "account" && !signedIn) return;
	if (typeof fetch === "undefined") return;
	const endpoint = usageEndpoint(kind);
	try {
		const got = await fetch(endpoint, { credentials: credentials(), cache: "no-store" });
		if (got.status === 401) {
			signedIn = false;
			lastSyncOk = false;
			publish();
			return;
		}
		if (!got.ok) {
			lastSyncOk = false;
			publish();
			return;
		}
		const body = (await got.json()) as { days?: unknown };
		remote = sanitizeDays(body.days);
		const delta = pendingDelta(local.days, local.synced, remote);
		if (Object.keys(delta).length && claimLock()) {
			const posted = await fetch(endpoint, {
				method: "POST",
				credentials: credentials(),
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ days: delta }),
			});
			if (!posted.ok) {
				lastSyncOk = false;
				publish();
				return;
			}
			const saved = (await posted.json()) as { days?: unknown };
			remote = sanitizeDays(saved.days);
			const synced = { ...local.synced };
			for (const [day, sent] of Object.entries(delta)) {
				synced[day] = Math.min(local.days[day] || 0, (synced[day] || 0) + sent);
			}
			local = { ...local, synced };
			saveLocal();
		}
		lastSyncOk = true;
	} catch {
		lastSyncOk = false;
	}
	publish();
}

function syncNow() {
	if (syncing) return syncing;
	syncing = doSync().finally(() => {
		syncing = null;
	});
	return syncing;
}

function onActivity() {
	const now = Date.now();
	lastInput = now;
	if (segmentStart == null && counting(now) && claimLock(now)) segmentStart = now;
}

function onVisibility() {
	const now = Date.now();
	if (typeof document !== "undefined" && document.hidden && !audioPlaying) closeSegment(now);
	else if (counting(now) && segmentStart == null) segmentStart = now;
	if (typeof document !== "undefined" && !document.hidden) void syncNow();
}

function onStorage(event: StorageEvent) {
	if (event.key !== LOCAL_KEY) return;
	local = loadLocal();
	publish();
}

export function usageSnapshot(): UsageSnapshot {
	return snapshot;
}

export function subscribeUsage(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function setUsageAudioPlaying(playing: boolean) {
	if (audioPlaying === playing) return;
	closeSegment();
	audioPlaying = playing;
	const now = Date.now();
	if (counting(now)) segmentStart = now;
	publish();
}

export function refreshUsageAccount(signedInNow?: boolean) {
	if (typeof signedInNow === "boolean") {
		signedIn = signedInNow;
		if (!signedIn) remote = {};
		publish();
		if (signedIn) void syncNow();
		return;
	}
	void refreshAccount().then(() => syncNow());
}

export function startUsageTracker(nextKind: UsageKind = "account"): () => void {
	started += 1;
	kind = nextKind;
	if (started === 1 && typeof window !== "undefined") {
		local = loadLocal();
		lastInput = Date.now();
		publish();
		const opts = { passive: true } as AddEventListenerOptions;
		window.addEventListener("pointerdown", onActivity, opts);
		window.addEventListener("keydown", onActivity);
		document.addEventListener("scroll", onActivity, { passive: true, capture: true });
		window.addEventListener("touchstart", onActivity, opts);
		document.addEventListener("visibilitychange", onVisibility);
		window.addEventListener("online", onOnline);
		window.addEventListener("pagehide", onPageHide);
		window.addEventListener("storage", onStorage);
		timer = window.setInterval(tick, 1000);
		void refreshAccount().then(() => syncNow());
		if (counting(Date.now())) segmentStart = Date.now();
	}
	return () => {
		started = Math.max(0, started - 1);
		if (started > 0 || typeof window === "undefined") return;
		closeSegment();
		window.clearInterval(timer);
		window.removeEventListener("pointerdown", onActivity);
		window.removeEventListener("keydown", onActivity);
		document.removeEventListener("scroll", onActivity, true);
		window.removeEventListener("touchstart", onActivity);
		document.removeEventListener("visibilitychange", onVisibility);
		window.removeEventListener("online", onOnline);
		window.removeEventListener("pagehide", onPageHide);
		window.removeEventListener("storage", onStorage);
		audioPlaying = false;
		segmentStart = null;
	};
}
