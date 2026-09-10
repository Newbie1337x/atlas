import {
  DestroyRef, Injectable, computed, inject, signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { injectQueryClient } from '@tanstack/angular-query-experimental';
import { TrainingApi } from '@core/training/training.api';
import { trainingKeys } from '@core/training/training.keys';
import { HttpError } from '@core/errors/http-error';
import { toUpdateRequest } from '@core/training/training-actions.service';
import { uuidV4 } from '@core/uuid';
import { RoutineDetail } from '@core/training/routine.model';
import { RoutineEditFormService } from '../routine-edit/routine-edit-form.service';
import { RestTimerService } from './rest-timer.service';
import {
  WorkoutSaveMetadata, routineDraftToUpsertRequest,
} from './session-to-upsert';

/**
 * Root-scoped owner of the ACTIVE workout — everything the session
 * needs to keep alive across navigations to other tabs. The
 * mini-bar in the app shell listens to `isActive()` + `elapsedMmss()`
 * + `currentExerciseLabel()`; the session page (when the user is on
 * it) reads the same signals for its own toolbar.
 *
 * State it owns:
 *   - clientUuid, startedAt (idempotency key + wall clock)
 *   - elapsedSeconds tick (survives tab switching)
 *   - saving / savedOrDiscarded (short-circuits the discard guard
 *     after a successful save)
 *   - reference to the root RoutineEditFormService (draft lives there)
 *   - reference to the root RestTimerService (countdown lives there)
 *
 * `start()` seeds a fresh workout; `discard()` posts /discard and
 * clears state; `finalize()` runs the upsert + complete flow and
 * navigates to the summary. All three services (this one + the two
 * root instances) return to a blank slate after `discard()` /
 * `finalize()`, so `Empezar rutina` starts from zero.
 */
@Injectable({ providedIn: 'root' })
export class ActiveWorkoutService {
  private readonly router = inject(Router);
  private readonly api = inject(TrainingApi);
  private readonly queryClient = injectQueryClient();
  private readonly destroyRef = inject(DestroyRef);
  readonly form = inject(RoutineEditFormService);
  readonly restTimer = inject(RestTimerService);

  private readonly _clientUuid = signal<string | null>(null);
  private readonly _startedAt = signal<Date | null>(null);
  private readonly _routineId = signal<number | null>(null);
  readonly saving = signal(false);
  /** Short-circuits the discard guard after a successful save. Reset
   *  on `start()` so the next workout runs its guard normally. */
  savedOrDiscarded = false;

  readonly clientUuid = this._clientUuid.asReadonly();
  readonly startedAt = this._startedAt.asReadonly();
  readonly routineId = this._routineId.asReadonly();

  /** True when a workout is currently in progress — mini-bar visibility
   *  key. Also gates `start()` from clobbering an existing session. */
  readonly isActive = computed(() =>
    this._clientUuid() !== null && this.form.loaded());

  protected readonly _elapsedSeconds = signal(0);
  readonly elapsedSeconds = this._elapsedSeconds.asReadonly();

  private tickHandle: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.stopTick());
  }

  /**
   * Seed a fresh workout. If one is already active with the same
   * routineId, no-op (resume). If a different one is active, throws —
   * caller should ask the user to discard first via
   * `confirmStartOverActive()`.
   */
  start(routineId: number, routine: RoutineDetail): void {
    if (this.isActive() && this._routineId() === routineId) return;
    if (this.isActive() && this._routineId() !== routineId) {
      throw new Error('Another workout is already active — discard first');
    }
    this._clientUuid.set(uuidV4());
    this._startedAt.set(new Date());
    this._routineId.set(routineId);
    this.form.loadFrom(routine);
    this.savedOrDiscarded = false;
    this._elapsedSeconds.set(0);
    this.startTick();
  }

  /** POST /discard + clear state. Fire-and-forget on the network side
   *  — if the workout was never upserted, the backend returns 404 and
   *  we swallow it. */
  async discard(): Promise<void> {
    const id = this._clientUuid();
    if (id) {
      try { await firstValueFrom(this.api.discardWorkout(id)); }
      catch { /* ignore — may not have been upserted */ }
    }
    this.form.markPristine();
    this.savedOrDiscarded = true;
    this.reset();
  }

  /**
   * Upsert + complete + optional routine template update, then
   * navigate to the celebration summary. Bumps saving() while the
   * network calls run so the caller's Guardar button stays
   * disabled. Surfaces errors as a Promise<HttpError | Error> so
   * the caller can show a toast.
   */
  async finalize(metadata: WorkoutSaveMetadata, updateRoutine: boolean): Promise<void> {
    const draft = this.form.draft();
    const uuid = this._clientUuid();
    const startedAt = this._startedAt();
    if (!draft || !uuid || !startedAt) return;
    this.saving.set(true);
    try {
      const body = routineDraftToUpsertRequest(draft, startedAt.toISOString(), metadata);
      await firstValueFrom(this.api.upsertWorkout(uuid, body));
      await firstValueFrom(this.api.completeWorkout(uuid));
      if (updateRoutine && draft.id > 0) {
        await firstValueFrom(
          this.api.updateRoutine(draft.id, toUpdateRequest(draft)));
      }
      await this.queryClient.invalidateQueries({ queryKey: trainingKeys.all });
      this.form.markPristine();
      this.savedOrDiscarded = true;
      void this.router.navigate(
        ['/training/workouts', uuid, 'summary'],
        { queryParams: { fresh: 1 } });
      this.reset();
    } catch (err) {
      throw err instanceof HttpError ? err
        : new Error('No pudimos guardar el entrenamiento.');
    } finally {
      this.saving.set(false);
    }
  }

  /** Human-readable elapsed for the header + mini-bar. */
  elapsedMmss(): string {
    const s = this._elapsedSeconds();
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    const mm = m.toString().padStart(2, '0');
    const rr = r.toString().padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${rr}` : `${mm}:${rr}`;
  }

  /** First exercise name for the mini-bar label (Hevy shows "Press
   *  de Banca (Barra)" — we use the first exercise until we track a
   *  proper "current" one). */
  currentExerciseLabel(): string {
    const first = this.form.draft()?.exercises[0];
    return first?.exerciseName ?? '';
  }

  /** Clears every piece of session state. Called by start() (on new
   *  session), discard() and successful finalize(). */
  private reset(): void {
    this._clientUuid.set(null);
    this._startedAt.set(null);
    this._routineId.set(null);
    this._elapsedSeconds.set(0);
    this.restTimer.skip();
    this.stopTick();
  }

  private startTick(): void {
    this.stopTick();
    const start = this._startedAt()?.getTime();
    if (!start) return;
    this.tickHandle = setInterval(() => {
      this._elapsedSeconds.set(Math.floor((Date.now() - start) / 1000));
    }, 1000);
  }

  private stopTick(): void {
    if (this.tickHandle !== null) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
  }
}
