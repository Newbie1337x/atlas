# Gym Front — Playbook

Source of truth for **what we're building, with what, how it connects, and what's still open**.

Read [ARCHITECTURE.md](./ARCHITECTURE.md) for the rules and constraints. This file is the operating manual.

Last consolidated: 2026-08-25.

---

## 1. What this app is

Cross-platform (iOS + Android + Web PWA) gym app for a single gym (single-tenant). Consumes the [Proteus API](https://github.com/Newbie1337x/Shoppify-api-2) which is Spring Boot 3.5 + Java 21 + hexagonal + multi-module.

Target user flows:
- Socio: reservar clases, ejecutar rutinas asignadas o propias, trackear progreso, ver feed social del gym
- Coach: crear y asignar rutinas, ver progreso de socios, comunicarse con ellos
- Dual role: mismo user puede ser AMBAS cosas y togglear entre ellas

Deploys as:
- iOS native app (App Store)
- Android native app (Play Store)
- Web PWA (marketing site subdomain, installable desktop/mobile)

Backend commercial-safe: todo el stack es MIT/Apache. Cero licencias de terceros.

---

## 2. Layer graph — where things go

```
src/app/
├── core/                cross-feature infra — 2+ features consume
│   ├── auth/            SessionStore + AuthApi + AuthService + guards + interceptor + JWT util
│   ├── api/             ApiClient (HTTP wrapper w/ timeout + base URL)
│   ├── errors/          HttpError + errorTransform interceptor + GlobalErrorHandler
│   ├── logger/          Logger (leveled, filtered by env)
│   ├── notify/          NotificationService (toast) + LoadingService (spinner wrapper)
│   ├── storage/         StorageService (Capacitor Preferences wrapper)
│   ├── offline/         enableQueryPersistence + (future) mutation queue + sync manager
│   ├── realtime/        SocketService (STOMP client — arrives with chat)
│   └── user/            UserProfileService (arrives when 1st feature needs profile beyond JWT)
│
├── features/            vertical slices — one folder per feature
│   ├── auth/            login (public)                                      ✅ skeleton
│   ├── shell/           tabs auth-guarded (placeholder)                     ✅ skeleton
│   ├── home/            dashboard: próxima clase, streak, quick stats       🔲 fase 1
│   ├── onboarding/      wizard: edad/peso/objetivos/nivel + template pick   🔲 fase 2
│   ├── profile/         perfil + medidas + fotos + config                   🔲 fase 2
│   ├── routines/        armador (drag-drop) + tracker + rest timer          🔲 fase 3
│   ├── progress/        charts + body heatmap + PRs + medidas               🔲 fase 3
│   ├── calendar/        agenda personal (clases + entrenos)                 🔲 fase 3
│   ├── bookings/        reservar clases + QR/GPS check-in                   🔲 fase 4
│   ├── membership/      plan, pagos MP, historial                           🔲 fase 4
│   ├── events/          eventos del gym + rankings + anuncios               🔲 fase 4
│   ├── feed/            timeline social + comments + likes + share workout  🔲 fase 5
│   ├── chat/            DMs 1:1 (WebSocket)                                 🔲 fase 5
│   ├── coach/           gestión socios asignados                            🔲 fase 6
│   └── integrations/    spotify (V2), healthkit/fit                         🔲 fase 5-6
│
├── shared/              cross-feature UI + utils
│   └── ui/              gym-button, gym-card, gym-avatar, gym-stat-tile,
│                        gym-body-heatmap, gym-empty-state, gym-track-badge…
│
└── environments/        dev + prod config
```

Import direction (lint-enforced): `features → shared → core`. Features **never** import between themselves. See [ARCHITECTURE.md §1](./ARCHITECTURE.md).

---

## 3. Stack matrix — what we use for what

| Concern | Tool | Rationale |
|---|---|---|
| **UI mobile components** | Ionic 9 | Native feel iOS/Android automático, MIT, cubre 90% |
| **UI headless primitives** | @angular/cdk | Drag-drop (routines), virtual scroll (chat/feed), overlay, focus trap |
| **State local** | Angular signals | Sync, cheap CD, no manual subscribe |
| **State server (reads)** | TanStack Query | Cache + refetch + dedup + invalidation |
| **State server (writes)** | TanStack Mutations | Optimistic updates + retry |
| **State sesión (session-local)** | signals plain | Timers, tracker state — no query |
| **HTTP** | `@core/api/ApiClient` wrapper | Auto headers + timeout(30s) + HttpError transform |
| **Auth** | Hand-rolled (SessionStore + AuthApi + AuthService) | Proteus es JWT propio simple, no OAuth |
| **JWT parse** | jwt-decode (lib) | 2kB, battle-tested |
| **Storage local** | @capacitor/preferences | Keychain iOS / EncryptedShared Android / localStorage web |
| **Offline cache** | @tanstack/query-persist-client-core | Queries sobreviven restart |
| **Offline durable (rutinas/sesiones)** | @capacitor-community/sqlite | Cuando aterrice fase offline |
| **Network state** | @capacitor/network | Detectar online/offline transitions |
| **Real-time (chat + presence + typing)** | STOMP over WebSocket (Spring `@EnableWebSocketMessageBroker` en backend) + client `@stomp/stompjs` | Zero deps custom, matchea infra ported de ticket-orchestrator |
| **Dates** | date-fns | Tree-shakeable — **NUNCA raw Date math, NUNCA moment/dayjs** |
| **Charts** | chart.js + ng2-charts | Fase 3 (progress) |
| **Native APIs** | @capacitor/* plugins | Camera, Push, Share, Filesystem, Geolocation, LocalNotifications, Haptics, Badge, BarcodeScanner, NativeAudio |
| **Web fallback cámara** | @capacitor/pwa-elements | Cuando cámara viva en PWA |
| **Icons** | ionicons (bundled) | Suficiente |
| **Errores** | HttpError + GlobalErrorHandler | Auto-toast, features nunca ven raw response |
| **Logs** | Logger service | No console.log sprawl |
| **Toasts** | NotificationService (wraps IonToast) | Un solo entry point |
| **Spinner bloqueante** | LoadingService (wraps IonLoading) | `.wrap(source$)` pattern |
| **HealthKit/Fit** | @perfood/capacitor-healthkit + @perfood/capacitor-google-fit | Fase 3 (progress) — leer peso/HR/pasos, escribir workouts |
| **Charts audio** | @capacitor-community/native-audio | Celebración fin rutina + Spotify 30s previews |
| **Lint** | ESLint flat + typescript-eslint strict | Boundaries + strict rules |
| **Size ceilings** | tools/check-file-size.mjs | Fail build si crossing |
| **CI** | GitHub Actions | lint:size + lint + build en PRs |

**Explicit NO — do not use**:
- CoreUI/PrimeNG/Kendo/Material (desktop-first, mal fit mobile)
- ngrx/signals (signals bastan)
- ngx-permissions (guards factory cubre)
- Socket.IO / SignalR (Proteus es Spring — STOMP es la elección)
- FullCalendar / Angular Calendar (custom mobile UI mejor)
- Moment/Day.js (date-fns es la convención)
- axios/ky (HttpClient alcanza)
- Redux/NgRx (signals + TanStack)
- YouTube Music API (no existe pública comercial — Spotify catalog cubre 100% users, ver §6)
- Rich text editor (plain text alcanza para chat/comments)

---

## 4. Auth end-to-end

### Contract with Proteus (verified from source)

**Auth endpoints exist and work**:
```
POST /api/auth/login             { email, password } → { token, refreshToken, email, role }
POST /api/auth/register          { firstName, lastName, email, password }
POST /api/auth/signup            (self-service tenant + admin)
POST /api/auth/refresh           { refreshToken } → { token, refreshToken, email, role }
POST /api/auth/logout            { refreshToken }
GET  /api/auth/verify            ?token=...
POST /api/auth/resend-verification ?email=...
POST /api/auth/forgot-password   { email }               → 200 always (enum-safe)
POST /api/auth/reset-password    { token, newPassword }  → 200 or 401
```

OAuth (backend 100% wired, real Google creds already in Proteus `.env`,
only the frontend button + callback route left to implement):
```
GET  /oauth2/authorization/google?tenant_slug=gym-dev-cabrera   (kickoff)
GET  /login/oauth2/code/google                                  (Google → Spring callback, handled)
→ 302 → ${OAUTH_SUCCESS_REDIRECT}?token=...&refreshToken=...&email=...&role=...
       (default: http://localhost:4300/auth/oauth-callback)
```

The frontend:
1. Redirects to the kickoff URL, passing `?tenant_slug=` (or omit — Proteus
   has `OAUTH_DEFAULT_TENANT_SLUG=gym-dev-cabrera` as fallback).
2. Adds a router path `/auth/oauth-callback` that reads the 4 query params
   and calls a new `AuthService.acceptExternalTokens(access, refresh)`
   which writes them to `SessionStore` without hitting `/api/auth/login`.

See Proteus `docs/GOOGLE-OAUTH-SETUP.md` for the full activation guide +
backend architecture.

**Profile data written on OAuth login** (relevant when we build the profile
page — this shapes what `GET /api/users/me` and `GET /api/social/profile/me`
return):

- `users` row (per-tenant, auth-only): email, firstName, lastName from
  Google's `given_name`/`family_name`, `organization_id` resolved from the
  tenant slug. **No avatar column on users**.
- `global_profiles` row (portable identity, one per verified email):
  `verified_email` + `avatar_url` (Google's `picture` URL, refreshed every
  login unless we later add a user-uploaded override). `User.global_profile_id`
  FK links to it.
- `social_profiles` row: **NOT** created on OAuth login. Lazily created by
  the social module the first time the frontend calls
  `GET /api/social/profile/me`. That's where nickname (`displayName`),
  `bio`, `birth_date`, `social_links` (JSONB map like
  `{"instagram":"@handle","tiktok":"..."}`), and social-avatar-override live.

Security guarantees added this backend session:
- Rate limit on `/forgot-password` (3/min), `/reset-password` (5/min), and
  the existing `/login` (5/min) / `/register` (3/min) / `/signup` (3/min).
- Password reset + email verification tokens are hashed (SHA-256) at rest —
  raw goes only in the email. A DB leak reveals nothing usable.
- Refresh token reuse detection: presenting an already-revoked refresh
  token nukes every session of that user (see Proteus commit `ac55390`).

**JWT payload today** (single-role):
```json
{
  "sub":            "user@email.com",
  "userId":         42,
  "organizationId": 1,
  "role":           "CUSTOMER",
  "type":           "access",
  "exp":            <unix seconds>
}
```

**Tenant header**: `X-Tenant-Slug` (string) — Proteus `TenantFilter` **ignora `X-Tenant-ID` numérico**. Slug se resuelve una vez y se hardcodea en `environment.ts` (single-tenant app).

### Frontend flow

```
COLD BOOT
  → APP_INITIALIZER corre AuthService.restore()
    → StorageService.get(accessToken)
    → Si existe y no expirado → SessionStore.hydrate(token)
    → Router recién ahora se monta, guards ven sesión

LOGIN (LoginPage)
  → AuthService.login(email, password)
    → AuthApi.login() → POST /api/auth/login
    → StorageService.set(accessToken + refreshToken)
    → SessionStore.hydrate(token) — normaliza role → roles[]
  → navigate(returnUrl ?? '/')

CUALQUIER REQUEST /api/*
  → authInterceptor añade Authorization + X-Tenant-Slug
  → si 401 → intenta refresh UNA vez
    → success: retry original
    → fail: logout + redirect /auth/login
  → errorTransformInterceptor
    → HttpErrorResponse → HttpError con userMessage en español

GUARDS
  authGuard              requiere sesión, redirect si no
  publicOnlyGuard        bloquea si YA está logueado (para login)
  roleGuard(...)         requiere role en el granted set del user
  moduleGuard(m)         requiere módulo activo del tenant
```

### Dual role toggling (planned once backend supports)

```
SessionStore.setActiveRole('COACH')  → cambia activeRole signal
UI reactiva: shell decide tabs según activeRole (socio ve mis rutinas / coach ve socios asignados)
Guards leen isActiveRole() cuando el gate es "estás EN modo coach ahora"
      vs hasRole()      cuando el gate es "podrías ser coach"
```

Frontend ya está preparado para multi-role hoy. Cuando backend agregue el enum `COACH` + cambie a `Set<UserRole>` + emita `roles: string[]` en JWT, el frontend consume sin cambios.

---

## 5. Real-time strategy — STOMP over WebSocket

**Decision**: WebSocket vía Spring STOMP. Zero polling. Ported directly from `reapersquad-ticket-orchestrator` (see audit findings in commit history).

### Backend (needs to be added to Proteus)

New Proteus modules:
- `modules/chat/` — Message + Conversation + Participant entities + STOMP endpoints
- `modules/notifications/` — Outbox pattern for push notifications delivery

Patterns to port DIRECTLY from `reapersquad-ticket-orchestrator`:

| Pattern | Source | Use in Proteus |
|---|---|---|
| STOMP config (`@EnableWebSocketMessageBroker`) | `WebSocketConfig.java` | Chat + notifications broker |
| Topic naming `/topic/<domain>/{tenant}/{entityId}` | Same file | `/topic/dm/{gymSlug}/{conversationId}` |
| Event publisher w/ `afterCommit` sync | `WebSocketTicketEventPublisherAdapter` | **Critical** — never publish events from a tx that rollbacks |
| Outbound worker (virtual threads + Semaphore + `@Scheduled` drain + `SELECT FOR UPDATE SKIP LOCKED` + stuck recovery) | `OutboundMessageWorker.java` | **Gold standard** — one worker serves chat delivery AND push notifications outbox |
| Typing broadcast (dedup 3s + retention 1min + timestamp fix) | `TypingBroadcastService` | Typing indicators for free |
| MessageStatus state machine (PENDING→SENDING→SENT/DELIVERED/FAILED) + retry index | Multiple entities | WhatsApp-style single/double tick with retry backoff |
| Aggregate-owned transitions w/ `IllegalTransitionException` | `Ticket.claim()/close()` | `Conversation.archive()/block()/mute()` |
| HMAC webhook verification + `CorrelationIdFilter` | `WebhookHmacFilter` | Cuando integres Spotify/Mercado Pago webhooks |

**Skip from ticket-orchestrator**:
- `setAllowedOriginPatterns("*")` sin auth — agregar `ChannelInterceptor` con JWT
- Simple broker in-memory — considerar RabbitMQ STOMP relay si Proteus escala multi-node
- In-memory presence/dedup — anotar TODO para migrar a Redis en escala horizontal
- Discord/Telegram bridge adapters — no aplican

### Frontend

`core/realtime/socket.service.ts` — STOMP client wrapping `@stomp/stompjs`:
- Single connection reused across features
- Auto-reconnect with exponential backoff
- JWT on connect via `Authorization` STOMP header
- Route messages by `/topic` subscription to feature-owned Subjects
- Cleanup on subscription unsubscribe

Feature-side: each feature (chat, notifications, live-leaderboard, presence) subscribes to its topic — never opens its own WebSocket.

### Effort

Given the port from ticket-orchestrator saves ~50% of the backend work:
- Backend (Proteus new modules): ~1 week
- Frontend (SocketService + chat feature): ~1.5-2 weeks
- **Total for chat + notifications real-time: ~3 weeks**

Push notifications outbound worker is a byproduct — the same infra serves chat and push, so effort is shared.

---

## 6. Music strategy — Spotify multi-level

Decision: **Option B** (all users benefit, connected users get more).

### For ALL users (no Spotify account needed)

- Search Spotify catalog via **Client Credentials** flow (dev auth, not user OAuth)
- User taps "Etiquetar canción" al final de una rutina o en un PR → busca + selecciona
- Track ID + 30s preview URL guardados con la rutina/PR
- Play preview in-app via `@capacitor-community/native-audio`
- "Abrir en Spotify" deep link para full playback

Backend endpoint needed:
```
GET /api/spotify/search?q=believer+imagine+dragons
  → proxy a Spotify Search API con Client Credentials del app
  → returns [{ id, name, artist, albumArt, previewUrl }]
```

### For users with Spotify connected (opt-in)

- Settings → Integrations → "Conectar Spotify" (OAuth flow via backend)
- Background sync: cada X min → `GET /me/player/recently-played` → guarda listening history
- Auto-correlation: cuando user completa PR, busca listening_history en ±3 min → sugiere track
- **Feature killer**: "escuchabas Believer cuando tiraste 100kg press banca"

Backend endpoints needed:
```
POST /api/integrations/spotify/connect          (guarda refresh_token del user)
POST /api/integrations/spotify/disconnect
GET  /api/progress/prs/:prId/soundtrack         (correlation lookup)
```

### Skip — YouTube Music / Apple Music V1

- YouTube Music: no hay API oficial pública comercial. Skip forever unless Google publica una.
- Apple Music: existe MusicKit SDK pero iOS-only + user Premium requerido + mucho más trabajo. V3+.

### Comercialización

Spotify Web API is free for commercial use (Client Credentials + user OAuth). 30s preview URLs are public. All within Spotify Developer TOS.

---

## 7. Offline strategy — 100% required

Gym context: WiFi is bad in basements. Users must open the app offline and see their routine, log a workout, write a message that syncs later.

### Layers

**1. Query cache persistence** (already wired) — `@tanstack/query-persist-client-core` writes cache to localStorage. Survives app restarts. Best-effort.

**2. Durable structured storage** (fase offline)
- Lib: `@capacitor-community/sqlite` (SQLite nativo + wasm web)
- Used for: rutinas completas cacheadas, workout sessions logged offline, exercise library, cached avatars
- One DB per user, tables mirror the read model

**3. Mutation queue** (fase offline)
- `core/offline/mutation-queue.ts` (custom service, ~150 LOC)
- Cuando user hace mutation offline: se guarda en SQLite con `pending: true`
- Al reconectar: re-envía en orden, borra del queue si backend confirma

**4. Sync manager** (fase offline)
- `core/offline/sync-manager.ts` (custom, ~100 LOC)
- Escucha `@capacitor/network` → dispara replay al reconectar
- Marca UI cuando algo está "sin sincronizar"

**5. Conflict resolution**
- Rutinas: LWW (last-write-wins) con warning al coach si el socio estaba en la rutina cuando el coach la modificó
- Log de sesión: user siempre gana (source of truth es el user)
- Chat: standard WhatsApp pattern — mensaje queda pendiente hasta reconexión

**Estimation**: soporte offline real ~2 semanas dedicadas post-fase 3.

---

## 8. Data model conventions

### Muscle groups enum (✅ DONE 2026-08-25)

Backend was actually already at 19 values (initial audit reported wrong). Expanded to **23** with the 4 additions needed for meaningful body heatmap:

```
Upper body:
  NECK, TRAPS
  SHOULDERS ⚠️ deprecated (kept for backward compat with 601 seeded exercises)
  FRONT_DELTS, SIDE_DELTS, REAR_DELTS  ← new, prefer for new exercises
  CHEST, LATS, UPPER_BACK, LOWER_BACK
  BICEPS, TRICEPS, FOREARMS

Core:
  ABS, OBLIQUES  ← OBLIQUES new

Lower body:
  QUADS, HAMSTRINGS, GLUTES, CALVES, ADDUCTORS, ABDUCTORS

Meta:
  CARDIO, FULL_BODY
```

**Backwards-compat additive change** — zero DB migration required (stored as `TEXT[]`).
Frontend body heatmap treats SHOULDERS as legacy bucket; new exercises use specific delts values.

Ref: Proteus commit `b3234c0` on branch `feature/gym-frontend-prep`.

Each exercise has:
- `primaryMuscles: List<MuscleGroup>` (1-3, the ones targeted)
- `secondaryMuscles: List<MuscleGroup>` (0-4, the helpers)

Body heatmap weighting:
```
score(muscle) = SUM(primary_sets × 1.0 + secondary_sets × 0.4)
```

### Supersets / dropsets

Backend already supports via `WorkoutExercise.supersetGroupId: String`. Same tag across N exercises = they're a superset. No hierarchical circuits (rounds) supported — simulate as "large supersets" if needed.

Rule for rest timer inside superset:
- Rest between exercises within the same superset group = 0 (pass-through)
- Rest after last exercise of the group = programmed value

### Ghost values (Hevy pattern)

When loading a routine for execution, backend returns:
```json
{
  "exerciseId": "...",
  "targetSets": 4,
  "lastSession": { "sets": [{weight, reps}, ...] }
}
```

Frontend renders each input's placeholder from `lastSession.sets[i]`. User taps → overrides (dark). No save → defaults to placeholder.

Offline: when downloading a routine for offline execution, also download the ghost data. `routine + lastSessionPerExercise` = one bundle.

### Check-in strategy

Two methods, work in tandem:

**Method A (silent)**: `@capacitor/geolocation` → compare user coords with gym coords → if within 50m radius, auto-check-in.

**Method B (fallback)**: `@capacitor-mlkit/barcode-scanning` → user scans QR at gym entrance.

Method A tried first (silent, no user interaction). If GPS denied or user out of range, Method B available as manual button.

**Why not SSID detection**: reading WiFi SSID requires Location permission on both iOS and Android (privacy). Same permission gate, worse UX. Geolocation is more natural.

---

## 9. Mandatory patterns per feature

Every feature page MUST render 3 UI states explicitly:

1. **Loading** — `<ion-skeleton-text>` matching the final layout shape. **NEVER** a lone spinner.
2. **Empty** — `<gym-empty-state>` component (create in `shared/ui/gym-empty-state/`) with icon + short copy + CTA.
3. **Error** — HttpError caught by GlobalErrorHandler → toast. For feature-scoped errors that need inline UI, banner with retry.

**Rate limit UX** — HttpError with status 429 → `NotificationService.error()` with countdown "Esperá Xs antes de reintentar".

Enforced by convention now, custom lint rule later.

---

## 10. Feature roadmap

| Fase | Feature | Backend status | Effort | Notes |
|---|---|---|---|---|
| **1** | home mock | Nothing | 3-5 días | Validates skeleton — signals, guards, query cache |
| **2** | auth complete + profile + onboarding | ✅ All auth endpoints ready. `GET /api/users/me` exists | 1-2 sem | Includes register, forgot password, verify code, avatar upload (Camera plugin), onboarding wizard |
| **3a** | routines armador + tracker + rest timer | ✅ TRAINING module implemented (108 files) — supersets via `supersetGroupId` | 2 sem | ⚠️ Needs muscle groups enum expansion first |
| **3b** | progress (charts + body heatmap + PRs) | ✅ PersonalRecord + BodyMeasurement entities exist | 1-2 sem | Body heatmap SVG needs designing |
| **3c** | calendar personal | Nothing new — combines routines + bookings | Junto con 3b | |
| **4a** | bookings (reservar) + QR/GPS check-in | ✅ SCHEDULING module implemented, `ServiceOffering.requiresActiveMembership` ready | 1-2 sem | |
| **4b** | membership + Mercado Pago | ✅ MEMBERSHIP module fully implemented | 1-2 sem | `MembershipPlan.BranchScope`, invoices, CheckIn all ready |
| **4c** | events + rankings + announcements | ⚠️ SOCIAL has `LeaderboardEntry`/`ExerciseRanking` — may need Event entity | 1 sem | Confirm with backend |
| **4.5** | **Port ticket-orchestrator WS infra to Proteus** | ❌ NOT YET — needs porting | ~1 sem | New Proteus modules `chat` + `notifications`. Blocks fase 5. |
| **5a** | feed + comments + likes + share workout | ✅ SOCIAL module — Post/Comment/Like/Follow ready. `sourceModule/sourceEventId` for auto-posts from workouts | 1-2 sem | |
| **5b** | chat DMs (WebSocket) | ❌ Needs 4.5 done first | 1.5-2 sem | Uses ported WS infra |
| **5c** | push notifications mobile | ❌ Needs 4.5 done first | 1 sem | Uses ported outbound worker |
| **5d** | Spotify integration V2 (correlation) | ❌ Needs backend OAuth proxy + listening_history table | 2 sem | Optional wow-feature |
| **6a** | coach view | ✅ `CoachAssignment` entity exists. ⚠️ Needs COACH role + dual-role backend | 1 sem | |
| **6b** | offline durable strategy | Nothing new backend | 2 sem | SQLite + mutation queue + sync manager |
| **6c** | HealthKit/Google Fit integration | Nothing new backend (reads OS) | 1 sem | Read weight/HR/steps, write workouts |
| **V2** | Apple Watch companion | Separate WatchOS project | 3-4 sem | Not V1 |
| **V2** | Advanced coach features | Video calls, notes on students | | Not V1 |

**Realistic V1 launch estimate**: 4-5 months of focused work with backend team collaborating on required changes.

---

## 11. Backend changes required (Proteus asks)

Consolidated list of what needs to change in Proteus to unblock V1:

### High priority (blocks features)

1. **Dual role support**
   - Add `COACH` to `UserRole` enum
   - Change `User.role: UserRole` → `User.roles: Set<UserRole>`
   - JWT payload emits `roles: string[]` instead of (or alongside) single `role`
   - Migration to backfill existing users into single-element set
   - **Blocks**: coach features (fase 6a), dual-role UX

2. **Muscle groups enum expansion** ✅ DONE 2026-08-25
   - Was 19 → now 23 (added FRONT_DELTS, SIDE_DELTS, REAR_DELTS, OBLIQUES)
   - Backwards-compat: SHOULDERS kept as deprecated bucket for 601 seeded exercises
   - Zero DB migration required (`TEXT[]` storage)
   - Proteus branch: `feature/gym-frontend-prep` commit `b3234c0`

3. **New chat module** — `modules/chat/`
   - Entities: `Conversation, Message, Participant, MessageStatus`
   - Endpoints: REST for history + STOMP for real-time
   - Port patterns from `reapersquad-ticket-orchestrator` (see §5)
   - **Blocks**: chat feature (fase 5b)

4. **New notifications module** — `modules/notifications/`
   - Outbox pattern for push delivery (FCM + APNs)
   - Same `OutboundMessageWorker` pattern as chat
   - **Blocks**: push notifications (fase 5c)

### Medium priority (nice to have V1)

5. **Capabilities endpoint**
   - `GET /api/administration/organizations/me/capabilities` returns `{ modules: string[], features: {...} }`
   - Or: bake `modules: string[]` into JWT payload
   - Frontend uses this to filter palette / hide unavailable features
   - **Blocks**: nothing critical, but improves UX in multi-vertical future

6. **Spotify OAuth proxy** (only if V2 Spotify correlation goes)
   - `POST /api/integrations/spotify/connect` — receives auth code, exchanges for tokens, stores refresh_token
   - Background job (`@Scheduled`) reads `recently-played` per user, stores in `listening_history` table
   - `GET /api/progress/prs/:prId/soundtrack` — correlation query
   - **Blocks**: nothing critical — V2 feature

### Low priority (post-V1)

7. **Refresh token rotation** — memoria mentions this is desirable for mobile long sessions
8. **Rate limiting** — memoria mentions this is deferred
9. **Real-time infrastructure**: STOMP broker (fase 4.5 port)

---

## 12. Requirements & config

Values needed to run gym-front against real Proteus:

| Config | Where | Status |
|---|---|---|
| Proteus API URL (dev) | `src/environments/environment.ts` → `apiUrl` | ⏳ Pending — currently `http://localhost:8080` |
| Tenant slug | `src/environments/environment.ts` → `tenantSlug` | ⏳ TBD — currently `'default'`. **Find via Proteus admin panel → Organizations, or `SELECT slug FROM organizations WHERE id = <your_org_id>;`** |
| Test user (owner/manager role) | Create via Proteus admin | ⏳ Needs user creado en tu tenant |
| Proteus running | `mvn spring-boot:run` on Proteus repo | ✅ Modules verified via source audit |

---

## 13. Explicit decisions log

Decisions made during planning that shape everything:

| Question | Decision | Reason |
|---|---|---|
| Multi-tenant SaaS or single-tenant app? | **Single-tenant** (this gym only) | Multi-tenant es Gaia UI, gym-front es TU app |
| iOS + Android + Web coverage | ✅ All 3 via Ionic + Capacitor + PWA | Ionic covers native feel, PWA covers desktop web |
| Component library | Ionic + custom `shared/ui/` propio | Skip CoreUI/PrimeNG (desktop-first) — brand identity is the moat |
| Design system | Custom, built on Ionic (~10-15 wrappers) | Not a 3rd party lib — differentiator |
| Real-time approach | WebSocket via STOMP, port ticket-orchestrator patterns | Polling would feel broken for chat |
| Chat in V1 | ✅ Yes (given orchestrator port saves effort) | ~1.5 sem incremental sobre push notifs |
| Music integration | Option B — catalog free for all + Spotify OAuth optional | Cubre 100% users, feature killer para conectados |
| YouTube Music | ❌ Skip | No hay API oficial pública comercial |
| Coach features V1 | Limited: create + assign + view rutinas | No video call, no advanced |
| Offline required | ✅ 100% required — gym has bad WiFi | SQLite + mutation queue + sync manager |
| Wearables V1 | HealthKit + Google Fit read+write | Skip Apple Watch companion for V2 |
| Nutrición | Basic (kcal/macros/water) | Not primordial |
| Onboarding wizard | ✅ Required | Edad/peso/objetivos/nivel |
| Guest mode | ✅ Limited — browse ecosystem, register to create | Backend needs public read endpoints |
| Superset support | ✅ V1 (via backend `supersetGroupId`) | Data model already supports |
| Dropset support | ✅ V1 | Same `supersetGroupId` mechanism |
| Circuit (rounds jerárquicos) | ❌ V1 (backend doesn't support) | Can simulate with big supersets |
| Ghost values (Hevy pattern) | ✅ V1 | Standard fitness UX |
| Rest timer con background + haptics + audio | ✅ V1 | @capacitor plugins |
| Body heatmap SVG style | Stylized silhouette (not anatomical exacto) | More brand, less maintenance |
| QR check-in + GPS check-in | ✅ Both (GPS silent, QR fallback) | Not SSID (permission gate is worse) |
| Legal requirements | ✅ All (Privacy, Terms, Account deletion, Data export) | Required for App Store submission |
| Skeleton loaders / empty states / rate limit UX | ✅ Mandatory per feature | ARCHITECTURE.md §12 |

---

## 14. Not decided yet (TBD as they become relevant)

- Multi-branch (memoria: designed, no built) — decidir cuando aparezca 2do gym
- Membership required per class → per-offering config already exists (`ServiceOffering.requiresActiveMembership`)
- Videos ejercicios format (MP4 hosted vs external YouTube) — decidir en fase 3
- Ranking categories (edad, peso corporal, RM/kg BW) — decidir en fase 4c
- HIIT / interval timer as separate feature — probable V2
- App icon badge granularity (per feature or aggregate) — decidir en fase 5c
- Onboarding wizard exact steps count — diseñar en fase 2
- Body heatmap tap-to-drill-down behavior — diseñar en fase 3b
- Feature generator script (`npm run gen:feature`) — cuando features aterricen rápido

---

## 15. Cross-references

- **Rules & constraints**: [ARCHITECTURE.md](./ARCHITECTURE.md)
- **How to run**: [README.md](./README.md)
- **Backend source of truth**: `../Shoppify-api-2/` (Proteus)
- **Real-time patterns reference**: `../reapersquad-ticket-orchestrator/` (STOMP + outbound worker)

---

Playbook status: **CLOSED for planning**. Any feature added mid-flight requires updating this file. Deviation without documenting = ARCHITECTURE.md §10 rule broken (invent-in-feature).
