import { Injectable, computed, signal } from '@angular/core';
import { CurrentUser, UserRole } from './auth.tokens';
import { decodeJwt, JwtPayload } from './jwt.util';

/**
 * Session state — signals only, no HTTP, no storage. Pure state holder so the
 * rest of the app has ONE authority to read `currentUser()` / `token()` from.
 *
 * Split from AuthService on purpose: state mutation (this file) vs orchestration
 * (auth.service.ts) vs I/O (auth.api.ts). Prevents the god-service pattern
 * that bit us in Gaia (BuilderStateService 500+ LOC).
 *
 * Never inject anything here. If a change needs HTTP or storage, it belongs in
 * the orchestrator, not this file.
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly _token       = signal<string | null>(null);
  private readonly _currentUser = signal<CurrentUser | null>(null);

  readonly token           = this._token.asReadonly();
  readonly currentUser     = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this._currentUser() !== null);

  /** Set the token + hydrated user derived from its JWT payload. */
  hydrate(token: string): boolean {
    const payload = decodeJwt<JwtPayload>(token);
    if (!payload) {
      this.clear();
      return false;
    }
    // Normalize single-role JWT (today) OR multi-role JWT (future) to a stable
    // array-shaped roles field. Consumers never care which shape backend sent.
    const roles: UserRole[] = payload.roles?.length ? payload.roles : [payload.role];

    this._token.set(token);
    this._currentUser.set({
      email:          payload.sub,
      userId:         payload.userId,
      organizationId: payload.organizationId,
      roles,
      activeRole:     roles[0],   // default active role — user toggles via setActiveRole
      modules:        payload.modules ?? [],
    });
    return true;
  }

  clear(): void {
    this._token.set(null);
    this._currentUser.set(null);
  }

  /** Switch active role (for dual-role users like coach+customer). Noops if not in roles. */
  setActiveRole(role: UserRole): void {
    this._currentUser.update((u) => {
      if (!u?.roles.includes(role)) return u;
      return { ...u, activeRole: role };
    });
  }

  /** True when the user has ANY of the given roles across ALL their granted roles. */
  hasRole(...roles: string[]): boolean {
    const granted = this._currentUser()?.roles ?? [];
    return granted.some((r) => roles.includes(r));
  }

  /** True when the user's currently ACTIVE role matches any of the given. */
  isActiveRole(...roles: string[]): boolean {
    const active = this._currentUser()?.activeRole;
    return !!active && roles.includes(active);
  }

  hasModule(module: string): boolean {
    return this._currentUser()?.modules.includes(module) ?? false;
  }
}
