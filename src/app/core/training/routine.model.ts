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
export type SetType = 'WARMUP' | 'NORMAL' | 'WORKING' | 'FAILURE' | 'DROP_SET';

/** How reps are edited for the exercise. Persisted per exercise; default SINGLE. */
export type RepsMode = 'SINGLE' | 'RANGE';

/**
 * Which target fields make sense for an exercise — derived server-side
 * from ExerciseType + EquipmentType and shipped as-is. The frontend
 * uses it to gate inputs (hide weight on bodyweight, hide bricks on
 * barbell, hide DROP_SET from the set-type select when weight is off).
 * The backend enforces the same rules on write via ExerciseCapabilityGuard.
 */
export interface ExerciseCapabilities {
  weight: boolean;
  reps: boolean;
  duration: boolean;
  distance: boolean;
  rpe: boolean;
  bricks: boolean;
  /** Serialized as an array by Jackson (backend Set). */
  allowedSetTypes: SetType[];
}

/**
 * Wildly permissive defaults for a set/exercise whose capabilities
 * haven't been resolved yet from the backend (older routines missing
 * the computed field). Renders every input rather than silently hiding
 * one — the backend guard is still authoritative on save, so any
 * over-shown field the exercise doesn't accept will 422 before it
 * corrupts data.
 */
export const PERMISSIVE_CAPS: ExerciseCapabilities = {
  weight: true, reps: true, duration: false, distance: false,
  rpe: true, bricks: false,
  allowedSetTypes: ['WORKING', 'WARMUP', 'NORMAL', 'DROP_SET', 'FAILURE'],
};

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
  /** Nullable — null means inherit RoutineExercise.restSeconds; a value overrides the rest AFTER this set only. */
  restSecondsAfter: number | null;
}

/** One exercise in a routine (enriched with name + iconUrl + capabilities). */
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
  /** Nullable in the wire format — legacy responses / null exercise metadata. */
  capabilities: ExerciseCapabilities | null;
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
 * POST body for /api/training/routines — same wire shape as the PUT
 * body since the backend enforces @NotEmpty on `exercises` for both
 * paths. The routine editor sends the full tree at Guardar time; no
 * "create empty then patch" round-trip.
 */
export type CreateRoutineRequest = UpdateRoutineRequest;

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
      restSecondsAfter?: number | null;
    }>;
  }>;
}
