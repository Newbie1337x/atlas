import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@core/auth/auth.tokens';
import { UserProfile } from './user.model';

/**
 * HTTP endpoints for the current-user's own profile record. Follows the
 * AuthApi pattern — endpoints only, zero state / storage / side effects.
 * Consumers (pages / TanStack Query hooks) own caching + invalidation.
 */
@Injectable({ providedIn: 'root' })
export class UsersApi {
  private readonly http    = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  getMe(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.baseUrl}/api/users/me`);
  }

  /**
   * Unlink an external provider. Backend refuses with 422 when this would
   * leave the account with no way to log in (no password, no other identity).
   */
  unlinkIdentity(provider: string): Observable<UserProfile> {
    return this.http.delete<UserProfile>(`${this.baseUrl}/api/users/me/identities/${provider}`);
  }
}
