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

type LocalUsage = { days: DayMap; device: string };

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

/** Display: server total minus what this device already uploaded, plus this device's live total. */
export function combineDays(remote: DayMap, mine: DayMap, localDays: DayMap): DayMap {
	const out: DayMap = {};
	for (const day of new Set([...Object.keys(remote), ...Object.keys(localDays)])) {
		const others = Math.max(0, (remote[day] || 0) - (mine[day] || 0));
		const total = Math.max(remote[day] || 0, others + (localDays[day] || 0));
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
let remoteMine: DayMap = {};
let local: LocalUsage = { days: {}, device: "" };
let signedIn = false;
let lastSyncOk = false;
let audioPlaying = false;
let segmentStart: number | null = null;
let lastInput = 0;
let snapshot: UsageSnapshot = EMPTY_SNAPSHOT;
let timer = 0;
let started = 0;
let syncing: Promise<void> | null = null;
// Sync cadence (Daniel's ruling, 2026-11-15, same as the learning app): local persistence
// stays high-frequency — accrued seconds are committed to local storage every few seconds —
// but the server is only touched when the page is shown (open / return to foreground) or
// hidden (the keepalive flush below). There is deliberately no periodic in-session upload:
// visibility transitions are frequent enough on mobile, and each avoided upload saves KV writes.
let lastSyncOkAt = 0;
const SYNC_GET_FRESH_MS = 5 * 60_000;
const SYNC_FAILURE_COOLDOWN_MS = 60 * 60_000;
const SYNC_NETWORK_RETRY_MS = 60_000;
const FAILED_KEY = "usage-sync-failed";
const DEVICE = /^[a-z0-9]{6,40}$/;
const listeners = new Set<() => void>();
const tabId = `t${Math.random().toString(36).slice(2)}`;

function newDevice(): string {
	return `d${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`.slice(0, 40);
}

function emptyLocal(): LocalUsage {
	return { days: {}, device: newDevice() };
}

function loadLocal(): LocalUsage {
	if (typeof localStorage === "undefined") return emptyLocal();
	try {
		const raw = JSON.parse(localStorage.getItem(LOCAL_KEY) || "");
		if (!raw || typeof raw !== "object") return emptyLocal();
		const device = typeof raw.device === "string" && DEVICE.test(raw.device) ? raw.device : newDevice();
		return { days: sanitizeDays(raw.days), device };
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
	snapshot = { days: combineDays(remote, remoteMine, local.days), signedIn, synced: lastSyncOk, kind };
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

function onPageHide() {
	if (!audioPlaying) closeSegment();
	flushUpload();
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

function readStore(key: string): string | null {
	try {
		return typeof localStorage === "undefined" ? null : localStorage.getItem(key);
	} catch {
		return null;
	}
}

function writeStore(key: string, value: string | null) {
	try {
		if (typeof localStorage === "undefined") return;
		if (value == null) localStorage.removeItem(key);
		else localStorage.setItem(key, value);
	} catch {
		/* ignore */
	}
}

type SyncFailure = { at: number; status: number };
const memoryFailures = new Map<string, SyncFailure>();

function parseFailure(raw: string | null): SyncFailure | null {
	if (!raw) return null;
	const [tsRaw, statusRaw] = raw.split(":");
	const at = Number(tsRaw);
	if (!Number.isFinite(at) || at <= 0) return null;
	// Entries written by older clients stored only the timestamp; treat them as
	// server failures (long cooldown).
	const status = statusRaw === undefined ? -1 : Number(statusRaw);
	return { at, status: Number.isFinite(status) ? status : -1 };
}

function lastFailure(): SyncFailure | null {
	const mem = memoryFailures.get(kind);
	const stored = parseFailure(readStore(`${FAILED_KEY}:${kind}`));
	if (!mem) return stored;
	if (!stored) return mem;
	return mem.at >= stored.at ? mem : stored;
}

/**
 * Graded failure backoff (same policy as the learning app): a server rejection
 * (429/5xx) reached the server and may have cost KV quota, so it keeps the long
 * cooldown; a network error (status 0) never reached the server, costs no
 * quota, and retries after a short floor. Local data is never cleared.
 */
function canAttemptSync(now = Date.now()): boolean {
	const failure = lastFailure();
	if (!failure) return true;
	if (failure.at > now) return true;
	const floor = failure.status === 0 ? SYNC_NETWORK_RETRY_MS : SYNC_FAILURE_COOLDOWN_MS;
	return now - failure.at >= floor;
}

/** Record an attempt's outcome: `status` 0 means a network error. Any non-2xx starts the cooldown. */
function noteSyncResult(status: number, now = Date.now()) {
	const ok = status >= 200 && status < 300;
	if (!ok && status === 0) {
		// Several callers note the HTTP status and then throw into a catch that
		// notes a network error for the same attempt. A genuine network error
		// means no response arrived, so it can never follow a server rejection
		// within the same few seconds; keep the server record (and its
		// quota-protecting cooldown) instead of reclassifying it as transient.
		const existing = lastFailure();
		if (existing && existing.status !== 0 && now - existing.at < 5000) return;
	}
	if (ok) memoryFailures.delete(kind);
	else memoryFailures.set(kind, { at: now, status });
	writeStore(`${FAILED_KEY}:${kind}`, ok ? null : `${now}:${status}`);
}

function withDevice(endpoint: string): string {
	return `${endpoint}${endpoint.includes("?") ? "&" : "?"}device=${local.device}`;
}

function readRemote(body: { days?: unknown; mine?: unknown }) {
	remote = sanitizeDays(body.days);
	remoteMine = sanitizeDays(body.mine);
}

// A `lite` POST answers with the posted days only; fold them into what the GET
// returned. Per-day values only ever grow (the server keeps the max per
// device), so merging with max can never make the displayed totals regress.
function mergeRemote(body: { days?: unknown; mine?: unknown }) {
	const days = sanitizeDays(body.days);
	const mine = sanitizeDays(body.mine);
	for (const [day, sec] of Object.entries(days)) remote[day] = Math.max(remote[day] || 0, sec);
	for (const [day, sec] of Object.entries(mine)) remoteMine[day] = Math.max(remoteMine[day] || 0, sec);
}

/** Absolute per-day totals the server is behind on for this device. */
function pendingTotals(): DayMap {
	const totals: DayMap = {};
	for (const [day, sec] of Object.entries(local.days)) if (sec > (remoteMine[day] || 0)) totals[day] = sec;
	return totals;
}

async function doSync(force = false) {
	if (kind === "account" && !signedIn) return;
	if (typeof fetch === "undefined" || !local.device) return;
	// Non-forced runs (foreground return) only touch the network when there is
	// something to upload or the server copy is stale; the failure cooldown
	// still gates every attempt.
	if (!force && !Object.keys(pendingTotals()).length && Date.now() - lastSyncOkAt < SYNC_GET_FRESH_MS) return;
	if (!canAttemptSync()) return;
	const endpoint = withDevice(usageEndpoint(kind));
	try {
		const got = await fetch(endpoint, { credentials: credentials(), cache: "no-store" });
		if (got.status === 401) {
			signedIn = false;
			lastSyncOk = false;
			publish();
			return;
		}
		if (!got.ok) {
			noteSyncResult(got.status);
			lastSyncOk = false;
			publish();
			return;
		}
		readRemote((await got.json()) as { days?: unknown; mine?: unknown });
		// Upload absolute totals only for days the server is behind on; nothing changed means no write.
		const totals = pendingTotals();
		if (Object.keys(totals).length && claimLock()) {
			// `lite=1`: the server skips list() and answers with the posted days only.
			const posted = await fetch(`${endpoint}&lite=1`, {
				method: "POST",
				credentials: credentials(),
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ device: local.device, totals }),
			});
			noteSyncResult(posted.status);
			if (!posted.ok) {
				lastSyncOk = false;
				publish();
				return;
			}
			mergeRemote((await posted.json()) as { days?: unknown; mine?: unknown });
		} else noteSyncResult(got.status);
		lastSyncOk = true;
		lastSyncOkAt = Date.now();
	} catch {
		noteSyncResult(0);
		lastSyncOk = false;
	}
	publish();
}

/**
 * Last-chance upload when the page is being hidden or unloaded: POST any
 * totals the server is behind on with keepalive so the browser finishes the
 * request while the page goes away. This is what saves a session's time when
 * iOS later discards the page (or its storage) before the next page open. The
 * server merge is max-per-device, so racing a normal sync is harmless.
 */
function flushUpload() {
	if (typeof fetch === "undefined" || !local.device) return;
	if (kind === "account" && !signedIn) return;
	const totals = pendingTotals();
	if (!Object.keys(totals).length) return;
	if (!claimLock()) return;
	const endpoint = withDevice(usageEndpoint(kind));
	try {
		void fetch(`${endpoint}&lite=1`, {
			method: "POST",
			credentials: credentials(),
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ device: local.device, totals }),
			keepalive: true,
		})
			.then(async (res) => {
				noteSyncResult(res.status);
				if (!res.ok) return;
				mergeRemote((await res.json()) as { days?: unknown; mine?: unknown });
				lastSyncOk = true;
				lastSyncOkAt = Date.now();
				publish();
			})
			.catch(() => noteSyncResult(0));
	} catch {
		/* The page is going away; the next successful sync reconciles from local state. */
	}
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
	if (typeof document !== "undefined" && document.hidden) {
		if (!audioPlaying) closeSegment(now);
		flushUpload();
		return;
	}
	if (counting(now) && segmentStart == null) segmentStart = now;
	// Returning to the app is the natural moment to heal a sync that failed
	// earlier in the session (e.g. a network blip at page open); doSync gates
	// itself on need and cooldown.
	void syncNow();
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
		if (!signedIn) {
			remote = {};
			remoteMine = {};
		}
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
		saveLocal();
		lastInput = Date.now();
		publish();
		const opts = { passive: true } as AddEventListenerOptions;
		window.addEventListener("pointerdown", onActivity, opts);
		window.addEventListener("keydown", onActivity);
		document.addEventListener("scroll", onActivity, { passive: true, capture: true });
		window.addEventListener("touchstart", onActivity, opts);
		document.addEventListener("visibilitychange", onVisibility);
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
		window.removeEventListener("pagehide", onPageHide);
		window.removeEventListener("storage", onStorage);
		audioPlaying = false;
		segmentStart = null;
	};
}
