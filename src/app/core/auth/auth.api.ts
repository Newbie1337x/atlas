import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './auth.tokens';
import { LoginResponse } from './jwt.util';

/**
 * HTTP endpoints for auth. ONLY endpoints — no state, no storage, no side
 * effects beyond the network call. The orchestrator (auth.service.ts) wires
 * results into SessionStore + StorageService.
 *
 * Adding a new auth endpoint (register, forgot-password, verify-otp, 2FA):
 *   → add ONE method here.
 * DO NOT add business logic — that goes in AuthService.
 */
@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http    = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/api/auth/login`, { email, password });
  }

  refresh(refreshToken: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/api/auth/refresh`, { refreshToken });
  }
}
