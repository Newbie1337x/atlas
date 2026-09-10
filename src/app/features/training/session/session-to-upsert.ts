import { RoutineDetail, RoutineSet } from '@core/training/routine.model';
import { UpsertWorkoutRequest, WorkoutVisibility } from '@core/training/workout.model';
import { uuidV4 } from '@core/uuid';

/** Save-screen inputs merged into the upsert body. Anything the user
 *  edited in the "Guardar entreno" step lands here — the untouched
 *  fields fall back to routine defaults inside the mapper. */
export interface WorkoutSaveMetadata {
  title?: string | null;
  notes?: string | null;
  visibility?: WorkoutVisibility;
  durationSeconds?: number | null;
}

/**
 * Transform the routine-shaped draft (mutated in place by the shared
 * RoutineEditFormService while the user is training) into the workout
 * upsert body the backend expects at PUT /workouts/:clientUuid.
 *
 * Field mapping:
 *   routineSet.targetWeightKg      → workoutSet.weightKg     (actual)
 *   routineSet.targetRepsMax/Min   → workoutSet.reps         (actual)
 *   routineSet.targetDurationSecs  → workoutSet.durationSeconds
 *   routineSet.targetDistanceKm    → workoutSet.distanceKm
 *   routineSet.targetRpe           → workoutSet.rpe
 *   routineSet.completed           → workoutSet.completed
 *
 * The frontend deliberately reuses the same SetEditor for both flows —
 * during a session, whatever the user types INTO the "target" input IS
 * the actual value they performed, so we ship it straight through.
 *
 * Set / exercise ids are minted here (workout tables use UUIDs); the
 * routine's numeric ids are irrelevant to the workout row. clientUuid
 * carried by the session page identifies the workout itself and stays
 * stable across upserts.
 */
export function routineDraftToUpsertRequest(
  draft: RoutineDetail,
  startedAt: string,
  metadata: WorkoutSaveMetadata = {},
): UpsertWorkoutRequest {
  return {
    globalProfileId: 0, // backend overrides from JWT
    routineId: draft.id > 0 ? draft.id : null,
    title: metadata.title ?? null,
    startedAt,
    durationSeconds: metadata.durationSeconds ?? null,
    notes: metadata.notes ?? draft.notes ?? undefined,
    visibility: metadata.visibility ?? undefined,
    exercises: draft.exercises.map(ex => ({
      id: uuidV4(),
      orderIndex: ex.orderIndex,
      exerciseId: ex.exerciseId,
      supersetGroupId: ex.supersetGroupId,
      restSeconds: ex.restSeconds,
      notes: ex.notes,
      sets: ex.sets.map(s => ({
        id: uuidV4(),
        orderIndex: s.orderIndex,
        setType: s.setType,
        // Session actuals win; fall back to the routine target for
        // sets the user checked without typing.
        reps: s.actualReps ?? pickReps(s),
        weightKg: s.actualWeightKg != null
          ? Number(s.actualWeightKg)
          : (s.targetWeightKg == null ? null : Number(s.targetWeightKg)),
        durationSeconds: s.actualDurationSeconds ?? s.targetDurationSeconds,
        distanceKm: s.targetDistanceKm == null ? null : Number(s.targetDistanceKm),
        rpe: s.targetRpe == null ? null : Number(s.targetRpe),
        actualRestSeconds: s.restSecondsAfter ?? ex.restSeconds ?? null,
        inputMode: null,
        brickWeightKg: null,
        completed: !!s.completed,
      })),
    })),
  };
}

/** Range routines carry both min and max; use max (what the user was
 *  aiming for) as the actual for the workout. Single mode mirrors
 *  min===max via the editor, so both fields agree. */
function pickReps(s: RoutineSet): number | null {
  if (s.targetRepsMax != null) return s.targetRepsMax;
  return s.targetRepsMin ?? null;
}

