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

  /** Flips to true on any mutation, back to false when loadFrom re-runs
   *  (initial load and post-save refetch). Consumers (routine-edit
   *  page's Back handler, unsaved-changes guard) read this to know
   *  whether to prompt "descartar cambios?". */
  private readonly _dirty = signal(false);
  readonly dirty = this._dirty.asReadonly();

  /**
   * Frozen snapshot of every set as it was at load time (or the last
   * successful save — see routine-edit.page.ts, which refetches +
   * calls loadFrom again after save). Keyed by set id so lookups
   * stay stable across draft mutations. Consumed by set-editor to
   * render the "saved value" placeholder — the greyed reference
   * that lets the user see what they'd revert to no matter how much
   * they've typed since. New sets (id = 0) are absent here on
   * purpose; the placeholder falls back to the unit hint until the
   * user hits Save and the set gets a real id.
   */
  private readonly _originalById = signal<ReadonlyMap<number, RoutineSet>>(new Map());
  originalSetById(id: number | undefined): RoutineSet | undefined {
    return id ? this._originalById().get(id) : undefined;
  }

  /** Clears the dirty flag without touching the draft. Used after a
   *  successful save so the CanDeactivate guard doesn't prompt when
   *  we navigate away — the refetch that reseeds the snapshot may
   *  land after the navigation. */
  markPristine(): void {
    this._dirty.set(false);
  }

  loadFrom(source: RoutineDetail): void {
    // Deep copy so upstream cache (TanStack Query) stays immutable.
    this._draft.set(structuredClone(source));
    // Fresh snapshot of every persisted set for the placeholder reference.
    const snapshot = new Map<number, RoutineSet>();
    for (const ex of source.exercises) {
      for (const s of ex.sets) {
        if (s.id) snapshot.set(s.id, structuredClone(s));
      }
    }
    this._originalById.set(snapshot);
    this._dirty.set(false);
  }

  /** Seed an empty draft for "new routine" mode. id=0 flags the draft
   *  as unpersisted so the editor page routes to POST instead of PUT
   *  on save; no backend call happens until the user hits Guardar. */
  startEmpty(folderId: number | null = null): void {
    this._draft.set({
      id: 0,
      organizationId: 0,
      ownerType: 'MEMBER',
      ownerGlobalProfileId: 0,
      sourceRoutineId: null,
      title: '',
      notes: null,
      folderId,
      displayOrder: 0,
      exercises: [],
    });
    this._originalById.set(new Map());
    this._dirty.set(false);
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

  /**
   * Swap an exercise's identity (id + name + iconUrl + capabilities)
   * while KEEPING its sets, rest, notes, superset group and repsMode.
   * The frontend Guardar already caps-strips at save time, and the
   * backend guard rejects any set field the new exercise's caps don't
   * allow, so mismatched persisted values fail loudly rather than
   * silently. Reset those we know are always identity-scoped: id=0
   * so the backend treats it as a new junction row (old
   * routine_exercise_id gets orphan-removed on save).
   */
  replaceExercise(
    exerciseIndex: number,
    newExerciseId: number,
    newExerciseName: string,
    newIconUrl: string | null,
    newCapabilities: ExerciseCapabilities | null,
  ): void {
    this.updateExerciseAt(exerciseIndex, ex => ({
      ...ex,
      id: 0,
      exerciseId: newExerciseId,
      exerciseName: newExerciseName,
      exerciseIconUrl: newIconUrl,
      capabilities: newCapabilities,
    }));
  }

  /**
   * Join `partnerIndex` into `currentIndex`'s superset group. Rules:
   * - If current already has a groupId, partner joins it (any group
   *   partner might have been in is left behind).
   * - Else if partner has one, current joins partner's.
   * - Else a fresh UUID is minted and both get it.
   * Never merges two existing groups by design — we always drive from
   * the exercise whose ⋮ opened the picker.
   */
  addToSuperset(currentIndex: number, partnerIndex: number): void {
    if (currentIndex === partnerIndex) return;
    this.patch(d => {
      const current = d.exercises[currentIndex];
      const partner = d.exercises[partnerIndex];
      if (!current || !partner) return d;
      const groupId =
        current.supersetGroupId ?? partner.supersetGroupId ?? freshGroupId();
      return {
        ...d,
        exercises: d.exercises.map((ex, i) =>
          i === currentIndex || i === partnerIndex
            ? { ...ex, supersetGroupId: groupId }
            : ex),
      };
    });
  }

  /**
   * Ungroup one exercise. If removing this leaves the group with a
   * single member, that lone survivor is ungrouped too — a superset
   * of one is not a superset.
   */
  removeFromSuperset(exerciseIndex: number): void {
    this.patch(d => {
      const target = d.exercises[exerciseIndex];
      const groupId = target?.supersetGroupId;
      if (!groupId) return d;
      const remainingCount = d.exercises.filter(
        (ex, i) => i !== exerciseIndex && ex.supersetGroupId === groupId).length;
      const collapseLoner = remainingCount === 1;
      return {
        ...d,
        exercises: d.exercises.map((ex, i) => {
          if (i === exerciseIndex) return { ...ex, supersetGroupId: null };
          if (collapseLoner && ex.supersetGroupId === groupId) {
            return { ...ex, supersetGroupId: null };
          }
          return ex;
        }),
      };
    });
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
    if (!current) return;
    this._draft.set(fn(current));
    // Any mutation flips the draft to dirty; loadFrom clears it back
    // to false. Consumers use this to gate a "descartar cambios?" prompt.
    this._dirty.set(true);
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

/**
 * Fresh superset group id. `crypto.randomUUID()` would be nicer but
 * requires a secure context (HTTPS or localhost) — accessing the app
 * via LAN IP over HTTP leaves it undefined and throws. A short random
 * string is plenty for a groupId whose only invariant is "unique
 * across the ~10 groups a single routine draft could ever hold".
 */
function freshGroupId(): string {
  return Math.random().toString(36).slice(2, 10)
       + Date.now().toString(36);
}

function emptySet(orderIndex: number): RoutineSet {
  return {
    id: 0, orderIndex,
    setType: 'WORKING' as SetType,
    targetRepsMin: null, targetRepsMax: null, targetWeightKg: null,
    targetDurationSeconds: null, targetDistanceKm: null, targetRpe: null,
    restSecondsAfter: null,
  };
}
