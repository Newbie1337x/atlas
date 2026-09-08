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
import { RoutineEditFormService } from './routine-edit/routine-edit-form.service';
import { ExerciseEditorComponent } from './routine-edit/exercise-editor.component';
import { ExercisePickerComponent } from './routine-edit/exercise-picker.component';
import { RestTimerService } from './session/rest-timer.service';
import { SessionRestTimerComponent } from './session/session-rest-timer.component';
import { routineDraftToUpsertRequest } from './session/session-to-upsert';

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

  protected readonly query = injectQuery(() => ({
    queryKey: trainingKeys.routineDetail(this.routineId()),
    queryFn: () => firstValueFrom(this.api.getRoutine(this.routineId())),
    enabled: Number.isFinite(this.routineId()),
  }));

  /** Personal records for every exercise in the routine — batch-fetched
   *  once the routine detail lands, so the tracker can flag live PRs
   *  client-side without one round-trip per exercise. */
  protected readonly prsQuery = injectQuery(() => {
    const ids = (this.query.data()?.exercises ?? [])
      .map(e => e.exerciseId);
    return {
      queryKey: ['training', 'personal-records', 'batch', ids.slice().sort()],
      queryFn: () => firstValueFrom(this.api.listPersonalRecordsBatch(ids)),
      enabled: ids.length > 0,
      staleTime: 60_000,
    };
  });

  /** PRs bucketed by exerciseId for O(1) lookup from the exercise
   *  card's `personalRecords` input. */
  protected readonly prsByExercise = computed<ReadonlyMap<number, PersonalRecord[]>>(() => {
    const buckets = new Map<number, PersonalRecord[]>();
    for (const pr of this.prsQuery.data() ?? []) {
      const bucket = buckets.get(pr.exerciseId) ?? [];
      bucket.push(pr);
      buckets.set(pr.exerciseId, bucket);
    }
    return buckets;
  });

  protected prsFor(exerciseId: number): readonly PersonalRecord[] {
    return this.prsByExercise().get(exerciseId) ?? [];
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
      if (data && !this.form.loaded()) this.form.loadFrom(data);
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

  protected async confirmTerminar(): Promise<void> {
    const draft = this.form.draft();
    if (!draft) return;
    const hasRoutineChanges = this.form.dirty() && draft.id > 0;
    const countsMsg = `${this.completedCount()} de ${this.totalCount()} series marcadas.`;

    // Three-option alert when the user modified targets / added sets /
    // added an exercise etc: they choose to persist those changes to
    // the routine template or discard them (workout gets saved either way).
    // Buttons carry `data` — Ionic threads it through onDidDismiss.
    const alert = await this.alerts.create({
      header: '¿Terminar entrenamiento?',
      message: hasRoutineChanges
        ? `${countsMsg} Hiciste cambios en la rutina — ¿los guardas en el template?`
        : countsMsg,
      buttons: hasRoutineChanges
        ? [
            { text: 'Cancelar', role: 'cancel' },
            { text: 'Descartar cambios', role: 'terminate' },
            { text: 'Actualizar rutina', role: 'update' },
          ]
        : [
            { text: 'Seguir entrenando', role: 'cancel' },
            { text: 'Terminar', role: 'terminate' },
          ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role === 'cancel' || role === 'backdrop') return;
    await this.finalize(role === 'update');
  }

  /** Always PUT /workouts + POST /complete. If `updateRoutine` was
   *  picked, also PUT /routines with the (edited) draft so the template
   *  reflects what the user actually wants going forward. */
  private async finalize(updateRoutine: boolean): Promise<void> {
    const draft = this.form.draft();
    if (!draft) return;
    this.saving.set(true);
    try {
      const body = routineDraftToUpsertRequest(draft, this.startedAt.toISOString());
      await firstValueFrom(this.api.upsertWorkout(this.clientUuid, body));
      await firstValueFrom(this.api.completeWorkout(this.clientUuid));
      if (updateRoutine && draft.id > 0) {
        await firstValueFrom(
          this.api.updateRoutine(draft.id, toUpdateRequest(draft)));
      }
      await this.queryClient.invalidateQueries({ queryKey: trainingKeys.all });
      this.form.markPristine();
      this.savedOrDiscarded = true;
      this.router.navigate(['/training/routines', draft.id]);
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

