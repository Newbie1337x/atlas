import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, timeout } from 'rxjs';
import { API_BASE_URL } from '@core/auth/auth.tokens';

/** Ceiling for any single HTTP request. Prevents infinite hangs on flaky
 *  mobile networks — user gets a "sin conexión" toast via the ErrorHandler
 *  instead of a spinner that never resolves. */
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Thin wrapper over HttpClient. Features MUST use this instead of injecting
 * HttpClient directly (lint-enforced). Handles for free:
 *   - Base URL prepending  (paths written as `/api/foo`)
 *   - 30s timeout          (kill zombie requests on bad signal)
 *   - Auth + tenant headers via authInterceptor (registered in app.config)
 *   - HttpErrorResponse → HttpError transformation via errorTransformInterceptor
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http    = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  get<T>(path: string, params?: Record<string, string | number | boolean>): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}${path}`, { params: this.toParams(params) }).pipe(timeout(REQUEST_TIMEOUT_MS));
  }
  post<T>  (path: string, body: unknown): Observable<T> { return this.http.post  <T>(`${this.baseUrl}${path}`, body).pipe(timeout(REQUEST_TIMEOUT_MS)); }
  put<T>   (path: string, body: unknown): Observable<T> { return this.http.put   <T>(`${this.baseUrl}${path}`, body).pipe(timeout(REQUEST_TIMEOUT_MS)); }
  patch<T> (path: string, body: unknown): Observable<T> { return this.http.patch <T>(`${this.baseUrl}${path}`, body).pipe(timeout(REQUEST_TIMEOUT_MS)); }
  delete<T>(path: string):                Observable<T> { return this.http.delete<T>(`${this.baseUrl}${path}`      ).pipe(timeout(REQUEST_TIMEOUT_MS)); }

  private toParams(input?: Record<string, string | number | boolean>): HttpParams | undefined {
    if (!input) return undefined;
    let params = new HttpParams();
    for (const [k, v] of Object.entries(input)) {
      if (v !== undefined && v !== null) params = params.set(k, String(v));
    }
    return params;
  }
}
