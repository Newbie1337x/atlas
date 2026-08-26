import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL, DEFAULT_TENANT_SLUG } from './auth.tokens';
import { LoginResponse } from './jwt.util';

export interface RegisterRequest {
  firstName: string;
  lastName:  string;
  email:     string;
  password:  string;
}

/**
 * HTTP endpoints for auth. ONLY endpoints — no state, no storage, no side
 * effects beyond the network call. The orchestrator (auth.service.ts) wires
 * results into SessionStore + StorageService.
 *
 * Adding a new auth endpoint (2FA, magic link, biometric): add ONE method here.
 * DO NOT add business logic — that goes in AuthService.
 *
 * All endpoints return void by default when the backend responds 200 with
 * either no body or a body the frontend doesn't consume — the interceptor
 * still runs and HttpError still fires on non-2xx.
 */
@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http    = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly slug    = inject(DEFAULT_TENANT_SLUG);

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/api/auth/login`, { email, password });
  }

  refresh(refreshToken: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/api/auth/refresh`, { refreshToken });
  }

  register(dto: RegisterRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/api/auth/register`, dto);
  }

  /** Silent by design — backend returns 200 even for unknown emails to prevent enumeration. */
  forgotPassword(email: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/api/auth/forgot-password`, { email });
  }

  resetPassword(token: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/api/auth/reset-password`, { token, newPassword });
  }

  verifyEmail(token: string): Observable<void> {
    const params = new HttpParams().set('token', token);
    return this.http.get<void>(`${this.baseUrl}/api/auth/verify`, { params });
  }

  /**
   * Build the OAuth2 kickoff URL for the given provider. The tenant_slug
   * query param tells Proteus which organization to attach the new user to
   * (backend has OAUTH_DEFAULT_TENANT_SLUG as fallback, but explicit is safer).
   *
   * Caller does `window.location.href = url` — this is NOT an XHR, it's a
   * full-page redirect the OAuth flow requires.
   */
  oauthAuthorizeUrl(provider: 'google' | 'facebook'): string {
    return `${this.baseUrl}/oauth2/authorization/${provider}?tenant_slug=${encodeURIComponent(this.slug)}`;
  }
}
