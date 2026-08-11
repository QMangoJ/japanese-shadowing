import { Hono } from "hono";

type StorageEnv = Env & { APP_KV?: KVNamespace };
type StoredRecord = { version: 1; updatedAt: number; data: unknown };
type StorageRequest = Partial<StoredRecord> & { deviceId?: unknown };

const app = new Hono<{ Bindings: StorageEnv }>();
const validScope = /^[a-z0-9-]{1,48}$/;
const validDeviceId = /^[a-z0-9-]{16,96}$/i;

function storageKey(scope: string, deviceId: string) {
	return `shadowing:${scope}:${deviceId}`;
}

function getStorage(c: { env: StorageEnv }) {
	return c.env.APP_KV;
}

function isValidRequest(value: StorageRequest): value is StoredRecord & { deviceId: string } {
	return validDeviceId.test(String(value.deviceId ?? "")) &&
		value.version === 1 &&
		Number.isFinite(value.updatedAt) &&
		Object.hasOwn(value, "data");
}

app.get("/api/", (c) => c.json({ name: "Cloudflare" }));

app.get("/api/storage/:scope", async (c) => {
	const scope = c.req.param("scope");
	const deviceId = c.req.query("deviceId") ?? "";
	if (!validScope.test(scope) || !validDeviceId.test(deviceId)) return c.json({ error: "Invalid storage key" }, 400);
	const storage = getStorage(c);
	if (!storage) return c.json({ available: false }, 503);
	const record = await storage.get<StoredRecord>(storageKey(scope, deviceId), "json");
	if (!record) return c.json({ error: "Not found" }, 404);
	return c.json(record);
});

app.put("/api/storage/:scope", async (c) => {
	const scope = c.req.param("scope");
	if (!validScope.test(scope)) return c.json({ error: "Invalid storage scope" }, 400);
	const storage = getStorage(c);
	if (!storage) return c.json({ available: false }, 503);
	const body = await c.req.json<StorageRequest>().catch(() => null);
	if (!body || !isValidRequest(body)) return c.json({ error: "Invalid storage payload" }, 400);
	const record: StoredRecord = { version: 1, updatedAt: body.updatedAt, data: body.data };
	const serialized = JSON.stringify(record);
	if (serialized.length > 32_000) return c.json({ error: "Storage payload is too large" }, 413);
	await storage.put(storageKey(scope, body.deviceId), serialized);
	return c.json({ ok: true });
});

export default app;
