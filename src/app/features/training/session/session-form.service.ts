import { Injectable, computed, signal } from '@angular/core';
import { RoutineDetail } from '@core/training/routine.model';
import { WorkoutDraft, WorkoutSet } from '@core/training/workout.model';

/**
 * State for a single active workout session. Provided at the page level
 * (SessionPage) so the draft dies on leave. Mirrors the shape of
 * RoutineEditFormService but the underlying data is a workout, not a
 * routine — sets carry actual reps/kg + a completed flag, not just
 * targets.
 *
 * Seed sequence:
 *   1. `seedFromRoutine(routine)` on session start — every set clones
 *      the routine's target values into `target*` fields, actuals stay
 *      empty until the user checks them off.
 *   2. Mutations flow through `toggleSetCompleted`, `updateSet` etc.
 *   3. `toUpsertRequest()` at save time returns the wire-shaped body.
 */
@Injectable()
export class SessionFormService {
  private readonly _draft = signal<WorkoutDraft | null>(null);
  readonly draft = this._draft.asReadonly();
  readonly loaded = computed(() => this._draft() !== null);

  /** True as soon as the user marks ONE set — used by the CanDeactivate
   *  guard to prompt "descartar entrenamiento?" on back / discard. */
  private readonly _dirty = signal(false);
  readonly dirty = this._dirty.asReadonly();

  /** How many sets have been checked off — drives the header count. */
  readonly completedCount = computed(() => {
    let n = 0;
    for (const ex of this._draft()?.exercises ?? []) {
      for (const s of ex.sets) if (s.completed) n++;
    }
    return n;
  });

  readonly totalCount = computed(() => {
    let n = 0;
    for (const ex of this._draft()?.exercises ?? []) n += ex.sets.length;
    return n;
  });

  seedFromRoutine(routine: RoutineDetail, clientUuid: string, startedAt: Date): void {
    this._draft.set({
      id: clientUuid,
      routineId: routine.id,
      routineTitle: routine.title,
      startedAt: startedAt.toISOString(),
      notes: null,
      exercises: routine.exercises.map(ex => ({
        id: freshLocalId(),
        orderIndex: ex.orderIndex,
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        exerciseIconUrl: ex.exerciseIconUrl,
        restSeconds: ex.restSeconds,
        supersetGroupId: ex.supersetGroupId,
        notes: null,
        sets: ex.sets.map(s => ({
          id: freshLocalId(),
          orderIndex: s.orderIndex,
          setType: s.setType,
          reps: null,
          weightKg: null,
          durationSeconds: null,
          distanceKm: null,
          rpe: null,
          actualRestSeconds: null,
          inputMode: null,
          brickWeightKg: null,
          completed: false,
          // Range routines carry min/max; use max as the "target" the
          // user will actually try to hit. Null on non-rep exercises.
          targetReps: s.targetRepsMax ?? s.targetRepsMin ?? null,
          targetWeightKg: s.targetWeightKg == null ? null : Number(s.targetWeightKg),
          targetDurationSeconds: s.targetDurationSeconds,
          targetDistanceKm: s.targetDistanceKm == null ? null : Number(s.targetDistanceKm),
          targetRestSeconds: s.restSecondsAfter ?? ex.restSeconds,
        })),
      })),
    });
    this._dirty.set(false);
  }

  /**
   * Toggle check-off. On check → autofill any empty actual from its
   * target (user can still edit), stamp completed=true. On uncheck →
   * clear completed only, leave the values.
   */
  toggleSetCompleted(exerciseIndex: number, setIndex: number): void {
    this.updateSetAt(exerciseIndex, setIndex, s => {
      if (s.completed) return { ...s, completed: false };
      return {
        ...s,
        completed: true,
        reps: s.reps ?? s.targetReps,
        weightKg: s.weightKg ?? s.targetWeightKg,
        durationSeconds: s.durationSeconds ?? s.targetDurationSeconds,
        distanceKm: s.distanceKm ?? s.targetDistanceKm,
      };
    });
  }

  updateSet(exerciseIndex: number, setIndex: number, patch: Partial<WorkoutSet>): void {
    this.updateSetAt(exerciseIndex, setIndex, s => ({ ...s, ...patch }));
  }

  markPristine(): void {
    this._dirty.set(false);
  }

  private updateSetAt(
    exerciseIndex: number,
    setIndex: number,
    fn: (s: WorkoutSet) => WorkoutSet,
  ): void {
    const current = this._draft();
    if (!current) return;
    this._draft.set({
      ...current,
      exercises: current.exercises.map((ex, i) =>
        i !== exerciseIndex ? ex : {
          ...ex,
          sets: ex.sets.map((s, j) => (j === setIndex ? fn(s) : s)),
        }),
    });
    this._dirty.set(true);
  }
}

/** Session-scoped id. Same fallback pattern as the routine editor's
 *  freshGroupId — no secure context required (LAN IP over HTTP won't
 *  give us crypto.randomUUID). Only needs to be unique inside one
 *  draft; the backend generates its own DB ids on persist. */
function freshLocalId(): string {
  return Math.random().toString(36).slice(2, 10)
       + Date.now().toString(36);
}
