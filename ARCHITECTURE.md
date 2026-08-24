# Architecture — non-negotiables

Rules that keep this codebase from becoming what Gaia became before its refactor
(1150-LOC canvas.service, 1800-LOC canvas.component, 500-LOC facade over
5 sub-services, 2700-LOC builder.css). Each rule below is either **lint-enforced**
or **script-enforced** — so drift fails the build, not a code review.

Read this file BEFORE adding new code. If you're about to break a rule and
think you have a good reason, update this file first with the reason.

---

## 1. Three folders. That's the layer graph.

```
src/app/
├── core/       # cross-feature infra (auth, api, storage, http, tokens)
├── features/   # vertical slices — one folder per feature, self-contained
└── shared/     # cross-feature pure UI + utils (design system lives here later)
```

Import direction:

```
features  →  core, shared
shared    →  core            (no reverse, no cross-lateral)
core      →  (nothing local — only Angular / rxjs / npm)
```

**Never** import `features/foo` from `features/bar`. If foo and bar share
something, it belongs in `shared/` (UI/utility) or `core/` (infrastructure).
This is lint-enforced via `no-restricted-imports`.

---

## 2. File-size ceilings (enforced by `npm run lint:size`)

| Kind        | Warn | Fail |
|-------------|------|------|
| Service     | 120  | 180  |
| Component (.ts) | 180 | 250 |
| Route file  | 60   | 100  |
| Utility / pure fn | 150 | 200 |
| CSS/SCSS    | 300  | 500  |

When a file hits **warn**, look for the natural split before adding a line.
When it hits **fail**, the split is not optional — extract before the next PR.

Splits that always work:
- **Service → Store + Api + Service** (state, HTTP, orchestrator — see `core/auth/`)
- **Component → Container + Presenter** (data-fetch vs pure render)
- **Component → Component + sub-components** (extract each `@if`-guarded region)
- **CSS → multiple styleUrls[]** (Gaia lesson — one CSS per concern)

---

## 3. Components have ONE `<name>Config` bundle input, never loose `@Inputs`

The moment a component has 3 styling `@Input()`s, refactor to a single typed
config bundle:

```ts
// ❌ don't
readonly color   = input<string>();
readonly size    = input<string>();
readonly variant = input<string>();
readonly icon    = input<string>();

// ✅ do
readonly buttonConfig = input<ButtonConfig>({});
```

Adding a new prop then means adding a field to the interface. It NEVER means
adding a new `@Input`. This is the atom contract from Gaia (`CLAUDE.md → The
Atom Contract` in that repo). Copied into this project's spirit.

---

## 4. State only in signals. No RxJS state.

- `signal<T>()` + `computed()` + `effect()` for local state
- `injectQuery`/`injectMutation` (TanStack Query) for server state
- `BehaviorSubject` **never** in new code

Reason: signals are synchronous, cheaper for CD, and eliminate the "manual
subscribe/unsubscribe" leak surface that killed us in Gaia.

---

## 5. HTTP goes through `@core/api/ApiClient` (or `AuthApi` for auth-flow endpoints)

Never call `HttpClient` directly from features. Reasons:
- `Authorization` + `X-Tenant-ID` headers are added by the interceptor — direct
  calls bypass them and break silently.
- Base URL prepending is centralized.
- When we need to add retry / logging / caching, one place changes.

Features that need domain-specific endpoints wrap `ApiClient` in a feature
service (e.g. `features/bookings/bookings.api.ts`), NEVER inject `HttpClient`
themselves.

---

## 6. Feature module contract

Every feature under `features/<name>/` MUST have:

- `<name>.routes.ts` — the lazy-loaded routes, exported as `<name>Routes`
- One component per route (naming: `<name>.page.ts` for full pages,
  `<name>-<part>.component.ts` for sub-pieces)
- Optional: `<name>.api.ts`, `<name>.store.ts`, `<name>.service.ts`

The feature's public surface is the routes file only. No `index.ts` re-exports.
No component in feature A imports from feature B — enforced by lint.

---

## 7. No inline styles in templates

Same rule Gaia had after the refactor. Enforced via
`@angular-eslint/template/no-inline-styles`. `[style.prop]` bindings + `ngStyle`
allowed for dynamic styling. Static styling goes in the component's `styleUrl`.

---

## 8. TypeScript strict + `noPropertyAccessFromIndexSignature`

Already set in `tsconfig.json`. Prevents the `any` sprawl that Gaia had 108 of
before sweeping.

Never write `: any` outside of a documented escape hatch (like `ResolvedProps`
in Gaia). If you can't type it, spend 5 minutes typing it. Every `any` becomes
someone else's runtime bug.

---

## 9. Never touch the tree in place

Any function taking `T[]` and mutating it in place is banned. Copy, transform,
return. Same rule that consolidated the tree walkers in Gaia to
`libs/shared/models/canvas-tree.util.ts`. Prevents "why did this array change
under me" bugs that are unreplayable.

---

## 10. When you write code, ask yourself:

- Is this in the right layer? (`core` / `features` / `shared`)
- Does this file cross the size ceiling? Should it split NOW?
- Am I adding a fifth `@Input` — should I refactor to `Config`?
- Am I subscribing manually — should this be `injectQuery` or a signal?
- Am I calling `HttpClient` directly — should it go via `ApiClient`?
- Would a new contributor find this file starting from the routes?

If any answer is "no / yes / not sure" → refactor before shipping.

---

## Anti-patterns from Gaia (do NOT repeat)

| Anti-pattern                        | What Gaia paid                              | Prevention here                    |
|-------------------------------------|---------------------------------------------|------------------------------------|
| God service growing organically     | canvas.service.ts hit 1150 LOC              | File-size ceiling + preventive split |
| Facade pattern hiding sub-services  | BuilderStateService 500 LOC of forwarders   | AuthService kept thin (passthroughs are OK, orchestration only) |
| Hardcoded inspector blocks per type | inspector.html 1450 LOC of `@if type === X` | Schema-driven controls, never per-type template branches |
| Cross-feature imports               | shop/ui reached into studio/                | ESLint `no-restricted-imports` on `features/*` cross-refs |
| Ad-hoc widget with loose inputs     | 20+ atoms with 5-10 loose Inputs each       | `<name>Config` bundle rule (§3)  |
| Inline `style="…"`                  | 100+ inline styles across templates         | `no-inline-styles` lint (§7)     |
| One giant CSS file                  | builder.css hit 2686 LOC                    | CSS ceiling + `styleUrls[]` splits |
| BehaviorSubject state everywhere    | ~30 subjects, manual subscribe lifecycle    | Signals only (§4)                 |
| `any` type sprawl                   | 108 `any` warnings                          | strict tsc + `no-explicit-any` lint |

---

## What this repo intentionally does NOT do (yet)

- **No design tokens** — the visual pass is a separate deliverable
- **No unit tests** — Vitest is installed; tests land per-feature as features land
- **No native platforms added** — run `npx cap add ios/android` when ready
- **No SSR** — Ionic app doesn't benefit; skip
- **No i18n** — single-tenant single-locale for now; add when needed

When any of those changes, it's a deliberate decision, not a drift. Update this
file at the same PR.
