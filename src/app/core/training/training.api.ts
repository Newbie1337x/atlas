import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of, throwError } from 'rxjs';
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

  /**
   * Metadata-only PATCH — title / notes / folderId / displayOrder.
   * Every field optional, null on server means "keep existing".
   * Cheap for rename + move + individual reorder without carrying
   * the whole exercise tree the full PUT requires.
   */
  patchRoutineMetadata(
    id: number,
    body: { title?: string; notes?: string | null; folderId?: number | null; displayOrder?: number },
  ): Observable<RoutineDetail> {
    return this.http.patch<RoutineDetail>(`${this.baseUrl}/api/training/routines/${id}`, body);
  }

  /**
   * Batch reorder every routine in a folder in one transaction.
   * folderId = null for the loose "Mis rutinas" bucket — encoded
   * server-side as path `/folder/0/order`. The server sets each
   * routine's displayOrder to its index in `routineIds`.
   */
  reorderRoutinesInFolder(folderId: number | null, routineIds: number[]): Observable<void> {
    const path = `${this.baseUrl}/api/training/routines/folder/${folderId ?? 0}/order`;
    return this.http.patch<void>(path, { routineIds });
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

  /** 404 = the user never chose (caller maps to null → default KG). */
  getInputPreference(exerciseId: number): Observable<ExerciseInputPreference | null> {
    return this.http.get<ExerciseInputPreference>(
      `${this.baseUrl}/api/training/exercises/${exerciseId}/input-preference/me`)
      .pipe(catchError((err: HttpErrorResponse) =>
        err.status === 404 ? of(null) : throwError(() => err)));
  }

  putInputPreference(
    exerciseId: number, body: InputPreferenceRequest,
  ): Observable<ExerciseInputPreference> {
    return this.http.put<ExerciseInputPreference>(
      `${this.baseUrl}/api/training/exercises/${exerciseId}/input-preference/me`, body);
  }
}
