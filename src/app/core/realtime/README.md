# core/realtime

Home for the WebSocket layer — chat DMs, live feed updates, coach↔student
presence, typing indicators.

## When to create files here

- `socket.service.ts` — thin wrapper on `rxjs/webSocket` with:
  - single connection reused across features
  - auto-reconnect with exponential backoff
  - auth header on connect (JWT from `SessionStore`)
  - message routing by `type` field to feature-owned `Subject`s
- `<feature>-channel.service.ts` — feature-specific subscriptions
  (e.g. `chat-channel.service.ts` — join/leave conversations, send msg,
  observe messages)

## Rules

- ONE socket connection for the whole app — features don't open their own
- Features NEVER import `WebSocket` or `rxjs/webSocket` directly — always
  through `SocketService`
- `SocketService` never imports from features
- Reconnect logic + backoff live here, not in features

## Deps to reach for when this lands

- `rxjs/webSocket` — already in bundle (part of rxjs), zero extra
- Nothing else. NO Socket.IO / SignalR — Proteus is Spring, plain WS works.

Empty for now. First file lands when the chat feature starts.
