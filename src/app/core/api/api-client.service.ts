import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@core/auth/auth.tokens';

/**
 * Thin wrapper over HttpClient that prepends the API base URL so features
 * write endpoints as `/api/foo` without repeating the origin.
 *
 * Auth headers (Bearer + X-Tenant-ID) are added automatically by the
 * authInterceptor registered in app.config.ts — DO NOT add them here.
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http    = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  get<T>(path: string, params?: Record<string, string | number | boolean>): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}${path}`, { params: this.toParams(params) });
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}${path}`, body);
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}${path}`, body);
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<T>(`${this.baseUrl}${path}`, body);
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}${path}`);
  }

  private toParams(input?: Record<string, string | number | boolean>): HttpParams | undefined {
    if (!input) return undefined;
    let params = new HttpParams();
    for (const [k, v] of Object.entries(input)) {
      if (v !== undefined && v !== null) params = params.set(k, String(v));
    }
    return params;
  }
}
