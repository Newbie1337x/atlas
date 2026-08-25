# Gym Front — Execution Plan

The **operational manual**: in what order, with what gates, until each feature is done. Complements [PLAYBOOK.md](./PLAYBOOK.md) (what/why/where) and [ARCHITECTURE.md](./ARCHITECTURE.md) (rules).

**Read this before starting any phase**. Each phase has explicit preconditions, deliverables, and a Definition of Done. Skipping a gate = you're doing it wrong.

---

## 0. Principles

1. **One phase at a time** — no parallel feature work (background research/backend asks OK)
2. **Small commits** — one deliverable per commit, structured message (`type(scope): description`)
3. **Every commit passes CI** — lint + size + build. Broken main is forbidden.
4. **Every phase updates PLAYBOOK.md** if scope changed (new deps, new pattern, new decision)
5. **Preconditions are hard gates** — if the precondition doesn't hold, DON'T START. Fix precondition first.
6. **Definition of Done is a checklist** — every box checked, or the phase is not done
7. **Manual QA on device before "done"** — for anything user-facing, test on real iOS + Android at least once per phase (PWA is not enough — native has edge cases)
8. **When in doubt, defer scope, not quality** — cutting a slot from a phase is fine; shipping half-baked isn't

---

## 1. Phase overview

| # | Phase | Est. duration | Backend deps | Blocks |
|---|---|---|---|---|
| **-1** | Backend micro-tasks (small unblockers) | 1 day (done!) | Proteus source access | Phase 3b |
| **0** | Foundation validation | 2-3 days | Proteus running + test user | Everything |
| **1** | Home mock + design tokens + first shared UI | 1 week | Nothing | Phase 2 UX polish |
| **2** | Auth polish + Profile + Onboarding | 2 weeks | Nothing (all endpoints ready) | Phase 3 needs profile data |
| **3a** | Backend prep (muscle groups enum) | Backend team | Coordination | Phase 3b, 3d |
| **3b** | Routines armador | 1-2 weeks | Muscle enum done | 3c |
| **3c** | Routines tracker + rest timer + notes | 1-2 weeks | Nothing | Phase 3d |
| **3d** | Progress + charts + body heatmap | 1-2 weeks | Muscle enum done | — |
| **3e** | Calendar personal | 3-5 days | Nothing | — |
| **4a** | Bookings + QR/GPS check-in | 1-2 weeks | Nothing | — |
| **4b** | Membership + Mercado Pago | 1-2 weeks | Nothing | — |
| **4c** | Events + rankings + announcements | 1 week | Confirm Event entity | — |
| **4.5** | **Real-time infra port** (backend chat + notifications modules) | 1 week | Ticket-orchestrator port | Phase 5b, 5c |
| **5a** | Feed + comments + likes + share workout | 1-2 weeks | Nothing | — |
| **5b** | Chat DMs | 1.5-2 weeks | 4.5 done | — |
| **5c** | Push notifications (FCM + APNs) | 1 week | 4.5 done | — |
| **5d** | Spotify V2 (correlation + tag) | 2 weeks | OAuth proxy in backend | Optional feature |
| **6a** | Backend prep (dual role + COACH) | Backend team | Coordination | 6b |
| **6b** | Coach view | 1 week | 6a done | — |
| **6c** | Offline durable strategy | 2 weeks | Nothing | — |
| **6d** | HealthKit + Google Fit | 1 week | Nothing (reads OS) | — |
| **7** | Pre-launch (legal + assets + beta + submission) | 2-3 weeks | Nothing | Launch |

**Realistic V1 total**: 4-6 months of focused single-dev work with backend team collaborating on the 3 backend prep phases (3a, 4.5, 6a) in parallel.

---

## 2. Phase-by-phase detail

Each phase follows this template:
```
Goal              — one sentence
Preconditions     — what must be true to start (hard gate)
Deliverables      — concrete outputs
Backend deps      — what needs to be in Proteus
Definition of Done — checklist
Risks             — known unknowns
```

---

### PHASE -1 — Backend micro-tasks ✅ DONE 2026-08-25

**Goal**: Ship small, well-scoped backend changes NOW that unblock frontend phases weeks ahead, without waiting for feature convergence.

**Rationale**: Big backend changes (chat module, dual role migration) risk being wrong if built before their frontend consumer exists. But small self-contained additions (enum expansion, endpoint verification) benefit from early delivery — no rework risk, cadence buffer for backend team.

**Deliverables shipped**:
1. ✅ **Muscle group enum expansion** — added 4 values (FRONT_DELTS, SIDE_DELTS, REAR_DELTS, OBLIQUES). SHOULDERS kept as deprecated backwards-compat bucket. Zero DB migration required.
   - Proteus branch: `feature/gym-frontend-prep`, commit `b3234c0`
   - Verified: `mvn compile` + `mvn test` pass (40 tests, 4 Testcontainers Docker skips unrelated)
2. ✅ **Verified `/api/users/me` exists** — `GET` + `PUT` in `iam/infrastructure/adapters/in/web/UserController.java`. Both accept authenticated principal, return `UserResponse` (mapped). Phase 2 unblocked.
3. ✅ **Verified auth endpoints shape** — `AuthResponse = {token, refreshToken, email, role}`. Refresh flow exists (`POST /api/auth/refresh`). Contract matches what gym-front skeleton expects.

**Backend deps**: None new — this IS the backend prep.

**Definition of Done**:
- [x] Muscle enum expanded (23 values total)
- [x] JavaDoc explains SHOULDERS deprecation + preferred alternatives
- [x] `mvn compile` passes
- [x] All non-Docker tests pass
- [x] Committed + pushed to `feature/gym-frontend-prep` branch (Proteus repo)
- [x] gym-front PLAYBOOK §8 + §11 updated with ✅ DONE status
- [x] gitignore updated to exclude `graphify-out/` (was accidentally staged)

**NOT done in this phase** (deliberately deferred):
- Dual role (`Set<UserRole>` + `COACH`) — big change with migration. Do closer to Phase 6b.
- Chat module — big scope. Do at Phase 4.5 when frontend is ready.
- Notifications outbound worker — same, at Phase 4.5.
- Capabilities endpoint — nice-to-have, do when Phase 5+ needs it.

---

### PHASE 0 — Foundation validation

**Goal**: Prove the skeleton talks to real Proteus end-to-end.

**Preconditions**:
- [ ] Proteus dev backend running (`mvn spring-boot:run` on `../Shoppify-api-2`)
- [ ] Test user created in Proteus with role OWNER or MANAGER for your tenant
- [ ] You know your tenant slug (query `SELECT slug FROM organizations WHERE id = <your_org_id>;`)

**Deliverables**:
1. `environment.ts` updated with real `apiUrl` + `tenantSlug`
2. `npm start` opens login page, you can log in with test user, land on shell placeholder
3. Shell placeholder shows correct role + tenant + user email from JWT
4. Reload the page — session persists (localStorage/Preferences working)
5. Kill Proteus mid-session, do a request — error toast appears (GlobalErrorHandler working)
6. Restart Proteus — refresh flow retries and works

**Backend deps**: None new — endpoints already exist.

**Definition of Done**:
- [ ] Login flow tested manually on `npm start` (web)
- [ ] Login flow tested on iOS simulator (via `npx cap open ios`)
- [ ] Login flow tested on Android emulator (via `npx cap open android`)
- [ ] Refresh token flow verified (wait until JWT expires or force it)
- [ ] Commit: `chore(config): wire real Proteus dev + tenant slug`
- [ ] PLAYBOOK.md §12 updated with real values

**Risks**:
- Refresh token may not work if Proteus doesn't emit `refreshToken` — verify + adjust
- CORS: Proteus dev may need to whitelist `http://localhost:4200`
- If tenant slug is wrong → all requests 404. First test = smallest signal.

---

### PHASE 1 — Home mock + design tokens + first shared UI

**Goal**: Prove the design system pattern works. Home dashboard renders skeleton, empty, error states — all three mandatory.

**Preconditions**:
- [ ] Phase 0 done
- [ ] Rough brand color chosen (hex — can be tweaked later)

**Deliverables**:
1. `shared/ui/tokens.scss` — CSS custom properties (colors, spacing, radius, typography)
2. `shared/ui/gym-empty-state/` — component with icon + title + subtitle + optional CTA
3. `shared/ui/gym-stat-tile/` — component for "streak: 5 days", "workouts this week: 3"
4. `shared/ui/gym-button/` — wrapper of ion-button with our variants (primary/secondary/ghost/danger)
5. `features/home/home.page.ts` — dashboard with:
   - Greeting ("Hola {firstName}")
   - Streak stat tile (mock data: `signal(5)`)
   - Next class card (mock: "Yoga 18:00")
   - Recent activity list (mock: last 3 workouts)
   - Loading state (skeletons matching each block)
   - Empty state ("Aún no tenés actividad — creá tu primera rutina")
   - Error state
6. Shell tabs updated: Inicio / Rutinas / Reservas / Perfil (icons placeholder)
7. Tab navigation working (each tab lazy-loads its route)

**Backend deps**: None (all data mocked).

**Definition of Done**:
- [ ] Home page renders correctly at 375px (iPhone SE), 390px (iPhone 14), 412px (Android)
- [ ] Design tokens documented (short list at top of `tokens.scss`)
- [ ] All 3 states (loading/empty/error) demoable via query param `?state=loading|empty|error`
- [ ] Dark mode toggles correctly (Ionic auto-applies via CSS)
- [ ] Lint + size + build clean
- [ ] Manual test iOS + Android + Web
- [ ] Commit: `feat(shared/ui): tokens + first 3 primitives + home dashboard mock`

**Risks**:
- Overengineering the design system early — resist. 3-4 primitives max in this phase. More come with real features.
- Tokens too opinionated too early — start with 8-10 values, expand as needed.

---

### PHASE 2 — Auth polish + Profile + Onboarding

**Goal**: Complete auth surface + user can set up their profile.

**Preconditions**:
- [ ] Phase 1 done
- [ ] Backend: `POST /api/auth/register` + `POST /api/auth/verify` tested (confirm email codes arrive)
- [ ] Backend: `GET /api/users/me` + `PUT /api/users/me` tested

**Deliverables**:

**2a. Auth pages**
1. `features/auth/register.page.ts` — signup form
2. `features/auth/verify.page.ts` — email code entry
3. `features/auth/forgot.page.ts` — password reset request
4. `features/auth/reset.page.ts` — new password entry from email link
5. Login page polished with new design tokens

**2b. Profile**
1. `features/profile/profile.page.ts` — view mode
2. `features/profile/profile-edit.page.ts` — edit mode (name, birthday, height, weight, phone)
3. `core/user/user-profile.service.ts` — TanStack query around `/api/users/me`
4. Avatar upload (Camera plugin + upload to backend)

**2c. Onboarding wizard** (`features/onboarding/`)
1. Multi-step wizard, one step per screen with progress dots
2. Steps: age → weight → height → objetivo (build muscle / lose weight / general fitness) → nivel (beginner / intermediate / advanced) → template pick (skip / pick from gym templates)
3. Persists partial state to Preferences so user can abandon and resume
4. Routes to home when complete

**Backend deps**:
- All auth endpoints ready
- `GET/PUT /api/users/me` (verify exists)
- Avatar upload endpoint — verify contract (multipart? base64? presigned URL?)

**Definition of Done**:
- [ ] New user can register from scratch → verify email → onboarding → land on home with profile complete
- [ ] Existing user can log in → sees profile filled
- [ ] Avatar upload tested on iOS + Android + Web
- [ ] Forgot password flow works end-to-end (backend sends email)
- [ ] Guest mode toggle works (skip login → limited view)
- [ ] All pages have loading/empty/error states
- [ ] Lint + size + build clean
- [ ] Commit series per sub-phase (2a, 2b, 2c)

**Risks**:
- Email verification requires SMTP configured in Proteus dev — may need mock
- Camera on web requires `@capacitor/pwa-elements` — install if not done
- Onboarding UX iterations — probably rework once with real users

---

### PHASE 3a — Backend prep: muscle groups enum

**Goal**: Backend team expands `MuscleGroup` enum from 8 to 18 values.

**Preconditions**:
- [ ] Backend team has capacity
- [ ] PR opened in Proteus repo with the enum expansion + Flyway migration

**Deliverables (backend team)**:
1. `training/domain/model/MuscleGroup.java` — 18 values (see PLAYBOOK §8)
2. Flyway migration V30 (or next) — re-tag seeded exercises to new values
3. New seed data for exercises without proper tags
4. `mvn test` passing

**Frontend deliverables**:
1. Update `features/routines/` types to import new enum values via generated types or manual mirror
2. Update `shared/ui/gym-body-heatmap/muscle-groups.ts` constant to match

**Definition of Done (frontend perspective)**:
- [ ] Proteus dev backend running with new enum
- [ ] Sample exercise fetched via API returns new enum values
- [ ] Frontend type sync verified

**Risks**: Backend team slow → blocks phase 3b/3d. Have a fallback plan (stub the enum on frontend if urgent).

---

### PHASE 3b — Routines armador (drag-drop)

**Goal**: User can create a routine from scratch or clone a gym template.

**Preconditions**:
- [ ] Phase 2 done
- [ ] Phase 3a done (muscle groups)
- [ ] Backend `GET /api/exercises` (curated library) returns 100+ exercises with muscle tags

**Deliverables**:
1. `features/routines/routines.routes.ts` — routes for list + editor + template gallery
2. `features/routines/routines.api.ts` — CRUD wrapper around ApiClient
3. `features/routines/routines-list.page.ts` — user's routines + "Create new" + "Gym templates"
4. `features/routines/routine-editor.page.ts` — drag-drop builder
5. `features/routines/components/exercise-picker/` — search + filter by muscle group
6. `features/routines/components/routine-block/` — one exercise or superset block
7. `features/routines/components/superset-editor/` — group exercises via `supersetGroupId`
8. Save/rename/delete/duplicate routine
9. Clone gym template as personal routine

**Backend deps**: TRAINING module (verified implemented — 108 files). Confirm endpoints:
- `GET /api/routines?scope=mine|template`
- `POST /api/routines`
- `PUT /api/routines/:id`
- `DELETE /api/routines/:id`
- `GET /api/exercises?muscle=CHEST&equipment=BARBELL`

**Definition of Done**:
- [ ] Create routine from scratch works
- [ ] Add 5 exercises, mark 2 as superset — persists correctly
- [ ] Reorder exercises via drag-drop
- [ ] Clone template → shows as mine
- [ ] All CRUD tested
- [ ] Offline: view existing routine works, edit queues (this is a preview of phase 6c strategy)
- [ ] Lint + size + build clean
- [ ] Manual test iOS + Android + Web

**Risks**: Drag-drop on mobile can be finicky — test HAPTICS + touch behavior extensively.

---

### PHASE 3c — Routines tracker + rest timer + notes

**Goal**: User can execute a routine, log sets with ghost values, timer between sets.

**Preconditions**:
- [ ] Phase 3b done
- [ ] Backend `GET /api/routines/:id/prepare-session` returns ghost data from last session

**Deliverables**:
1. `features/routines/tracker.page.ts` — active session UI
2. Ghost values: previous session's weight/reps as grey placeholder
3. Rest timer service (`features/routines/rest-timer/`)
   - Countdown with presets 30/60/90/120s + custom
   - Vibration on completion (@capacitor/haptics)
   - Local notification if app in background (@capacitor/local-notifications)
   - Audio cue last 3s (@capacitor-community/native-audio)
   - Auto-skip in supersets, rest only after block
4. Cronómetro (separate from rest timer — counts up)
5. Notes per exercise + per session
6. Complete session → save + celebration sound + redirect to summary
7. Session summary: total sets, PRs achieved, muscles worked heatmap

**Backend deps**:
- `POST /api/workouts` (save completed session)
- `GET /api/routines/:id/prepare-session` (ghost data)
- Session includes muscle group aggregation (or compute client-side)

**Definition of Done**:
- [ ] Full routine execution end-to-end (start → tracker → save → summary)
- [ ] Rest timer works with app in background (notification appears)
- [ ] Ghost values render + override works
- [ ] Notes persist per session
- [ ] Superset rest behavior correct (skip inside block)
- [ ] Offline: log session without connection, queues, sends on reconnect
- [ ] Lint + size + build clean
- [ ] Real gym test: use it for one workout yourself

**Risks**: Background timer on iOS is tricky — validate early. Rest timer accuracy is critical UX.

---

### PHASE 3d — Progress + charts + body heatmap

**Goal**: User sees historical progress + weekly muscle balance heatmap.

**Preconditions**:
- [ ] Phase 3c done (need workout data)
- [ ] Body heatmap SVG designed (stylized front + back silhouette with 18 muscle groups as separate paths)

**Deliverables**:
1. `features/progress/progress.page.ts` — overview
2. `shared/ui/gym-body-heatmap/` — reusable component consuming `Record<MuscleGroup, number>`
3. `features/progress/components/weight-chart/` — chart.js line chart per exercise
4. `features/progress/components/volume-chart/` — weekly total volume
5. `features/progress/components/prs-timeline/` — timeline of personal records
6. `features/progress/components/measurements/` — body weight + measurements log
7. Photos progress side-by-side (Camera plugin, gallery view)

**Backend deps**:
- `GET /api/progress/prs` — user's personal records
- `GET /api/progress/exercise/:id/history` — set data over time
- `GET /api/progress/muscle-week` — aggregated muscle group volume (or compute client-side)
- `POST /api/measurements` — log body measurements

**Definition of Done**:
- [ ] Body heatmap colors correctly reflect week's sets
- [ ] Tap on muscle group drills to exercises that worked it
- [ ] Charts render correctly at all breakpoints
- [ ] PRs highlight new records with 🏆 icon
- [ ] Photos progress: capture + save + view side-by-side
- [ ] Lint + size + build clean

**Risks**: Body heatmap SVG is a design deliverable — either DIY (Figma 2-4h) or freelance ($50-100).

---

### PHASE 3e — Calendar personal

**Goal**: User sees their agenda (booked classes + planned workouts).

**Preconditions**:
- [ ] Phase 3c done (workouts logged)

**Deliverables**:
1. `features/calendar/calendar.page.ts` — month view with dots for activity
2. Day drill: shows classes + workouts for that day
3. Long-press date → "Plan workout for this day"
4. Sync with device calendar (optional — @capacitor/calendar community plugin)

**Backend deps**: Uses existing routine + workout endpoints.

**Definition of Done**:
- [ ] Month view renders 90 days back + 30 forward
- [ ] Tap date → day detail
- [ ] Historical days show ✓ / ✗ / empty
- [ ] Lint + size + build clean

---

### PHASE 4a — Bookings + QR/GPS check-in

**Goal**: User reserves a class from a list, checks in at the gym via GPS or QR.

**Preconditions**:
- [ ] Phase 2 done (need auth)
- [ ] Backend `SCHEDULING` module active in your tenant

**Deliverables**:
1. `features/bookings/bookings.routes.ts`
2. `features/bookings/classes-list.page.ts` — upcoming classes filterable by day/type
3. `features/bookings/class-detail.page.ts` — description + coach + spots left + book
4. `features/bookings/my-bookings.page.ts` — reservas activas + cancelar
5. Check-in service (`features/bookings/check-in/`)
   - Try geolocation first (silent) → within 50m of gym coords → auto check-in
   - Fallback: QR scanner button → @capacitor-mlkit/barcode-scanning
6. Waitlist support if `spots-left = 0`

**Backend deps**: SCHEDULING module (verified implemented). Endpoints:
- `GET /api/appointments/available?date=...`
- `POST /api/appointments` (book)
- `DELETE /api/appointments/:id` (cancel)
- `POST /api/checkin` (check-in via GPS/QR)

**Definition of Done**:
- [ ] Book class → appears in my-bookings
- [ ] Cancel class → confirmation + removes
- [ ] Check-in via GPS works within 50m
- [ ] Check-in via QR fallback works
- [ ] Membership-required classes show gate ("Requiere membresía activa")
- [ ] Lint + size + build clean

---

### PHASE 4b — Membership + Mercado Pago

**Goal**: User sees their plan, next billing, can renew/upgrade via MP.

**Preconditions**:
- [ ] Phase 2 done
- [ ] Backend `MEMBERSHIP` + `PAYMENTS` modules active
- [ ] Mercado Pago sandbox credentials configured in Proteus

**Deliverables**:
1. `features/membership/membership.page.ts` — current plan + next billing + invoices history
2. `features/membership/plans.page.ts` — available plans to upgrade to
3. Checkout flow: click "Contratar" → Mercado Pago Checkout (via `@capacitor/browser` for redirect)
4. Payment success/failure return routes
5. Invoice PDF download

**Backend deps**: MEMBERSHIP verified implemented. Endpoints:
- `GET /api/memberships/me`
- `GET /api/membership-plans`
- `POST /api/subscribe` (creates MP preference URL)
- Webhook for MP payment confirmation (backend handles)

**Definition of Done**:
- [ ] View current plan
- [ ] View invoice history
- [ ] Subscribe to new plan → MP flow completes → membership activated
- [ ] Failed payment shows correct message
- [ ] Lint + size + build clean

**Risks**: MP integration testing needs real card in sandbox. Follow Proteus MP docs.

---

### PHASE 4c — Events + rankings + announcements

**Goal**: User sees gym announcements + can participate in events with leaderboards.

**Preconditions**:
- [ ] Phase 2 done
- [ ] Backend: confirm Event/Announcement entity exists or needs creating

**Deliverables**:
1. `features/events/events.page.ts` — active + upcoming events
2. `features/events/event-detail.page.ts` — description + participants + leaderboard
3. `features/events/leaderboard.component.ts` — reusable ranking table (used in feed too)
4. `features/announcements/` — feed of gym announcements (may fold into feed later)

**Backend deps**: SOCIAL has `LeaderboardEntry` + `ExerciseRanking`. Confirm Event entity or design collaboratively.

---

### PHASE 4.5 — Real-time infra port (backend + frontend)

**Goal**: WebSocket infrastructure live in Proteus + Frontend has SocketService.

**Preconditions**:
- [ ] Backend team ready to port from ticket-orchestrator
- [ ] Access to ticket-orchestrator repo for pattern reference

**Deliverables (backend)**:
1. New Proteus module `modules/chat/` with entities (Message, Conversation, Participant, MessageStatus)
2. New Proteus module `modules/notifications/` with Outbox pattern
3. `WebSocketConfig` — `@EnableWebSocketMessageBroker`, endpoints `/ws`, `ChannelInterceptor` with JWT auth
4. `EventPublisher` port + WebSocket adapter with `afterCommit` transaction sync
5. `OutboundMessageWorker` port from ticket-orchestrator (virtual threads + semaphore + drain)
6. `TypingBroadcastService` port
7. Testing: `WebSocketStompClient` integration tests

**Deliverables (frontend)**:
1. `core/realtime/socket.service.ts` — STOMP client wrapper (via `@stomp/stompjs`)
2. Auto-reconnect + backoff + JWT re-auth on reconnect
3. Subscription pattern (feature subscribes to topic, gets cleanup)
4. Presence tracker (in-memory for now, TODO for Redis when scaling)

**Backend deps**: Nothing new (this IS the backend prep).

**Definition of Done**:
- [ ] Frontend can connect to WS with JWT
- [ ] Publish event from backend, frontend receives via subscription
- [ ] Reconnection works (disconnect network, reconnect, subscriptions resume)
- [ ] Push notification via outbound worker sends real FCM/APNs
- [ ] Lint + size + build clean (both projects)

**Risks**: STOMP config auth is critical — don't skip the `ChannelInterceptor`. Public broker = security nightmare.

---

### PHASE 5a — Feed + comments + likes + share workout

**Goal**: User sees timeline of gym activity, interacts with posts, shares workouts.

**Preconditions**:
- [ ] Phase 2 done
- [ ] Backend SOCIAL active

**Deliverables**:
1. `features/feed/feed.page.ts` — infinite scroll timeline
2. `features/feed/post-composer.component.ts` — text + optional image
3. `features/feed/post-card.component.ts` — post + like button + comment count
4. `features/feed/post-detail.page.ts` — post + comments thread
5. `shared/ui/gym-track-badge/` — Spotify preview badge (used in posts + PRs)
6. Auto-post from workout: when user completes routine → optional "share to feed" toggle

**Backend deps**: SOCIAL verified. Endpoints:
- `GET /api/posts` (paginated feed)
- `POST /api/posts` (create)
- `POST /api/posts/:id/likes` / DELETE
- `POST /api/posts/:id/comments`
- Auto-post from workout uses `sourceModule/sourceEventId` fields already in `SocialPost`

**Definition of Done**:
- [ ] Feed loads 20 latest, infinite scroll works
- [ ] Post from workout → auto-post appears
- [ ] Like/unlike optimistic (updates immediately)
- [ ] Comments thread works
- [ ] Share workout to external (WhatsApp/IG) via `@capacitor/share`
- [ ] Lint + size + build clean

---

### PHASE 5b — Chat DMs

**Goal**: 1:1 real-time messaging between users.

**Preconditions**:
- [ ] Phase 4.5 done (WS infra + backend chat module)

**Deliverables**:
1. `features/chat/chat-list.page.ts` — list of conversations
2. `features/chat/chat-thread.page.ts` — message thread with virtual scroll
3. `features/chat/composer.component.ts` — text input + send + optional image attach
4. `features/chat/typing-indicator.component.ts` — subscribes to typing topic
5. Message states: PENDING (grey clock) → SENT (single tick) → DELIVERED (double tick) → READ (blue double)
6. Offline queue: messages typed offline saved locally, sent on reconnect
7. Notifications on new messages (via push infra from 5c)

**Backend deps**: Chat module from 4.5. Endpoints:
- `GET /api/conversations`
- `POST /api/conversations` (start with user)
- `GET /api/conversations/:id/messages?before=...`
- `POST /api/conversations/:id/messages`
- WebSocket topic `/topic/dm/{gymSlug}/{conversationId}`
- WebSocket topic `/topic/user/{userId}/inbox` (new conversations)

**Definition of Done**:
- [ ] Send message → other user receives in <1s
- [ ] Typing indicator works both directions
- [ ] Read receipts update
- [ ] Offline compose queues, sends on reconnect
- [ ] Push notification arrives if app closed
- [ ] Lint + size + build clean

**Risks**: WebSocket reconnection edge cases (app backgrounded on iOS gets killed, then resumed).

---

### PHASE 5c — Push notifications (FCM + APNs)

**Goal**: User receives push for: new message, class reminder, class waitlist opened, PR celebration.

**Preconditions**:
- [ ] Phase 4.5 done (outbox worker in backend)
- [ ] Firebase project created + FCM configured
- [ ] Apple Developer account + APNs certificates configured

**Deliverables**:
1. `core/push/push.service.ts` — request permission + register token
2. Backend endpoint `POST /api/push-tokens` to store user's device tokens
3. Consent screen before native permission prompt (better acceptance rate)
4. Push handler: tap notification → deep link to relevant screen
5. Backend triggers via `NotificationOutbox` for each event

**Backend deps**: Outbox from 4.5 + FCM/APNs client library configured.

**Definition of Done**:
- [ ] Register push token succeeds on iOS + Android
- [ ] Send test push from backend → arrives in <10s
- [ ] Tap push → opens correct screen
- [ ] Notification preferences (Settings) can toggle categories
- [ ] Lint + size + build clean

---

### PHASE 5d — Spotify V2 (correlation + tag)

**Goal**: Users see songs correlated with PRs (if Spotify connected) OR tag songs manually (all users).

**Preconditions**:
- [ ] Backend has `spotify` integration module with OAuth proxy
- [ ] Spotify Developer app created (Client ID + Secret in Proteus config)

**Deliverables (backend)**:
1. `modules/integrations/spotify/` — OAuth flow endpoints + listening_history table + background sync
2. Correlation endpoint `GET /api/progress/prs/:prId/soundtrack`
3. Catalog search proxy `GET /api/spotify/search?q=...` (Client Credentials)

**Deliverables (frontend)**:
1. `features/integrations/spotify/` — connect/disconnect flow
2. `shared/ui/gym-track-badge/` — display + play 30s preview + open in Spotify
3. PR list shows correlated track (or empty if no Spotify data)
4. Tag manually flow in post composer + PR detail

**Definition of Done**:
- [ ] Connect Spotify OAuth works
- [ ] After sync, PR shows correlated track
- [ ] 30s preview plays in-app
- [ ] Manual tag search + select works for non-Spotify users
- [ ] Lint + size + build clean

---

### PHASE 6a — Backend prep: dual role + COACH

**Goal**: Backend supports users with multiple roles.

**Deliverables (backend team)**:
1. Add `COACH` to `UserRole` enum
2. `User.role: UserRole` → `User.roles: Set<UserRole>`
3. JWT payload emits `roles: string[]`
4. Flyway migration to backfill existing users
5. Endpoint to admin-assign COACH role to a user

**Frontend deliverables**:
1. Verify `SessionStore.setActiveRole()` works with real backend
2. Add role-switcher to Settings or profile menu

**Risks**: Migration must handle all existing users cleanly.

---

### PHASE 6b — Coach view

**Goal**: Coaches see assigned members, create/assign routines to them.

**Preconditions**:
- [ ] Phase 6a done
- [ ] User's roles include COACH

**Deliverables**:
1. Role toggle in profile/settings (only for users with multiple roles)
2. `features/coach/coach.routes.ts` — visible only if activeRole=COACH
3. `features/coach/my-students.page.ts` — assigned members list
4. `features/coach/student-detail.page.ts` — their progress + routines + notes
5. `features/coach/assign-routine.page.ts` — pick routine + assign to N students
6. Reuse `routines/editor` for coach-created routines (with `template: true` flag)

**Backend deps**: `CoachAssignment` entity verified in TRAINING.

**Definition of Done**:
- [ ] Coach sees only their assigned students
- [ ] Assign routine to student — student sees it in their routines list
- [ ] Toggle back to CUSTOMER role — coach tabs disappear
- [ ] Lint + size + build clean

---

### PHASE 6c — Offline durable strategy

**Goal**: 100% offline usage — routines cached, workouts logged offline, chat messages queued.

**Preconditions**:
- [ ] Phases 3c + 5b done (features to make offline-capable)

**Deliverables**:
1. `@capacitor-community/sqlite` installed + initialized
2. `core/offline/db.service.ts` — SQLite tables setup
3. `core/offline/mutation-queue.ts` — queue + retry on reconnect
4. `core/offline/sync-manager.ts` — listens `@capacitor/network` events
5. Feature-side: routines/tracker/chat use mutation queue for writes
6. "Sin conexión — modo offline" banner when disconnected
7. "Sincronizando..." indicator when replaying queue

**Backend deps**: Nothing new — same endpoints.

**Definition of Done**:
- [ ] Airplane mode on: log workout, compose chat message
- [ ] Airplane mode off: everything syncs within 30s
- [ ] Conflicts resolved (chat message from other user vs mine)
- [ ] Lint + size + build clean

**Risks**: Conflict resolution UX for rare edge cases.

---

### PHASE 6d — HealthKit + Google Fit

**Goal**: Read weight/HR/steps from OS + write workouts to OS.

**Preconditions**:
- [ ] Phase 3c done (workouts to write)

**Deliverables**:
1. `@perfood/capacitor-healthkit` + `@perfood/capacitor-google-fit` installed
2. `core/integrations/health.service.ts` — abstraction over both
3. Settings: opt-in "Conectar con Apple Health / Google Fit"
4. On workout complete: write to OS
5. Profile stats read weight from OS if available

**Backend deps**: None (reads/writes to OS, not Proteus).

**Definition of Done**:
- [ ] Permission granted → workouts appear in Apple Health / Google Fit
- [ ] Weight from OS pre-populates in progress screen
- [ ] Lint + size + build clean

---

### PHASE 7 — Pre-launch

**Goal**: Legal + assets + beta test + submit to stores.

**Preconditions**:
- [ ] All previous phases done
- [ ] Real content: onboarding illustrations, empty state icons, app icon
- [ ] Privacy policy + Terms of use texts drafted (self or lawyer)

**Deliverables**:
1. Screens: privacy policy, terms of use (Ionic ion-content with markdown)
2. Settings → Account → "Eliminar mi cuenta" flow + backend endpoint
3. Settings → Account → "Descargar mis datos" flow + backend endpoint
4. App icons all sizes (iOS + Android + PWA — use icon generator)
5. Splash screens all sizes
6. App Store Connect setup: description, screenshots, categories, age rating, App Privacy questionnaire
7. Google Play Console setup: description, screenshots, Data Safety section, content rating
8. TestFlight (iOS) + Internal Track (Android) — 5-10 beta testers
9. Fix critical bugs from beta
10. Submit for review

**Definition of Done**:
- [ ] Apple review approved
- [ ] Google review approved
- [ ] Public launch date set
- [ ] Monitoring set up (Sentry or similar)

---

## 3. Cross-phase constant work

These happen alongside every phase:

- **Design system grows** — each phase adds 1-3 primitives to `shared/ui/` as needed. Don't build ahead.
- **PLAYBOOK.md updates** — any scope/dep change updates PLAYBOOK immediately. Never let it drift.
- **Tests added as features stabilize** — no test-driven, but every phase ends with at least 1 integration test for the critical flow (e.g. "user can log a workout")
- **Backend coordination** — 3 checkpoints (phases 3a, 4.5, 6a) require backend team. Book those ahead.
- **Manual QA on real device** — end of each phase, test on real iOS + Android device (not just simulator).

---

## 4. Definition of Done — template per phase

Every phase-completion PR includes:

- [ ] All deliverables from the phase's list shipped
- [ ] Lint clean (`npm run lint`)
- [ ] Size ceilings respected (`npm run lint:size`)
- [ ] Build passes (`npm run build`)
- [ ] Manual test in web (npm start)
- [ ] Manual test on iOS simulator / Android emulator
- [ ] Manual test on at least 1 real device (per phase, not per commit)
- [ ] Loading + empty + error states rendered for every new page
- [ ] PLAYBOOK.md updated if any scope changed
- [ ] Commit(s) follow `type(scope): description` convention
- [ ] Phase entry in this doc marked ✅ with date

---

## 5. When to STOP and re-plan

If any of these happen, stop and update this doc + PLAYBOOK before continuing:

- Scope of a phase grew >30% mid-work
- New library added that wasn't in the stack matrix
- Backend contract changed (endpoint shape, JWT payload, etc.)
- Blocker discovered that pushes phase out by >1 week
- Feature needs to be added that wasn't in the playbook

Never let drift accumulate. Small correction now beats big rewrite later.
