import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@core/auth/auth.tokens';
import { OffsetPage } from '@core/pagination.model';
import {
  CatalogExercise, ExerciseInputPreference, InputPreferenceRequest,
} from './exercise.model';
import { RoutineFolder, RoutineFolderRequest } from './folder.model';
import {
  CreateRoutineRequest, RoutineDetail, RoutineSummary, UpdateRoutineRequest,
} from './routine.model';

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

  /** Full detail: nested exercises + sets. Backing GET /routines/{id}. */
  getRoutine(id: number): Observable<RoutineDetail> {
    return this.http.get<RoutineDetail>(`${this.baseUrl}/api/training/routines/${id}`);
  }

  // --- Mutations. Consumers invalidate ['training'] on success ---

  createFolder(body: RoutineFolderRequest): Observable<RoutineFolder> {
    return this.http.post<RoutineFolder>(`${this.baseUrl}/api/training/folders`, body);
  }

  updateFolder(id: number, body: RoutineFolderRequest): Observable<RoutineFolder> {
    return this.http.put<RoutineFolder>(`${this.baseUrl}/api/training/folders/${id}`, body);
  }

  deleteFolder(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/api/training/folders/${id}`);
  }

  createRoutine(body: CreateRoutineRequest): Observable<unknown> {
    // Backend returns the enriched RoutineResponse but this endpoint's
    // consumers only care that it succeeded — the training list refetches.
    return this.http.post<unknown>(`${this.baseUrl}/api/training/routines`, {
      ...body,
      exercises: body.exercises ?? [],
    });
  }

  deleteRoutine(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/api/training/routines/${id}`);
  }

  updateRoutine(id: number, body: UpdateRoutineRequest): Observable<RoutineDetail> {
    return this.http.put<RoutineDetail>(`${this.baseUrl}/api/training/routines/${id}`, body);
  }

  /** Server-side deep copy — used by "duplicar rutina". Returns the new routine. */
  cloneRoutine(id: number): Observable<RoutineDetail> {
    return this.http.post<RoutineDetail>(`${this.baseUrl}/api/training/routines/${id}/clone`, {});
  }

  /** Full catalog for the current tenant. Small enough (~a few hundred rows)
   *  that client-side filter beats a search endpoint round-trip. */
  listExercises(): Observable<CatalogExercise[]> {
    return this.http.get<CatalogExercise[]>(`${this.baseUrl}/api/training/exercises`);
  }

  // --- Per-exercise input preference (KG vs BRICKS + brick weight) ---
  // globalProfileId is inferred from the JWT server-side.

  /** null = the user never chose (client should default to KG on machines). */
  getInputPreference(exerciseId: number): Observable<ExerciseInputPreference | null> {
    return this.http.get<ExerciseInputPreference | null>(
      `${this.baseUrl}/api/training/exercises/${exerciseId}/input-preference`);
  }

  putInputPreference(
    exerciseId: number, body: InputPreferenceRequest,
  ): Observable<ExerciseInputPreference> {
    return this.http.put<ExerciseInputPreference>(
      `${this.baseUrl}/api/training/exercises/${exerciseId}/input-preference`, body);
  }
}
