/**
 * Routine-side models for the TRAINING module — the routine tree itself
 * (routines, exercises, sets) plus its request DTOs.
 *
 * Folder models live in ./folder.model.ts. Pagination envelope in
 * @core/pagination.model — reused across every paginated endpoint.
 *
 * Field names track the backend DTOs 1:1:
 *   - RoutineSummaryResponse.java   → RoutineSummary
 *   - RoutineResponse.java          → RoutineDetail (nested exercises + sets)
 *   - RoutineRequest.java           → CreateRoutineRequest / UpdateRoutineRequest
 */

export type RoutineOwnerType = 'MEMBER' | 'TEMPLATE' | 'COACH';

/** Mirrors backend SetType enum. */
export type SetType = 'WARMUP' | 'WORKING' | 'DROP' | 'FAILURE';

/** How reps are edited for the exercise. Persisted per exercise; default SINGLE. */
export type RepsMode = 'SINGLE' | 'RANGE';

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
  /** Position within folder (or top-level loose bucket). */
  displayOrder: number;
  exercisePreviews: ExercisePreview[];
  totalExerciseCount: number;
  totalSetCount: number;
  /** null when the routine has zero exercises. */
  estimatedDurationMinutes: number | null;
}

/** One set inside an exercise. Backend RoutineResponse.RoutineSetDto. */
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

/** One exercise in a routine (enriched with name + iconUrl). */
export interface RoutineExercise {
  id: number;
  orderIndex: number;
  exerciseId: number;
  exerciseName: string | null;
  exerciseIconUrl: string | null;
  restSeconds: number | null;
  supersetGroupId: string | null;
  notes: string | null;
  repsMode: RepsMode;
  sets: RoutineSet[];
}

/** Full routine detail — used by GET /{id}. */
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
 * Minimal shape for creating a routine from the training list. Full editing
 * (exercises + sets) reuses the update DTO — the routine editor sends the
 * whole exercises array on PUT.
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
 * else is optional. Exercises follow the same shape as the response minus
 * the enricher-only fields (exerciseName / iconUrl) that the server ignores
 * on write.
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
    repsMode?: RepsMode;
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
