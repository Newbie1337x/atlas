import {
  ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { injectQuery, injectQueryClient } from '@tanstack/angular-query-experimental';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent,
  IonIcon, IonNote, IonSpinner,
  AlertController, ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { checkmarkDoneOutline, chevronBackOutline } from 'ionicons/icons';
import { TrainingApi } from '@core/training/training.api';
import { trainingKeys } from '@core/training/training.keys';
import { HttpError } from '@core/errors/http-error';
import { SessionFormService } from './session/session-form.service';
import { RestTimerService } from './session/rest-timer.service';
import { SessionExerciseCardComponent } from './session/session-exercise-card.component';
import { SessionRestTimerComponent } from './session/session-rest-timer.component';
import { sessionToUpsertRequest } from './session/session-to-upsert';

/**
 * Active workout tracker. Route: /training/session/:routineId.
 *
 * Seed order:
 *   1. Fetch routine detail (same query as the editor caches).
 *   2. Mint a client UUID + startedAt once — form.seedFromRoutine.
 *   3. Render exercises + set rows. User checks off; rest timer kicks.
 *   4. Terminar → confirm → PUT /workouts/:uuid → POST /complete →
 *      navigate to detail. Descartar → confirm → POST /discard →
 *      navigate to /training.
 *
 * Single save at the end for MVP; upsert-per-set batching lands in
 * Slice B once we validate the flow feels right end-to-end.
 */
@Component({
  selector: 'page-training-session',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [SessionFormService, RestTimerService],
  imports: [
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent,
    IonIcon, IonNote, IonSpinner,
    SessionExerciseCardComponent, SessionRestTimerComponent,
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
          {{ form.draft()?.routineTitle ?? 'Entrenamiento' }}
          <span class="elapsed">{{ elapsedMmss() }} · {{ form.completedCount() }}/{{ form.totalCount() }} series</span>
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
        @for (ex of d.exercises; track ex.id) {
          <app-training-session-exercise-card [exercise]="ex" [index]="$index" />
        }
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
  private readonly destroyRef = inject(DestroyRef);
  protected readonly form = inject(SessionFormService);

  protected readonly saving = signal(false);

  /** Session identity — minted once on first render, stable across
   *  re-renders. Passed to the backend as the idempotency key so
   *  future upserts (Slice B) hit the same row. */
  private readonly clientUuid = freshLocalId();
  private readonly startedAt = new Date();

  /** Elapsed session time in seconds. Tick every second so the header
   *  counter animates live. */
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

  constructor() {
    addIcons({
      'checkmark-done-outline': checkmarkDoneOutline,
      'chevron-back-outline': chevronBackOutline,
    });

    // Seed the workout draft once the routine detail lands.
    effect(() => {
      const data = this.query.data();
      if (data && !this.form.loaded()) {
        this.form.seedFromRoutine(data, this.clientUuid, this.startedAt);
      }
    });

    // Session cronómetro — 1s tick, cleaned up on destroy.
    const startMs = this.startedAt.getTime();
    const tick = setInterval(() => {
      this.elapsedSeconds.set(Math.floor((Date.now() - startMs) / 1000));
    }, 1000);
    this.destroyRef.onDestroy(() => clearInterval(tick));
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

  /** Shared with the CanDeactivate guard. Returns true when the user
   *  agreed to leave (also POSTs discard so no zombie session lingers
   *  server-side). */
  async confirmDiscardIfDirty(): Promise<boolean> {
    if (!this.form.dirty()) return true;
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
      // Server-side discard is fire-and-forget — swallow errors so the
      // user can leave even if the network is dead.
      try { await firstValueFrom(this.api.discardWorkout(this.clientUuid)); }
      catch { /* ignore */ }
      this.form.markPristine();
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
    const alert = await this.alerts.create({
      header: '¿Terminar entrenamiento?',
      message: `${this.form.completedCount()} de ${this.form.totalCount()} series marcadas.`,
      buttons: [
        { text: 'Seguir entrenando', role: 'cancel' },
        { text: 'Terminar', role: 'confirm' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role !== 'confirm') return;
    await this.finalize();
  }

  private async finalize(): Promise<void> {
    const draft = this.form.draft();
    if (!draft) return;
    this.saving.set(true);
    try {
      await firstValueFrom(
        this.api.upsertWorkout(this.clientUuid, sessionToUpsertRequest(draft)));
      await firstValueFrom(this.api.completeWorkout(this.clientUuid));
      await this.queryClient.invalidateQueries({ queryKey: trainingKeys.all });
      this.form.markPristine();
      this.router.navigate(['/training/routines', draft.routineId]);
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

function freshLocalId(): string {
  return Math.random().toString(36).slice(2, 10)
       + Date.now().toString(36);
}
