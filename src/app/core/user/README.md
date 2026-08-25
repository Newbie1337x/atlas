# core/user

Home for the current-user profile — the data every feature reads
(displayName, avatarUrl, stats, preferences) beyond just the JWT claims.

## When to create files here

- `user-profile.service.ts` — TanStack Query around `GET /api/users/me`.
  Features consume `userProfile.query()` to render the current user
  everywhere without each feature re-fetching.
- `user-preferences.service.ts` — settings (units metric/imperial, dark
  mode, notification prefs). Persisted via `StorageService`.

## Rules

- `SessionStore` (in core/auth) owns AUTH claims (email, role, tenant).
- `UserProfileService` (here) owns DOMAIN profile data (name, avatar,
  onboarding progress, stats).
- Two different concerns → two different services. Don't merge them.

Empty for now. First file lands when a feature needs profile fields beyond
what the JWT carries.
