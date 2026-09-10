import {
  ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { injectQuery, injectQueryClient } from '@tanstack/angular-query-experimental';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent,
  IonIcon, IonNote, IonSpinner,
  AlertController, ModalController, ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { addOutline, checkmarkDoneOutline, chevronBackOutline } from 'ionicons/icons';
import { TrainingApi } from '@core/training/training.api';
import { trainingKeys } from '@core/training/training.keys';
import { HttpError } from '@core/errors/http-error';
import { toUpdateRequest } from '@core/training/training-actions.service';
import { uuidV4 } from '@core/uuid';
import { PersonalRecord } from '@core/training/personal-record.model';
import { PreviousSet } from '@core/training/workout-prepare.model';
import { RoutineEditFormService } from './routine-edit/routine-edit-form.service';
import { ExerciseEditorComponent } from './routine-edit/exercise-editor.component';
import { ExercisePickerComponent } from './routine-edit/exercise-picker.component';
import { RestTimerService } from './session/rest-timer.service';
import { SessionRestTimerComponent } from './session/session-rest-timer.component';
import { routineDraftToUpsertRequest, WorkoutSaveMetadata } from './session/session-to-upsert';
import { SaveWorkoutModal, SaveWorkoutResult } from './session/save-workout.modal';

/**
 * Active workout tracker. Route: /training/session/:routineId.
 *
 * REUSES the routine editor UI verbatim — same ExerciseEditorComponent,
 * same SetEditorComponent, same RoutineEditFormService. Session mode
 * differs by exactly two things:
 *   1. `showCheck=true` on the exercise editor renders a check column;
 *      tapping it kicks the rest timer and stamps set.completed via
 *      the shared form service (Partial<RoutineSet> already accepts
 *      the new `completed` field).
 *   2. Save doesn't PUT /routines — it transforms the routine-shaped
 *      draft into a WorkoutRequest and hits PUT /workouts/:clientUuid
 *      + POST /:uuid/complete.
 *
 * Everything editor gives you for free — add/remove sets, superset,
 * replace exercise, reorder, notes — works mid-session too because
 * the underlying service is the same instance.
 */
@Component({
  selector: 'page-training-session',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [RoutineEditFormService, RestTimerService],
  imports: [
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent,
    IonIcon, IonNote, IonSpinner,
    ExerciseEditorComponent, SessionRestTimerComponent,
  ],
  styles: [`
    .elapsed {
      display: block;
      font-size: 0.75em;
      color: var(--ion-color-medium, #666);
      font-variant-numeric: tabular-nums;
    }
  `],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button (click)="cancel()" aria-label="Volver">
            <ion-icon slot="icon-only" name="chevron-back-outline" />
          </ion-button>
        </ion-buttons>
        <ion-title>
          {{ form.draft()?.title ?? 'Entrenamiento' }}
          <span class="elapsed">{{ elapsedMmss() }} · {{ completedCount() }}/{{ totalCount() }} series</span>
        </ion-title>
        <ion-buttons slot="end">
          <ion-button
            [disabled]="!form.loaded() || saving()"
            (click)="confirmTerminar()"
            aria-label="Terminar entrenamiento">
            <ion-icon slot="start" name="checkmark-done-outline" />
            Terminar
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      @if (query.isPending()) {
        <ion-spinner />
      } @else if (query.isError()) {
        <ion-note color="danger">No pudimos cargar la rutina.</ion-note>
      } @else if (form.draft(); as d) {
        @for (ex of d.exercises; track $index) {
          <app-training-exercise-editor
            [exercise]="ex"
            [index]="$index"
            [showCheck]="true"
            [personalRecords]="prsFor(ex.exerciseId)"
            [previousSets]="previousFor(ex.exerciseId)"
            (checkSet)="onCheckSet($index, $event)" />
        }

        <ion-button expand="block" fill="outline" (click)="openPicker()">
          <ion-icon slot="start" name="add-outline" />
          Agregar ejercicio
        </ion-button>
      }

      <app-training-session-rest-timer />
    </ion-content>
  `,
})
export class SessionPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(TrainingApi);
  private readonly queryClient = injectQueryClient();
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);
  private readonly modal = inject(ModalController);
  private readonly destroyRef = inject(DestroyRef);
  private readonly restTimer = inject(RestTimerService);
  protected readonly form = inject(RoutineEditFormService);

  protected readonly saving = signal(false);
  /** True after a successful terminate — short-circuits the discard
   *  guard so the follow-up navigation does not re-prompt. */
  private savedOrDiscarded = false;

  /** Idempotency key for the workout on the backend. Minted once, sent
   *  in every upsert so retries / offline resend land on the same row. */
  private readonly clientUuid = uuidV4();
  private readonly startedAt = new Date();

  protected readonly elapsedSeconds = signal(0);

  protected readonly routineId = computed(() => {
    const raw = this.route.snapshot.paramMap.get('routineId');
    return raw ? Number(raw) : NaN;
  });

  /** ONE call at session start: routine detail + PRs + ANTERIOR ghost
   *  values. Backing GET /workouts/prepare. Backed by the shared
   *  routineDetail queryKey so returning to /training/routines/:id
   *  after the workout uses the just-fetched routine payload from
   *  inside `data.routine` — no separate refetch needed. */
  protected readonly query = injectQuery(() => ({
    queryKey: ['training', 'workout-prepare', this.routineId()],
    queryFn: () => firstValueFrom(this.api.prepareWorkout(this.routineId())),
    enabled: Number.isFinite(this.routineId()),
  }));

  /** PRs bucketed by exerciseId for O(1) lookup from the exercise
   *  card's `personalRecords` input. */
  protected readonly prsByExercise = computed<ReadonlyMap<number, PersonalRecord[]>>(() => {
    const buckets = new Map<number, PersonalRecord[]>();
    for (const pr of this.query.data()?.personalRecords ?? []) {
      const bucket = buckets.get(pr.exerciseId) ?? [];
      bucket.push(pr);
      buckets.set(pr.exerciseId, bucket);
    }
    return buckets;
  });

  /** ANTERIOR ghost sets bucketed by exerciseId. ExerciseEditor keys by
   *  orderIndex inside its own scope. */
  protected readonly previousByExercise = computed<ReadonlyMap<number, PreviousSet[]>>(() => {
    const buckets = new Map<number, PreviousSet[]>();
    for (const ps of this.query.data()?.previousSets ?? []) {
      const bucket = buckets.get(ps.exerciseId) ?? [];
      bucket.push(ps);
      buckets.set(ps.exerciseId, bucket);
    }
    return buckets;
  });

  protected prsFor(exerciseId: number): readonly PersonalRecord[] {
    return this.prsByExercise().get(exerciseId) ?? [];
  }
  protected previousFor(exerciseId: number): readonly PreviousSet[] {
    return this.previousByExercise().get(exerciseId) ?? [];
  }

  /** Session-level totals for the header counter. */
  protected readonly completedCount = computed(() => {
    let n = 0;
    for (const ex of this.form.draft()?.exercises ?? []) {
      for (const s of ex.sets) if (s.completed) n++;
    }
    return n;
  });
  protected readonly totalCount = computed(() => {
    let n = 0;
    for (const ex of this.form.draft()?.exercises ?? []) n += ex.sets.length;
    return n;
  });

  constructor() {
    addIcons({
      'add-outline': addOutline,
      'checkmark-done-outline': checkmarkDoneOutline,
      'chevron-back-outline': chevronBackOutline,
    });

    // Seed the shared form service from the routine detail once it lands.
    effect(() => {
      const data = this.query.data();
      if (data && !this.form.loaded()) this.form.loadFrom(data.routine);
    });

    // Session cronómetro — 1s tick, cleaned up on destroy.
    const startMs = this.startedAt.getTime();
    const tick = setInterval(() => {
      this.elapsedSeconds.set(Math.floor((Date.now() - startMs) / 1000));
    }, 1000);
    this.destroyRef.onDestroy(() => clearInterval(tick));
  }

  /** Toggle the check column on a set. On check-on: auto-fill actual*
   *  from target so a user who just wants to log "did the planned set"
   *  can tap once and move on; user can still edit actuals afterwards.
   *  All fields are workout-only keys — form.updateSet knows not to
   *  flip dirty, so the "actualizar rutina?" prompt at Terminar stays
   *  reserved for structural changes. */
  protected onCheckSet(exerciseIndex: number, setIndex: number): void {
    const set = this.form.draft()?.exercises[exerciseIndex]?.sets[setIndex];
    if (!set) return;
    const wasCompleted = !!set.completed;
    if (wasCompleted) {
      this.form.updateSet(exerciseIndex, setIndex, { completed: false });
      return;
    }
    const targetReps = set.targetRepsMax ?? set.targetRepsMin ?? null;
    this.form.updateSet(exerciseIndex, setIndex, {
      completed: true,
      actualReps: set.actualReps ?? targetReps,
      actualWeightKg: set.actualWeightKg ?? set.targetWeightKg,
      actualDurationSeconds: set.actualDurationSeconds ?? set.targetDurationSeconds,
    });
    const exercise = this.form.draft()?.exercises[exerciseIndex];
    const rest = set.restSecondsAfter ?? exercise?.restSeconds ?? 0;
    if (rest > 0) this.restTimer.start(rest);
  }

  /** Same picker + form.addExercise path the routine editor uses.
   *  Since we share RoutineEditFormService, the newly added exercise
   *  lands in the session draft and is trackable immediately. Marks
   *  dirty → Terminar will offer "actualizar rutina?". */
  protected async openPicker(): Promise<void> {
    const modal = await this.modal.create({ component: ExercisePickerComponent });
    await modal.present();
    const { data } = await modal.onDidDismiss();
    if (data) this.form.addExercise(data.id, data.name, data.demoMediaUrl, data.capabilities);
  }

  protected elapsedMmss(): string {
    const s = this.elapsedSeconds();
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    const mm = m.toString().padStart(2, '0');
    const rr = r.toString().padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${rr}` : `${mm}:${rr}`;
  }

  private confirming = false;

  async confirmDiscardIfDirty(): Promise<boolean> {
    // No prompt after Terminar / manual discard already resolved the
    // session — those paths flip `savedOrDiscarded` and the follow-up
    // Router.navigate re-fires this guard.
    if (this.savedOrDiscarded) return true;
    if (this.completedCount() === 0 && !this.form.dirty()) return true;
    if (this.confirming) return false;
    this.confirming = true;
    try {
      const alert = await this.alerts.create({
        header: '¿Descartar entrenamiento?',
        message: 'Vas a perder lo que registraste hasta ahora.',
        buttons: [
          { text: 'Descartar', role: 'destructive' },
          { text: 'Seguir entrenando', role: 'cancel' },
        ],
      });
      await alert.present();
      const { role } = await alert.onDidDismiss();
      if (role !== 'destructive') return false;
      // Fire-and-forget; if the workout was never upserted server-side
      // there is nothing to discard yet — swallow the 404.
      try { await firstValueFrom(this.api.discardWorkout(this.clientUuid)); }
      catch { /* ignore */ }
      this.form.markPristine();
      this.savedOrDiscarded = true;
      return true;
    } finally {
      this.confirming = false;
    }
  }

  protected async cancel(): Promise<void> {
    const ok = await this.confirmDiscardIfDirty();
    if (ok) this.router.navigate(['/training']);
  }

  /**
   * Client-side total volume for the save screen's KPI card — sum of
   * (weight × reps) across completed sets. Kept in sync with the draft
   * so the modal reads it as a signal input. The backend recomputes it
   * server-side at /complete anyway (source of truth), this is just for
   * the pre-save preview.
   */
  protected readonly totalVolumeKg = computed(() => {
    let sum = 0;
    for (const ex of this.form.draft()?.exercises ?? []) {
      for (const s of ex.sets) {
        if (!s.completed) continue;
        const kg = Number(s.actualWeightKg ?? s.targetWeightKg ?? 0);
        const reps = s.actualReps ?? s.targetRepsMax ?? s.targetRepsMin ?? 0;
        if (kg > 0 && reps > 0) sum += kg * reps;
      }
    }
    return sum;
  });

  /** Opens the "Guardar entreno" screen — collects title / notes /
   *  visibility / duration override / routine-update choice, then
   *  fires finalize() with the picked metadata. Replaces the 3-option
   *  alert with a proper form. */
  protected async confirmTerminar(): Promise<void> {
    const draft = this.form.draft();
    if (!draft) return;

    const modal = await this.modal.create({
      component: SaveWorkoutModal,
      componentProps: {
        initialTitle: draft.title ?? '',
        elapsedSeconds: this.elapsedSeconds(),
        totalVolumeKg: this.totalVolumeKg(),
        completedSetsCount: this.completedCount(),
        totalSetsCount: this.totalCount(),
        isDirty: this.form.dirty() && draft.id > 0,
      },
    });
    await modal.present();
    const result = await modal.onDidDismiss<SaveWorkoutResult | null>();
    if (result.role === 'save' && result.data) {
      await this.finalize(result.data.updateRoutine, result.data.metadata);
    } else if (result.role === 'discard') {
      await this.discardFromModal();
    }
  }

  /** Executes discard from the save screen — same flow as the header
   *  Cancel + confirm alert, but the modal already showed the alert so
   *  we skip re-prompting via savedOrDiscarded. */
  private async discardFromModal(): Promise<void> {
    try { await firstValueFrom(this.api.discardWorkout(this.clientUuid)); }
    catch { /* ignore — workout may never have been upserted */ }
    this.form.markPristine();
    this.savedOrDiscarded = true;
    void this.router.navigate(['/training']);
  }

  /** Always PUT /workouts + POST /complete. If `updateRoutine` was
   *  picked, also PUT /routines with the (edited) draft so the template
   *  reflects what the user actually wants going forward. */
  private async finalize(updateRoutine: boolean, metadata: WorkoutSaveMetadata = {}): Promise<void> {
    const draft = this.form.draft();
    if (!draft) return;
    this.saving.set(true);
    try {
      const body = routineDraftToUpsertRequest(draft, this.startedAt.toISOString(), metadata);
      await firstValueFrom(this.api.upsertWorkout(this.clientUuid, body));
      await firstValueFrom(this.api.completeWorkout(this.clientUuid));
      if (updateRoutine && draft.id > 0) {
        await firstValueFrom(
          this.api.updateRoutine(draft.id, toUpdateRequest(draft)));
      }
      await this.queryClient.invalidateQueries({ queryKey: trainingKeys.all });
      this.form.markPristine();
      this.savedOrDiscarded = true;
      // Route to the celebration summary. `fresh=1` picks the
      // congratulatory banner + close-to-home behavior; without the
      // param the same page serves as a plain history detail view.
      void this.router.navigate(['/training/workouts', this.clientUuid, 'summary'],
        { queryParams: { fresh: 1 } });
    } catch (err) {
      const message = err instanceof HttpError
        ? err.userMessage
        : 'No pudimos guardar el entrenamiento.';
      const toast = await this.toasts.create({
        message, duration: 4000, color: 'danger', position: 'bottom',
        buttons: [{ text: 'OK', role: 'cancel' }],
      });
      await toast.present();
    } finally {
      this.saving.set(false);
    }
  }
}

