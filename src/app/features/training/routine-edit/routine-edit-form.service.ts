import { Injectable, computed, signal } from '@angular/core';
import {
  ExerciseCapabilities, RepsMode, RoutineDetail, RoutineExercise, RoutineSet, SetType,
} from '@core/training/routine.model';

/**
 * Draft state for the routine editor. NOT providedIn:'root' — the page
 * that hosts the editor lists it in its `providers` array so the draft
 * dies when the user leaves. Two editor tabs = two independent drafts.
 *
 * The draft mirrors RoutineDetail shape (with enricher fields
 * exerciseName / iconUrl) so the template can render exercise names
 * without a separate lookup — the server ignores those fields on write
 * via the toUpdateRequest mapper.
 *
 * Every mutation replaces the array/object being changed (not in-place
 * mutation) so signal readers detect the change.
 */
@Injectable()
export class RoutineEditFormService {
  private readonly _draft = signal<RoutineDetail | null>(null);
  /** Read-only view for templates. */
  readonly draft = this._draft.asReadonly();
  readonly loaded = computed(() => this._draft() !== null);

  loadFrom(source: RoutineDetail): void {
    // Deep copy so upstream cache (TanStack Query) stays immutable.
    this._draft.set(structuredClone(source));
  }

  // ---------- Routine header ----------

  updateTitle(title: string): void {
    this.patch(d => ({ ...d, title }));
  }

  updateNotes(notes: string | null): void {
    this.patch(d => ({ ...d, notes: notes?.trim() || null }));
  }

  // ---------- Exercises ----------

  /**
   * Append an exercise with one empty WORKING set. Capabilities come from
   * the catalog (picker attaches them); passing null is fine — the editor
   * falls back to a permissive default until save + refetch fills it.
   */
  addExercise(
    exerciseId: number,
    exerciseName: string,
    iconUrl: string | null,
    capabilities: ExerciseCapabilities | null = null,
  ): void {
    this.patch(d => {
      const nextOrder = d.exercises.length;
      return {
        ...d,
        exercises: [
          ...d.exercises,
          {
            id: 0,
            orderIndex: nextOrder,
            exerciseId,
            exerciseName,
            exerciseIconUrl: iconUrl,
            restSeconds: 90,
            supersetGroupId: null,
            notes: null,
            repsMode: 'SINGLE',
            capabilities,
            sets: [emptySet(0)],
          },
        ],
      };
    });
  }

  removeExercise(exerciseIndex: number): void {
    this.patch(d => ({
      ...d,
      exercises: d.exercises
        .filter((_, i) => i !== exerciseIndex)
        .map((ex, i) => ({ ...ex, orderIndex: i })),
    }));
  }

  moveExercise(from: number, to: number): void {
    if (from === to) return;
    this.patch(d => {
      const next = [...d.exercises];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return { ...d, exercises: next.map((ex, i) => ({ ...ex, orderIndex: i })) };
    });
  }

  updateExerciseRest(exerciseIndex: number, restSeconds: number | null): void {
    this.updateExerciseAt(exerciseIndex, ex => ({ ...ex, restSeconds }));
  }

  updateExerciseNotes(exerciseIndex: number, notes: string | null): void {
    this.updateExerciseAt(exerciseIndex, ex => ({ ...ex, notes: notes?.trim() || null }));
  }

  updateExerciseRepsMode(exerciseIndex: number, repsMode: RepsMode): void {
    this.updateExerciseAt(exerciseIndex, ex => ({ ...ex, repsMode }));
  }

  // ---------- Sets ----------

  /** Clones the last set of the exercise — likely what the user wants. */
  addSet(exerciseIndex: number): void {
    this.updateExerciseAt(exerciseIndex, ex => {
      const last = ex.sets[ex.sets.length - 1];
      const cloned: RoutineSet = last
        ? { ...last, id: 0, orderIndex: ex.sets.length }
        : emptySet(0);
      return { ...ex, sets: [...ex.sets, cloned] };
    });
  }

  removeSet(exerciseIndex: number, setIndex: number): void {
    this.updateExerciseAt(exerciseIndex, ex => ({
      ...ex,
      sets: ex.sets
        .filter((_, i) => i !== setIndex)
        .map((s, i) => ({ ...s, orderIndex: i })),
    }));
  }

  updateSet(exerciseIndex: number, setIndex: number, patch: Partial<RoutineSet>): void {
    this.updateExerciseAt(exerciseIndex, ex => ({
      ...ex,
      sets: ex.sets.map((s, i) => (i === setIndex ? { ...s, ...patch } : s)),
    }));
  }

  // ---------- Internals ----------

  private patch(fn: (d: RoutineDetail) => RoutineDetail): void {
    const current = this._draft();
    if (current) this._draft.set(fn(current));
  }

  private updateExerciseAt(
    exerciseIndex: number,
    fn: (ex: RoutineExercise) => RoutineExercise,
  ): void {
    this.patch(d => ({
      ...d,
      exercises: d.exercises.map((ex, i) => (i === exerciseIndex ? fn(ex) : ex)),
    }));
  }
}

function emptySet(orderIndex: number): RoutineSet {
  return {
    id: 0, orderIndex,
    setType: 'WORKING' as SetType,
    targetRepsMin: null, targetRepsMax: null, targetWeightKg: null,
    targetDurationSeconds: null, targetDistanceKm: null, targetRpe: null,
  };
}
