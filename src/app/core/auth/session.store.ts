import { Injectable, computed, signal } from '@angular/core';
import { CurrentUser } from './auth.tokens';
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
    this._token.set(token);
    this._currentUser.set({
      email:          payload.sub,
      userId:         payload.userId,
      organizationId: payload.organizationId,
      role:           payload.role,
      modules:        payload.modules ?? [],
    });
    return true;
  }

  clear(): void {
    this._token.set(null);
    this._currentUser.set(null);
  }

  hasRole(...roles: string[]): boolean {
    const r = this._currentUser()?.role;
    return !!r && roles.includes(r);
  }

  hasModule(module: string): boolean {
    return this._currentUser()?.modules.includes(module) ?? false;
  }
}
