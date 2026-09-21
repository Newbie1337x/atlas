<div align="center">

# 🏔️ Atlas

**A native-feeling workout tracker built on [Proteus](https://github.com/Newbie1337x/Proteus-API)'s gym module — routines, live sessions, personal records.**

[![Angular](https://img.shields.io/badge/Angular-22-DD0031?logo=angular&logoColor=white)](https://angular.dev)
[![Ionic](https://img.shields.io/badge/Ionic-9-3880FF?logo=ionic&logoColor=white)](https://ionicframework.com)
[![Capacitor](https://img.shields.io/badge/Capacitor-8-119EFF?logo=capacitor&logoColor=white)](https://capacitorjs.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![TanStack Query](https://img.shields.io/badge/TanStack_Query-signals-FF4154?logo=reactquery&logoColor=white)](https://tanstack.com/query)

🇬🇧 English · [🇪🇸 Español](docs/README.es.md)

</div>

---

<table>
<tr>
<td align="center" width="20%"><img src="docs/screenshots/01-login.jpg" width="200" alt="Login screen"/><br/><sub><b>Login</b></sub></td>
<td align="center" width="20%"><img src="docs/screenshots/02-home.jpg" width="200" alt="Home dashboard"/><br/><sub><b>Home</b></sub></td>
<td align="center" width="20%"><img src="docs/screenshots/03-training.jpg" width="200" alt="Training tab, Semanal folder expanded"/><br/><sub><b>Routines</b></sub></td>
<td align="center" width="20%"><img src="docs/screenshots/04-session.jpg" width="200" alt="Live workout session"/><br/><sub><b>Live session</b></sub></td>
<td align="center" width="20%"><img src="docs/screenshots/05-profile.jpg" width="200" alt="Profile"/><br/><sub><b>Profile</b></sub></td>
</tr>
</table>

## What Atlas is

Atlas is a mobile workout tracker for [Proteus](https://github.com/Newbie1337x/Proteus-API)'s gym (training) module — routines organized into folders, live workout sessions, personal records, body measurements. Social login, offline-first, packaged as a real installable app via Capacitor.

It's deliberately rigid: one fixed shell, one fixed flow, no customization. A lifter wants the *same* screen every time, mid-set, without thinking — so every screen exists to get out of the way during a set, not to be configured.

## What's actually working today

This list is scoped to what's implemented and testable right now, not the roadmap (see [`EXECUTION-PLAN.md`](EXECUTION-PLAN.md) for what's next).

### Auth
- Social-first login — Google and Facebook in one tap, provider order adapts per platform (`login.page.ts`)
- Email + password fallback, tucked under a secondary link so it never competes with the one-tap flow
- Register, verify-by-email, forgot/reset password — full loop, including the JWT `access` + `refresh` pair and silent refresh on 401
- Runtime-resolved API base URL (`app.config.ts`): open the app from `localhost` and it hits `localhost:8080`; open it from a LAN or Tailscale IP and it hits *that same host* on `:8080` — one dev build serves a laptop and a phone at once with zero config

### Training
- Routines, organized into folders (or the "Mis rutinas" loose bucket) — create, rename, duplicate, delete
- **Press-and-hold drag-and-drop** to reorder routines or move them between folders, backed by a real two-step API sequence (patch the routine's folder, then atomically resequence both folders' `displayOrder` in one transaction each)
- Full routine editor: exercises, sets, rest seconds, notes, **superset groups**, **reps mode** (single value or range)
- Exercise capabilities drive the UI, not the other way around — a bodyweight exercise never shows a weight field, a duration-based one never shows reps; the backend enforces the same rules on write, so no client can send an invalid combination
- Live workout session tracker: check off sets, auto-fills actual values from target on first tap, **rest timer with a wheel picker** for quick ±15s adjustments, **live PR detection** against your history, **"ANTERIOR" ghost values** from your last session of that exercise
- **Ad-hoc "empty workout"** — start tracking with zero template and add exercises as you go
- KPI row (elapsed time, volume, completed sets) live during the session
- Workout survives navigating away — a persistent mini-bar in the shell lets you check routines or your profile mid-set and jump straight back in
- Weight input modes per exercise: kilograms or "bricks" (fixed-weight plates you stack — useful for home gyms without a full plate set)
- `CanDeactivate` guards on the session and the routine editor confirm before discarding unsaved work

### Home / Profile
- Home dashboard: greeting, "start a workout" CTA, your own routines as quick-start cards
- Profile: stats, exercise history, body measurements, personal calendar, settings (linked-provider management, incl. unlinking)

### Cross-cutting
- Offline banner (`NetworkService`) — the app stays fully usable offline, writes queue and sync when the connection returns
- TanStack Query persistence — the routines/session cache survives a cold app restart
- Capacitor-wrapped — this is a real installable iOS/Android app (`npm run cap:ios` / `cap:android`), not just a responsive web page

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Angular 22, standalone components, signals only (no `BehaviorSubject` in new code) |
| Mobile shell | Ionic 9 (`mode: 'ios'`) + Capacitor 8 — one codebase, iOS + Android + web |
| Server state | TanStack Query (signals-based), with offline persistence |
| Drag & drop | Angular CDK `DragDrop`, connected drop lists across folder boundaries |
| Styling | Hand-rolled Ionic CSS custom-property theme — dark, single accent, no UI kit |
| API client | `HttpClient` behind a single `ApiClient` + `AuthApi`, JWT interceptor with refresh, Spanish-language typed `HttpError` |
| Native | `@capacitor/preferences`, `push-notifications`, `splash-screen`, `status-bar` |

## Talking to Proteus

Atlas is a pure client of [Proteus](https://github.com/Newbie1337x/Proteus-API)'s `training` module — every request carries a JWT (`userId`, `organizationId`, `role`) and an `X-Tenant-Slug` header, since Proteus is multi-tenant and one deployment can host several organizations at once. A few contracts worth calling out:

- **Idempotent session writes** — the client mints a UUID once at session start; every `PUT /workouts/:uuid` during the session (checking off a set, adjusting weight) is a safe retry after a dropped connection or a killed tab, never a duplicate.
- **Server-computed capabilities** — `ExerciseCapabilities` (which fields an exercise accepts) come from the backend, computed from exercise type + equipment, so the client never hardcodes "this exercise needs weight."
- **One consolidated fetch to start a session** — `GET /workouts/prepare?routineId=` returns the routine detail, every personal record, and last session's values in one round-trip instead of three.
- **Batch reorder in one transaction** — `PATCH /routines/folder/:id/order` rewrites every routine's `displayOrder` in the folder atomically, which is what makes the drag-and-drop feel instant without N sequential requests.

See [`PLAYBOOK.md`](PLAYBOOK.md) for the full auth contract (§4, verified against Proteus's source, not just its docs) and the offline strategy (§7).

## Project structure

```
src/app/
├── core/       # cross-feature infra — auth, api client, storage, error handling
├── features/   # one folder per feature: auth, home, training, profile, shell, chat, notifications
└── shared/     # cross-feature pure UI (design system lives here)
```

Every feature owns its own `*.routes.ts`, is lazy-loaded, and cannot import from a sibling feature — enforced by lint, not convention. Full rules (file-size ceilings, the signals-only rule, why `HttpClient` is banned outside `ApiClient`) live in [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Getting started

```bash
npm install
npm start          # ng serve --open, http://localhost:4200
```

Atlas needs a running [Proteus](https://github.com/Newbie1337x/Proteus-API) instance for anything past the login screen. By default it targets `http://localhost:8080` — override in `src/environments/environment.ts` if yours runs elsewhere, or just open the app from a different host: the runtime API base URL resolver in `app.config.ts` follows along automatically.

```bash
npm run build         # production build
npm run lint:all      # eslint + the file-size ceiling script
npm run cap:ios       # sync + open in Xcode
npm run cap:android   # sync + open in Android Studio
```

## More documentation

| Doc | What's in it |
|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | The non-negotiable engineering rules — lint-enforced layering, file-size ceilings, the signals-only rule, and the anti-patterns each one prevents |
| [`PLAYBOOK.md`](PLAYBOOK.md) | The technical playbook — verified Proteus auth contract, offline strategy, data model conventions (supersets, ghost values, muscle groups), stack rationale |
| [`EXECUTION-PLAN.md`](EXECUTION-PLAN.md) | The full phased roadmap — bookings + QR check-in, memberships, coach dual-role, HealthKit/Google Fit, real-time chat, and more, phase by phase with a definition of done |

## Roadmap highlights

Not implemented yet, tracked in [`EXECUTION-PLAN.md`](EXECUTION-PLAN.md):

- Social feed (auto-posts from completed workouts, likes/comments) — backend `SOCIAL` module lands first
- Chat — real-time DMs over STOMP/WebSocket
- Bookings, QR/GPS check-in, memberships + payment
- Coach view (dual-role toggle)
- HealthKit / Google Fit sync

---

<div align="center">

Built by [Tomás Cabrera](https://github.com/Newbie1337x) · built on [Proteus](https://github.com/Newbie1337x/Proteus-API)

</div>
