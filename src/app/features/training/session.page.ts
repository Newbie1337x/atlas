import {
  ChangeDetectionStrategy, Component, ViewChild, computed, effect, inject,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { injectQuery } from '@tanstack/angular-query-experimental';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent,
  IonIcon, IonNote, IonSpinner,
  AlertController, ModalController, ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { addOutline, checkmarkDoneOutline, chevronBackOutline } from 'ionicons/icons';
import { TrainingApi } from '@core/training/training.api';
import { HttpError } from '@core/errors/http-error';
import { PersonalRecord } from '@core/training/personal-record.model';
import { PreviousSet } from '@core/training/workout-prepare.model';
import { ExerciseEditorComponent } from './routine-edit/exercise-editor.component';
import { ExercisePickerComponent } from './routine-edit/exercise-picker.component';
import { SessionRestTimerComponent } from './session/session-rest-timer.component';
import { SaveWorkoutModal, SaveWorkoutResult } from './session/save-workout.modal';
import { ActiveWorkoutService } from './session/active-workout.service';
import { RestPickerComponent } from './shared/rest-picker.component';

/** Wheel options for the "Duración" override: 0..30min at 1min, then
 *  30..120min at 5min, then 120..480min at 15min. Steps are stored in
 *  seconds so the picker's signature (integer seconds) stays uniform. */
const DURATION_OPTIONS: readonly number[] = (() => {
  const out: number[] = [0];
  for (let m = 1; m <= 30; m++)                out.push(m * 60);
  for (let m = 35; m <= 120; m += 5)           out.push(m * 60);
  for (let m = 135; m <= 480; m += 15)         out.push(m * 60);
  return out;
})();

/** "0" → "Apagado", "45" → "45s", "120" → "2min", "3720" → "1h 2min". */
function formatDurationSeconds(s: number): string {
  if (s === 0) return 'Apagado';
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return m === 0 ? `${h}h` : `${h}h ${m}min`;
  return `${m}min`;
}

/**
 * Active workout tracker page. Route: /training/session/:routineId.
 *
 * Thin VIEW over {@link ActiveWorkoutService} — that service (root-scoped)
 * owns the draft, elapsed timer, rest countdown and lifecycle so the
 * workout survives when the user navigates to another tab. The
 * mini-bar in the app shell (ActiveWorkoutBar) reads the same state.
 *
 * Data fetch (prepareQuery) still lives here because it is per-route
 * (routineId is a URL param). When the response lands the page seeds
 * the service via `active.start(routineId, routine)` — if a workout
 * for the same routine is already active, `start` no-ops (resume).
 */
@Component({
  selector: 'page-training-session',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent,
    IonIcon, IonNote, IonSpinner,
    ExerciseEditorComponent, SessionRestTimerComponent, RestPickerComponent,
  ],
  styles: [`
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      padding: 12px 16px;
      border-bottom: 1px solid var(--ion-color-step-100, rgba(255,255,255,0.06));
    }
    .kpi {
      display: flex; flex-direction: column;
      background: transparent; border: 0; padding: 0;
      text-align: left; cursor: default;
      /* Buttons default to their own color — force inherit so the value
         span follows ion-content's text color (light + dark safe). */
      color: inherit;
      font: inherit;
    }
    .kpi.editable { cursor: pointer; }
    .kpi-label {
      font-size: 0.8rem; color: var(--ion-color-medium, #888);
      margin-bottom: 2px;
    }
    .kpi-value {
      font-size: 1.1rem; font-weight: 600;
      /* Inherit ion-content's text color so we track light + dark mode
         without hard-coding a fallback that ends up invisible against
         the wrong background. */
      color: inherit;
      font-variant-numeric: tabular-nums;
    }
    .kpi.editable .kpi-value { color: var(--ion-color-primary, #3880ff); }
  `],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button (click)="minimize()" aria-label="Minimizar">
            <ion-icon slot="icon-only" name="chevron-back-outline" />
          </ion-button>
        </ion-buttons>
        <ion-title>
          {{ active.form.draft()?.title ?? 'Entrenamiento' }}
        </ion-title>
        <ion-buttons slot="end">
          <ion-button
            [disabled]="!active.form.loaded() || active.saving()"
            (click)="confirmTerminar()"
            aria-label="Terminar entrenamiento">
            <ion-icon slot="start" name="checkmark-done-outline" />
            Terminar
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      @if (active.isActive()) {
        <!-- KPI row: Duración (tap to edit total elapsed) · Volumen ·
             Series. Sits at the top of the content so the toolbar stays
             clean and the stats are readable at a glance. Series and
             Volumen recompute on every draft mutation via the parent
             computeds; Duración pulls the live tick from the service. -->
        <div class="kpi-row" role="list">
          <button type="button" class="kpi editable" (click)="editDuration()" role="listitem">
            <span class="kpi-label">Duración</span>
            <span class="kpi-value">{{ active.elapsedHuman() }}</span>
          </button>
          <div class="kpi" role="listitem">
            <span class="kpi-label">Volumen</span>
            <span class="kpi-value">{{ volumeLabel() }}</span>
          </div>
          <div class="kpi" role="listitem">
            <span class="kpi-label">Series</span>
            <span class="kpi-value">{{ completedCount() }}</span>
          </div>
        </div>
      }
      @if (query.isPending() && !active.isActive()) {
        <ion-spinner />
      } @else if (query.isError() && !active.isActive()) {
        <ion-note color="danger">No pudimos cargar la rutina.</ion-note>
      } @else if (active.form.draft(); as d) {
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

      <!-- Invisible wheel picker mounted at the page level. Opened
           imperatively via #durationPicker.openSheet() from the
           Duración KPI button. Same sheet UX as the rest picker. -->
      <app-training-rest-picker
        #durationPicker
        [showTrigger]="false"
        title="Duración"
        [options]="durationOptions"
        [formatValue]="formatDuration"
        [value]="active.elapsedSeconds()"
        (valueChange)="onDurationPicked($event)" />
    </ion-content>
  `,
})
export class SessionPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(TrainingApi);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);
  private readonly modal = inject(ModalController);
  protected readonly active = inject(ActiveWorkoutService);

  @ViewChild('durationPicker') private durationPicker?: RestPickerComponent;

  /** Referenced from the template — wheel picker options + formatter
   *  for the "Duración" cell. Static constants kept as fields (not
   *  computed) so change detection doesn't rebuild the arrays. */
  protected readonly durationOptions = DURATION_OPTIONS;
  protected readonly formatDuration = formatDurationSeconds;

  protected readonly routineId = computed(() => {
    const raw = this.route.snapshot.paramMap.get('routineId');
    return raw ? Number(raw) : NaN;
  });

  /** Single call at session start: routine detail + PRs + ANTERIOR
   *  ghost values. Only fetches when the active service does not
   *  already have this routine loaded — reopening the tracker from
   *  the mini-bar reuses the cached draft. */
  protected readonly query = injectQuery(() => ({
    queryKey: ['training', 'workout-prepare', this.routineId()],
    queryFn: () => firstValueFrom(this.api.prepareWorkout(this.routineId())),
    enabled: Number.isFinite(this.routineId())
      && this.active.routineId() !== this.routineId(),
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

  protected readonly completedCount = computed(() => {
    let n = 0;
    for (const ex of this.active.form.draft()?.exercises ?? []) {
      for (const s of ex.sets) if (s.completed) n++;
    }
    return n;
  });
  protected readonly totalCount = computed(() => {
    let n = 0;
    for (const ex of this.active.form.draft()?.exercises ?? []) n += ex.sets.length;
    return n;
  });

  /** Client-side total volume. Walks the draft directly (not through
   *  the service) so the reactive graph anchors on the draft signal
   *  read HERE — routing through a plain service method broke change
   *  detection for the KPI row on Ionic under OnPush. */
  protected readonly totalVolumeKg = computed(() => {
    let sum = 0;
    for (const ex of this.active.form.draft()?.exercises ?? []) {
      for (const s of ex.sets) {
        if (!s.completed) continue;
        const kg = Number(s.actualWeightKg ?? s.targetWeightKg ?? 0);
        const reps = s.actualReps ?? s.targetRepsMax ?? s.targetRepsMin ?? 0;
        if (kg > 0 && reps > 0) sum += kg * reps;
      }
    }
    return sum;
  });

  /** Compact volume label for the KPI cell — "2,372 kg" / "1.2t". */
  protected readonly volumeLabel = computed(() => {
    const kg = this.totalVolumeKg();
    if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
    return `${Math.round(kg)} kg`;
  });

  constructor() {
    addIcons({
      'add-outline': addOutline,
      'checkmark-done-outline': checkmarkDoneOutline,
      'chevron-back-outline': chevronBackOutline,
    });

    // Seed the ActiveWorkoutService from the prepare payload:
    //   - No active workout → start fresh.
    //   - Active for THIS routine → resume (no-op).
    //   - Active for a DIFFERENT routine → surface a confirm to the
    //     user before clobbering it; on decline, bounce back to the
    //     currently-active session.
    effect(() => {
      const data = this.query.data();
      if (!data) return;
      const id = this.routineId();
      if (!Number.isFinite(id)) return;
      const activeId = this.active.routineId();
      if (activeId === id) return;
      if (activeId !== null) {
        void this.confirmSwitchRoutine(data.routine, id, activeId);
        return;
      }
      this.active.start(id, data.routine);
    });
  }

  /** Toggle the check column on a set. On check-on: auto-fill actual*
   *  from target so a user who just wants to log "did the planned set"
   *  can tap once and move on. Kicks the rest timer via the root
   *  RestTimerService (owned by ActiveWorkoutService). */
  protected onCheckSet(exerciseIndex: number, setIndex: number): void {
    const set = this.active.form.draft()?.exercises[exerciseIndex]?.sets[setIndex];
    if (!set) return;
    const wasCompleted = !!set.completed;
    if (wasCompleted) {
      this.active.form.updateSet(exerciseIndex, setIndex, { completed: false });
      return;
    }
    const targetReps = set.targetRepsMax ?? set.targetRepsMin ?? null;
    this.active.form.updateSet(exerciseIndex, setIndex, {
      completed: true,
      actualReps: set.actualReps ?? targetReps,
      actualWeightKg: set.actualWeightKg ?? set.targetWeightKg,
      actualDurationSeconds: set.actualDurationSeconds ?? set.targetDurationSeconds,
    });
    const exercise = this.active.form.draft()?.exercises[exerciseIndex];
    const rest = set.restSecondsAfter ?? exercise?.restSeconds ?? 0;
    if (rest > 0) this.active.restTimer.start(rest);
  }

  /** Tap on the Duración KPI — opens the same wheel-sheet picker used
   *  for rest so the two duration inputs feel identical. The picker
   *  writes back through onDurationPicked → active.editElapsed. */
  protected editDuration(): void {
    this.durationPicker?.openSheet();
  }

  /** Picker committed — writes the new elapsed to the active service,
   *  which reshifts startedAt so the tick keeps flowing. Null (Apagado
   *  wheel row) resets to zero. */
  protected onDurationPicked(seconds: number | null): void {
    this.active.editElapsed(seconds ?? 0);
  }

  protected async openPicker(): Promise<void> {
    const modal = await this.modal.create({ component: ExercisePickerComponent });
    await modal.present();
    const { data } = await modal.onDidDismiss();
    if (data) this.active.form.addExercise(
      data.id, data.name, data.demoMediaUrl, data.capabilities);
  }

  /** Chevron-back: shrink the tracker into the mini-bar and land on
   *  the routines tab. The workout keeps ticking; the mini-bar shows
   *  the elapsed time. */
  protected minimize(): void {
    void this.router.navigate(['/training']);
  }

  /** Terminar: opens the "Guardar entreno" modal. On save →
   *  active.finalize(); on discard → active.discard(). Errors surface
   *  as a toast without leaving the tracker. */
  protected async confirmTerminar(): Promise<void> {
    const draft = this.active.form.draft();
    if (!draft) return;

    const modal = await this.modal.create({
      component: SaveWorkoutModal,
      componentProps: {
        initialTitle: draft.title ?? '',
        elapsedSeconds: this.active.elapsedSeconds(),
        totalVolumeKg: this.totalVolumeKg(),
        completedSetsCount: this.completedCount(),
        totalSetsCount: this.totalCount(),
        isDirty: this.active.form.dirty() && draft.id > 0,
      },
    });
    await modal.present();
    const result = await modal.onDidDismiss<SaveWorkoutResult | null>();
    if (result.role === 'save' && result.data) {
      try {
        await this.active.finalize(result.data.metadata, result.data.updateRoutine);
      } catch (err) {
        const message = err instanceof HttpError
          ? err.userMessage
          : (err as Error).message;
        const toast = await this.toasts.create({
          message, duration: 4000, color: 'danger', position: 'bottom',
          buttons: [{ text: 'OK', role: 'cancel' }],
        });
        await toast.present();
      }
    } else if (result.role === 'discard') {
      await this.discardFromModal();
    }
  }

  private async discardFromModal(): Promise<void> {
    await this.active.discard();
    void this.router.navigate(['/training']);
  }

  /** Prompts when the user hits a session route for routineId B while
   *  a workout for routineId A is already active. Accept → discard A
   *  and start B; decline → bounce back to A's tracker (the mini-bar
   *  would also fire an expand into A). */
  private async confirmSwitchRoutine(
    routine: import('@core/training/routine.model').RoutineDetail,
    newRoutineId: number,
    activeRoutineId: number,
  ): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Ya tenés un entreno activo',
      message: 'Si empezás este, se descarta el que estás haciendo.',
      buttons: [
        { text: 'Seguir con el actual', role: 'cancel' },
        { text: 'Descartar y empezar', role: 'destructive' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role === 'destructive') {
      await this.active.discard();
      this.active.start(newRoutineId, routine);
    } else {
      void this.router.navigate(['/training/session', activeRoutineId]);
    }
  }

  /** No-op deactivate guard — the workout survives navigation now,
   *  the mini-bar keeps it visible. Kept for the CanDeactivate hook
   *  in training.routes to still resolve to `true`. */
  confirmDiscardIfDirty(): boolean {
    return true;
  }
}
