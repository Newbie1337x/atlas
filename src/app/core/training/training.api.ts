import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@core/auth/auth.tokens';
import { OffsetPage, RoutineFolder, RoutineSummary } from './training.model';

/**
 * HTTP endpoints for the TRAINING module — routines + folders that the
 * user owns. Endpoints only, zero caching / storage / side effects: pages
 * own that via TanStack Query (see training.keys.ts).
 *
 * Mirrors the AuthApi / UsersApi shape (HttpClient direct, base URL from
 * the environment token).
 */
@Injectable({ providedIn: 'root' })
export class TrainingApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * Paged summaries — first 20 by default. Backend orders by
   * (displayOrder ASC, updatedAt DESC) so drag-drop order persists.
   */
  listMyRoutines(offset = 0, size = 20): Observable<OffsetPage<RoutineSummary>> {
    const params = new HttpParams().set('offset', offset).set('size', size);
    return this.http.get<OffsetPage<RoutineSummary>>(
      `${this.baseUrl}/api/training/routines/me`, { params });
  }

  /** All folders owned by the caller — each carries a routineCount. */
  listFolders(): Observable<RoutineFolder[]> {
    return this.http.get<RoutineFolder[]>(`${this.baseUrl}/api/training/folders`);
  }
}
