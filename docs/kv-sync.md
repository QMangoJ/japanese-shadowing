# Optional Cloudflare KV sync

The app is local-first: progress is always saved in Local Storage. Cloud sync starts automatically only after the Worker receives an `APP_KV` binding, and it immediately uploads the existing local progress for that browser.

Create a KV namespace, then add its ID to `wrangler.json`:

```json
"kv_namespaces": [
  { "binding": "APP_KV", "id": "your-namespace-id" }
]
```

After the next GitHub-triggered deployment, no client-side configuration is needed. The reusable client adapter is `src/react-app/hybridStorage.ts`; new syncable features can create another store with a distinct `scope` and local key.

The current identifier is an anonymous ID stored in the browser, so this sync restores data for the same browser. Cross-device sync should be connected to a real account ID when authentication is added.
