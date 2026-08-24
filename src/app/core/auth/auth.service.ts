import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, of, switchMap, tap, throwError } from 'rxjs';
import { StorageService } from '@core/storage/storage.service';
import { API_BASE_URL, AUTH_STORAGE_KEYS, CurrentUser } from './auth.tokens';
import { decodeJwt, isJwtExpired, JwtPayload, LoginResponse } from './jwt.util';

/**
 * Session authority for the gym app.
 * - Persists tokens in Capacitor Preferences (native secure store on iOS/Android,
 *   localStorage on web).
 * - Exposes the current user as signals so components read state reactively.
 * - Has a `refresh()` hook wired to `/auth/refresh` — backend endpoint may not
 *   exist yet; call is a noop when refreshToken is absent.
 *
 * Boot sequence: call `restore()` from app initializer BEFORE the router runs
 * so guards see the persisted session on cold app start.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http    = inject(HttpClient);
  private readonly storage = inject(StorageService);
  private readonly apiUrl  = inject(API_BASE_URL);

  // Reactive session state
  private readonly _token       = signal<string | null>(null);
  private readonly _currentUser = signal<CurrentUser | null>(null);

  readonly token           = this._token.asReadonly();
  readonly currentUser     = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this._currentUser() !== null);

  /**
   * Load persisted token from storage (if any) and hydrate the signals.
   * MUST run before the router boots — wire via APP_INITIALIZER in app.config.
   * Returns a resolved promise even on failure — never blocks app startup.
   */
  async restore(): Promise<void> {
    try {
      const token = await this.storage.get(AUTH_STORAGE_KEYS.accessToken);
      if (!token || isJwtExpired(token)) {
        await this.clearSession();
        return;
      }
      this.hydrate(token);
    } catch {
      await this.clearSession();
    }
  }

  login(email: string, password: string): Observable<CurrentUser> {
    return this.http
      .post<LoginResponse>(`${this.apiUrl}/api/auth/login`, { email, password })
      .pipe(
        switchMap((res) => from(this.acceptTokens(res)).pipe(switchMap(() => of(res)))),
        switchMap(() => {
          const u = this._currentUser();
          return u ? of(u) : throwError(() => new Error('AUTH_HYDRATION_FAILED'));
        }),
      );
  }

  /**
   * Refresh the access token using the stored refresh token.
   * Backend endpoint `POST /api/auth/refresh` is expected to accept
   * `{ refreshToken }` and return a fresh `LoginResponse`.
   * If no refresh token is stored (older backend), resolves as unauthenticated.
   */
  refresh(): Observable<CurrentUser | null> {
    return from(this.storage.get(AUTH_STORAGE_KEYS.refreshToken)).pipe(
      switchMap((rt) => {
        if (!rt) return of(null);
        return this.http
          .post<LoginResponse>(`${this.apiUrl}/api/auth/refresh`, { refreshToken: rt })
          .pipe(
            switchMap((res) => from(this.acceptTokens(res)).pipe(switchMap(() => of(this._currentUser())))),
          );
      }),
      tap({ error: () => this.logout() }),
    );
  }

  async logout(): Promise<void> {
    await this.clearSession();
  }

  /** True when the user has any of the given roles. Case-sensitive. */
  hasRole(...roles: string[]): boolean {
    const r = this._currentUser()?.role;
    return !!r && roles.includes(r);
  }

  /** True when the tenant has this module active (per JWT `modules` claim). */
  hasModule(module: string): boolean {
    return this._currentUser()?.modules.includes(module) ?? false;
  }

  // ── internal ─────────────────────────────────────────────────────────

  private async acceptTokens(res: LoginResponse): Promise<void> {
    await this.storage.set(AUTH_STORAGE_KEYS.accessToken, res.token);
    if (res.refreshToken) {
      await this.storage.set(AUTH_STORAGE_KEYS.refreshToken, res.refreshToken);
    }
    this.hydrate(res.token);
  }

  private hydrate(token: string): void {
    const payload = decodeJwt<JwtPayload>(token);
    if (!payload) {
      this._token.set(null);
      this._currentUser.set(null);
      return;
    }
    this._token.set(token);
    this._currentUser.set({
      email:          payload.sub,
      userId:         payload.userId,
      organizationId: payload.organizationId,
      role:           payload.role,
      modules:        payload.modules ?? [],
    });
  }

  private async clearSession(): Promise<void> {
    await this.storage.remove(AUTH_STORAGE_KEYS.accessToken);
    await this.storage.remove(AUTH_STORAGE_KEYS.refreshToken);
    this._token.set(null);
    this._currentUser.set(null);
  }
}
