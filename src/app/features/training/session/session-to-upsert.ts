import { UpsertWorkoutRequest, WorkoutDraft } from '@core/training/workout.model';

/**
 * Map the client-side WorkoutDraft into the wire body expected by
 * PUT /api/training/workouts/:clientUuid. Strips the target* fields
 * the frontend uses for placeholders (server has them in the routine
 * template already) and drops nulls that Jackson would echo back.
 *
 * `completedAt` is null while the workout is in progress; the
 * separate POST /complete flips it server-side. Sending it here is
 * unnecessary for upsert.
 */
export function sessionToUpsertRequest(
  draft: WorkoutDraft,
): UpsertWorkoutRequest {
  return {
    globalProfileId: 0, // Backend overrides from JWT
    routineId: draft.routineId,
    startedAt: draft.startedAt,
    notes: draft.notes ?? undefined,
    exercises: draft.exercises.map(ex => ({
      id: ex.id,
      orderIndex: ex.orderIndex,
      exerciseId: ex.exerciseId,
      supersetGroupId: ex.supersetGroupId,
      restSeconds: ex.restSeconds,
      notes: ex.notes,
      sets: ex.sets.map(s => ({
        id: s.id,
        orderIndex: s.orderIndex,
        setType: s.setType,
        reps: s.reps,
        weightKg: s.weightKg,
        durationSeconds: s.durationSeconds,
        distanceKm: s.distanceKm,
        rpe: s.rpe,
        actualRestSeconds: s.actualRestSeconds,
        inputMode: s.inputMode,
        brickWeightKg: s.brickWeightKg,
        completed: s.completed,
      })),
    })),
  };
}
