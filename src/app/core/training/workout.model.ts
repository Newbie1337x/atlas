import { InputMode } from './exercise.model';
import { SetType } from './routine.model';

/**
 * A workout in progress or completed. Mirrors the backend WorkoutResponse
 * shape, minus enricher-only fields the server injects (exerciseName,
 * exerciseIconUrl). The tracker keeps a local WorkoutDraft that seeds
 * from a routine at session start and is progressively mutated as the
 * user checks off sets / edits actual values.
 *
 * `id` (UUID) is minted client-side once at session start — the backend
 * PUT /workouts/:clientUuid is idempotent by that id, so retries after
 * offline drops or mid-session app kills upsert cleanly.
 */
export type WorkoutVisibility = 'PRIVATE' | 'FOLLOWERS' | 'PUBLIC';

export interface WorkoutSet {
  /** Client-side UUID minted at seed time. Stable across upserts. */
  id: string;
  orderIndex: number;
  setType: SetType;
  /** Actual reps performed. Populated on check-off; empty until then. */
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
  distanceKm: number | null;
  rpe: number | null;
  /** Seconds the user actually rested after this set (measured by the
   *  in-app rest timer). Null until the rest countdown ends. */
  actualRestSeconds: number | null;
  inputMode: InputMode | null;
  brickWeightKg: number | null;
  /** True once the user checked off the set. Drives ghost/actual mode
   *  in the UI + counts toward totals in the summary. */
  completed: boolean;
  /** Target values copied from the routine at seed time. UI uses them
   *  as placeholders / ghost values. Server ignores on write. */
  targetReps: number | null;
  targetWeightKg: number | null;
  targetDurationSeconds: number | null;
  targetDistanceKm: number | null;
  targetRestSeconds: number | null;
}

export interface WorkoutExercise {
  id: string;
  orderIndex: number;
  exerciseId: number;
  exerciseName: string | null;
  exerciseIconUrl: string | null;
  restSeconds: number | null;
  supersetGroupId: string | null;
  notes: string | null;
  sets: WorkoutSet[];
}

export interface WorkoutDraft {
  id: string;
  routineId: number | null;
  routineTitle: string;
  startedAt: string;   // ISO Instant
  notes: string | null;
  exercises: WorkoutExercise[];
}

/** Body for PUT /api/training/workouts/:clientUuid — matches WorkoutRequest. */
export interface UpsertWorkoutRequest {
  globalProfileId: number;  // Backend overrides from JWT; can be 0.
  routineId: number | null;
  /** Optional workout title — e.g. "Miércoles (Espalda)". Null keeps
   *  the routine's default. Set on the save screen before /complete. */
  title?: string | null;
  startedAt: string;
  completedAt?: string | null;
  /** Override for the "Minutos entrenados" input on the save screen.
   *  When set, backend uses this instead of the wall-clock diff between
   *  startedAt and completedAt. Null keeps the derived value. */
  durationSeconds?: number | null;
  notes?: string | null;
  mediaUrls?: string[];
  visibility?: WorkoutVisibility;
  exercises: Array<{
    id: string;
    orderIndex: number;
    exerciseId: number;
    supersetGroupId?: string | null;
    restSeconds?: number | null;
    notes?: string | null;
    sets: Array<{
      id: string;
      orderIndex: number;
      setType: SetType;
      reps?: number | null;
      weightKg?: number | null;
      durationSeconds?: number | null;
      distanceKm?: number | null;
      rpe?: number | null;
      actualRestSeconds?: number | null;
      inputMode?: InputMode | null;
      brickWeightKg?: number | null;
      completed: boolean;
    }>;
  }>;
}

export type WorkoutStatus = 'IN_PROGRESS' | 'COMPLETED' | 'DISCARDED';

/**
 * Full backend response for GET /workouts/:id. Carries the denormalized
 * summary counters (durationSeconds, totalVolumeKg, totalSets) set on
 * complete, plus per-set isPersonalRecord flags and per-exercise
 * name/icon from the detail enricher — everything the summary page
 * needs in one round-trip.
 */
export interface WorkoutDetail {
  id: string;
  globalProfileId: number;
  routineId: number | null;
  title: string | null;
  status: WorkoutStatus;
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number | null;
  totalVolumeKg: number | null;
  totalSets: number | null;
  notes: string | null;
  mediaUrls: string[];
  visibility: WorkoutVisibility;
  exercises: WorkoutDetailExercise[];
}

export interface WorkoutDetailExercise {
  id: string;
  orderIndex: number;
  exerciseId: number;
  exerciseName: string | null;
  exerciseIconUrl: string | null;
  supersetGroupId: string | null;
  restSeconds: number | null;
  notes: string | null;
  sets: WorkoutDetailSet[];
}

export interface WorkoutDetailSet {
  id: string;
  orderIndex: number;
  setType: SetType;
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
  distanceKm: number | null;
  rpe: number | null;
  actualRestSeconds: number | null;
  inputMode: InputMode | null;
  brickWeightKg: number | null;
  completed: boolean;
  isPersonalRecord: boolean;
}
