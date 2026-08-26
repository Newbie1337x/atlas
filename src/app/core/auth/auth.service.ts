import { Injectable, inject } from '@angular/core';
import { Observable, from, of, switchMap, tap, throwError } from 'rxjs';
import { StorageService } from '@core/storage/storage.service';
import { AuthApi } from './auth.api';
import { SessionStore } from './session.store';
import { AUTH_STORAGE_KEYS, CurrentUser } from './auth.tokens';
import { isJwtExpired, LoginResponse } from './jwt.util';

/**
 * Orchestrator — wires SessionStore + AuthApi + StorageService into the
 * public API used by guards, interceptor and pages. Delegates state to
 * SessionStore and HTTP to AuthApi; owns nothing but the sequence.
 *
 * Public surface:
 *   restore(), login(), refresh(), logout()
 *   + convenience passthroughs to SessionStore (token, currentUser,
 *     isAuthenticated, hasRole, hasModule)
 *
 * If this file grows past ~150 LOC, split the new concern into its own
 * file BEFORE adding more (auth.policy.ts for permissions, auth.biometric.ts
 * for native biometric, etc.). Don't let it become a god.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api     = inject(AuthApi);
  private readonly session = inject(SessionStore);
  private readonly storage = inject(StorageService);

  // Passthroughs — components read state via AuthService without knowing about SessionStore
  readonly token           = this.session.token;
  readonly currentUser     = this.session.currentUser;
  readonly isAuthenticated = this.session.isAuthenticated;

  hasRole   = (...roles: string[]) => this.session.hasRole(...roles);
  hasModule = (module: string)     => this.session.hasModule(module);

  /**
   * Hydrate the session from persistent storage. MUST run via APP_INITIALIZER
   * before the router boots so guards see the persisted state on cold start.
   */
  async restore(): Promise<void> {
    try {
      const token = await this.storage.get(AUTH_STORAGE_KEYS.accessToken);
      if (!token || isJwtExpired(token)) {
        await this.clearSession();
        return;
      }
      this.session.hydrate(token);
    } catch {
      await this.clearSession();
    }
  }

  login(email: string, password: string): Observable<CurrentUser> {
    return this.api.login(email, password).pipe(
      switchMap((res) => from(this.acceptTokens(res)).pipe(switchMap(() => of(res)))),
      switchMap(() => {
        const u = this.currentUser();
        return u ? of(u) : throwError(() => new Error('AUTH_HYDRATION_FAILED'));
      }),
    );
  }

  refresh(): Observable<CurrentUser | null> {
    return from(this.storage.get(AUTH_STORAGE_KEYS.refreshToken)).pipe(
      switchMap((rt) => {
        if (!rt) return of(null);
        return this.api.refresh(rt).pipe(
          switchMap((res) => from(this.acceptTokens(res)).pipe(switchMap(() => of(this.currentUser())))),
        );
      }),
      tap({ error: () => { void this.logout(); } }),
    );
  }

  async logout(): Promise<void> {
    await this.clearSession();
  }

  /**
   * External-issue path: the tokens were minted by Proteus's OAuth2 success
   * handler (Google/Facebook login) and delivered to the frontend via query
   * params on the /auth/oauth-callback route — no /api/auth/login roundtrip.
   *
   * Kept as its own method (not a public alias for acceptTokens) so callers
   * can't sneak arbitrary LoginResponse shapes in — the only external-token
   * source is the OAuth callback route.
   */
  async acceptExternalTokens(accessToken: string, refreshToken: string): Promise<CurrentUser | null> {
    // email/role come along in the callback URL but SessionStore derives the
    // canonical values from the JWT payload — we don't need them for state,
    // only the tokens themselves need to be persisted.
    await this.acceptTokens({ token: accessToken, refreshToken, email: '', role: '' });
    return this.currentUser();
  }

  private async acceptTokens(res: LoginResponse): Promise<void> {
    await this.storage.set(AUTH_STORAGE_KEYS.accessToken, res.token);
    if (res.refreshToken) {
      await this.storage.set(AUTH_STORAGE_KEYS.refreshToken, res.refreshToken);
    }
    this.session.hydrate(res.token);
  }

  private async clearSession(): Promise<void> {
    await this.storage.remove(AUTH_STORAGE_KEYS.accessToken);
    await this.storage.remove(AUTH_STORAGE_KEYS.refreshToken);
    this.session.clear();
  }
}
