export type StoredRecord<T> = {
	version: 1;
	updatedAt: number;
	data: T;
};

type HybridStoreOptions<T> = {
	localKey: string;
	scope: string;
	parse: (value: unknown) => T | null;
	syncDelayMs?: number;
};

const deviceSuffix = "-anonymous-device";

function readDeviceId(localKey: string) {
	const key = `${localKey}${deviceSuffix}`;
	const existing = window.localStorage.getItem(key);
	if (existing) return existing;
	const generated = typeof crypto?.randomUUID === "function"
		? crypto.randomUUID()
		: `${Date.now()}-${Math.random().toString(36).slice(2)}`;
	window.localStorage.setItem(key, generated);
	return generated;
}

function isRecord<T>(value: unknown, parse: (data: unknown) => T | null): value is StoredRecord<T> {
	if (!value || typeof value !== "object") return false;
	const record = value as Partial<StoredRecord<unknown>>;
	return record.version === 1 && Number.isFinite(record.updatedAt) && parse(record.data) !== null;
}

/**
 * Local-first persistence with optional Cloudflare KV sync.
 * It keeps working when /api/storage has no KV binding, so other features can
 * reuse this adapter before their matching KV namespace is configured.
 */
export function createHybridStore<T>({ localKey, scope, parse, syncDelayMs = 1_500 }: HybridStoreOptions<T>) {
	let timer: number | undefined;
	let queuedRecord: StoredRecord<T> | null = null;

	function readLocal() {
		if (typeof window === "undefined") return null;
		try {
			const value = JSON.parse(window.localStorage.getItem(localKey) ?? "null") as unknown;
			if (isRecord(value, parse)) return value;
			const legacyData = parse(value);
			return legacyData ? { version: 1 as const, updatedAt: 0, data: legacyData } : null;
		} catch {
			return null;
		}
	}

	function writeLocal(record: StoredRecord<T>) {
		if (typeof window !== "undefined") window.localStorage.setItem(localKey, JSON.stringify(record));
	}

	async function upload(record: StoredRecord<T>) {
		try {
			const response = await fetch(`/api/storage/${encodeURIComponent(scope)}`, {
				method: "PUT",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ deviceId: readDeviceId(localKey), ...record }),
			});
			if (response.status === 429) queue(record, 1_600);
		} catch {
			// The local copy remains authoritative while offline or before KV is bound.
		}
	}

	function queue(record: StoredRecord<T>, delay = syncDelayMs) {
		queuedRecord = record;
		if (timer !== undefined) window.clearTimeout(timer);
		timer = window.setTimeout(() => {
			const next = queuedRecord;
			queuedRecord = null;
			timer = undefined;
			if (next) void upload(next);
		}, delay);
	}

	function save(data: T) {
		const record: StoredRecord<T> = { version: 1, updatedAt: Date.now(), data };
		writeLocal(record);
		queue(record);
		return record;
	}

	async function sync(onRemoteNewer?: (data: T) => void) {
		if (typeof window === "undefined") return;
		const local = readLocal();
		try {
			const response = await fetch(`/api/storage/${encodeURIComponent(scope)}?deviceId=${encodeURIComponent(readDeviceId(localKey))}`);
			if (response.status === 404) {
				if (local) void upload(local);
				return;
			}
			if (!response.ok) return; // 503 means the optional KV binding has not been added yet.
			const remote = await response.json() as unknown;
			if (!isRecord(remote, parse)) return;
			if (!local || remote.updatedAt > local.updatedAt) {
				writeLocal(remote);
				onRemoteNewer?.(remote.data);
			} else if (local.updatedAt > remote.updatedAt) {
				void upload(local);
			}
		} catch {
			// Network failures intentionally fall back to the already-loaded local value.
		}
	}

	return { readLocal, save, sync };
}
