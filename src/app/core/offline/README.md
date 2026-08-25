# core/offline

Offline / caching infrastructure. Gym context: WiFi is bad in basements —
users open the app without signal and expect their routine and last chat
messages to be there.

## What's here

- `query-persist.ts` — wires TanStack Query cache to `localStorage`
  so queries survive app restarts. Called once from `app.config.ts`.

## What's coming

- `<domain>-offline.strategy.ts` — per-feature offline write queues
  (e.g. `chat-offline.strategy.ts` — messages typed offline get queued
  in Capacitor Preferences, flushed when the socket reconnects).
- Capacitor Filesystem cache for large binary payloads (workout videos,
  exercise reference images).

## Rules

- Persistence is opt-in per query — mark long-lived data with
  `queryKey: ['durable', ...]` if we want it in the persisted cache;
  ephemeral queries stay memory-only.
- Never persist auth tokens through TanStack cache — those belong in
  `StorageService` via `core/auth`.
