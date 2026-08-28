/**
 * Mirrors Proteus training DTOs. Field names track:
 *   - RoutineSummaryResponse.java
 *   - RoutineFolderResponse.java
 *   - RoutineResponse.java (detail — for the routine-detail page)
 *
 * Kept intentionally structural (interfaces) — no classes, no runtime logic.
 * If a shape drifts on the backend, tsc catches it at the api-layer boundary.
 */

export type RoutineOwnerType = 'MEMBER' | 'TEMPLATE' | 'COACH';

export interface ExercisePreview {
  exerciseId: number;
  name: string | null;
  iconUrl: string | null;
  supersetGroupId: string | null;
}

/** Card shape for /api/training/routines/me (paged). */
export interface RoutineSummary {
  id: number;
  organizationId: number;
  ownerType: RoutineOwnerType;
  ownerGlobalProfileId: number;
  title: string;
  /** null = loose at top level (rendered under the "Mis rutinas" label). */
  folderId: number | null;
  /** Position within the folder (or top-level loose bucket). */
  displayOrder: number;
  exercisePreviews: ExercisePreview[];
  totalExerciseCount: number;
  totalSetCount: number;
  /** null when the routine has zero exercises. */
  estimatedDurationMinutes: number | null;
}

export interface RoutineFolder {
  id: number;
  organizationId: number | null;
  ownerGlobalProfileId: number;
  name: string;
  displayOrder: number;
  createdAt: string;
  /** Populated by the backend enricher — number of routines currently in the folder. */
  routineCount: number;
}

/** Set type — mirrors backend SetType enum. */
export type SetType = 'WARMUP' | 'WORKING' | 'DROP' | 'FAILURE';

/** One set inside an exercise. Ranges + optional targets — see backend RoutineResponse.RoutineSetDto. */
export interface RoutineSet {
  id: number;
  orderIndex: number;
  setType: SetType;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  targetWeightKg: number | null;
  targetDurationSeconds: number | null;
  targetDistanceKm: number | null;
  targetRpe: number | null;
}

/** One exercise in a routine. */
export interface RoutineExercise {
  id: number;
  orderIndex: number;
  exerciseId: number;
  exerciseName: string | null;
  exerciseIconUrl: string | null;
  restSeconds: number | null;
  supersetGroupId: string | null;
  notes: string | null;
  sets: RoutineSet[];
}

/** Full routine detail (backend RoutineResponse) — used by GET /{id}. */
export interface RoutineDetail {
  id: number;
  organizationId: number;
  ownerType: RoutineOwnerType;
  ownerGlobalProfileId: number;
  sourceRoutineId: number | null;
  title: string;
  notes: string | null;
  folderId: number | null;
  displayOrder: number;
  exercises: RoutineExercise[];
}

/**
 * Payload for POST/PUT of a routine folder. Both fields optional on PUT
 * (null = leave as-is). On POST the backend requires a non-blank name.
 */
export interface RoutineFolderRequest {
  name?: string;
  displayOrder?: number;
}

/**
 * Minimal shape for creating a routine from the training list. Full editing
 * (exercises + sets) uses the same DTO on PUT — with the exercises array
 * populated — but that's the routine-editor page, not this slice.
 */
export interface CreateRoutineRequest {
  title: string;
  folderId?: number | null;
  displayOrder?: number;
  notes?: string;
  exercises?: never[];
}

/**
 * Full-body PUT for updating a routine. Backend requires title; everything
 * else is optional. Exercises follow the same shape as the response (minus
 * the enriched name/iconUrl which the server ignores on write).
 */
export interface UpdateRoutineRequest {
  title: string;
  notes?: string | null;
  folderId?: number | null;
  displayOrder?: number;
  exercises: Array<{
    orderIndex: number;
    exerciseId: number;
    restSeconds?: number | null;
    supersetGroupId?: string | null;
    notes?: string | null;
    sets: Array<{
      orderIndex: number;
      setType: SetType;
      targetRepsMin?: number | null;
      targetRepsMax?: number | null;
      targetWeightKg?: number | null;
      targetDurationSeconds?: number | null;
      targetDistanceKm?: number | null;
      targetRpe?: number | null;
    }>;
  }>;
}

/** Mirrors Proteus's shared OffsetPage<T> (NOT Spring's Page<T>). */
export interface OffsetPage<T> {
  items: T[];
  offset: number;
  size: number;
  totalCount: number;
  hasMore: boolean;
}
