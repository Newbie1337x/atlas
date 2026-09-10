import {
  ChangeDetectionStrategy, Component, computed, inject,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { injectQuery } from '@tanstack/angular-query-experimental';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent,
  IonIcon, IonNote, IonSpinner,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  checkmarkOutline, closeOutline, trophyOutline, timeOutline,
  barbellOutline, layersOutline,
} from 'ionicons/icons';
import { TrainingApi } from '@core/training/training.api';
import { trainingKeys } from '@core/training/training.keys';
import {
  WorkoutSummaryExercise, WorkoutSummarySet,
} from '@core/training/workout.model';

/**
 * Post-workout summary + history detail. Route
 * `/training/workouts/:id/summary`. Reads GET /workouts/:id which the
 * WorkoutDetailEnricher populates with per-set isPersonalRecord flags
 * and per-exercise names/icons.
 *
 * Two variants, selected by the `fresh` query param:
 *   - `?fresh=1` → post-workout celebration: gradient banner, "¡Buen
 *     trabajo!" heading, close CTA sends the user back to the training
 *     home. Set right after the /complete call from session.page.
 *   - no param → history view: back button, plain header. Same body.
 *
 * KPIs come from the denormalized counters (durationSeconds,
 * totalVolumeKg, totalSets) so we don't recompute per-render. The PR
 * section only renders when at least one set carries isPersonalRecord.
 */
@Component({
  selector: 'page-training-workout-summary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent,
    IonIcon, IonNote, IonSpinner,
  ],
  styleUrl: './workout-summary.page.css',
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button (click)="close()" [attr.aria-label]="fresh() ? 'Cerrar' : 'Volver'">
            <ion-icon slot="icon-only" [name]="fresh() ? 'close-outline' : 'checkmark-outline'" />
          </ion-button>
        </ion-buttons>
        <ion-title>{{ fresh() ? '¡Buen trabajo!' : (query.data()?.title ?? 'Entrenamiento') }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      @if (query.isPending()) {
        <div class="loading"><ion-spinner /></div>
      } @else if (query.isError()) {
        <ion-note color="danger">No pudimos cargar el resumen.</ion-note>
      } @else if (query.data(); as w) {
        @if (fresh()) {
          <div class="celebrate">
            <ion-icon name="trophy-outline" aria-hidden="true" />
            <div class="celebrate-copy">
              <h2>{{ w.title || 'Entrenamiento completado' }}</h2>
              <p>{{ completedAtLabel() }}</p>
            </div>
          </div>
        }

        <div class="kpis" role="list">
          <div class="kpi" role="listitem">
            <ion-icon name="time-outline" aria-hidden="true" />
            <span class="kpi-value">{{ durationLabel() }}</span>
            <span class="kpi-label">Duración</span>
          </div>
          <div class="kpi" role="listitem">
            <ion-icon name="barbell-outline" aria-hidden="true" />
            <span class="kpi-value">{{ volumeLabel() }}</span>
            <span class="kpi-label">Volumen</span>
          </div>
          <div class="kpi" role="listitem">
            <ion-icon name="layers-outline" aria-hidden="true" />
            <span class="kpi-value">{{ setsLabel() }}</span>
            <span class="kpi-label">Series</span>
          </div>
        </div>

        @if (prSets().length > 0) {
          <section class="section">
            <h3>Récords</h3>
            <ul class="pr-list">
              @for (pr of prSets(); track pr.key) {
                <li>
                  <span class="pr-badge" aria-hidden="true">🏆</span>
                  <span class="pr-name">{{ pr.exerciseName }}</span>
                  <span class="pr-detail">{{ pr.detail }}</span>
                </li>
              }
            </ul>
          </section>
        }

        <section class="section">
          <h3>Ejercicios</h3>
          <ul class="ex-list">
            @for (ex of w.exercises; track $index) {
              <li class="ex">
                <div class="ex-head">
                  <span class="ex-name">{{ ex.exerciseName ?? 'Ejercicio #' + ex.exerciseId }}</span>
                  <span class="ex-meta">{{ completedSetsFor(ex) }}/{{ ex.sets.length }} · {{ topWeightFor(ex) }}</span>
                </div>
                <ul class="ex-sets">
                  @for (s of ex.sets; track $index) {
                    <li class="ex-set" [class.done]="s.completed" [class.pr]="s.isPersonalRecord">
                      <span class="set-idx">{{ $index + 1 }}</span>
                      <span class="set-body">{{ setLabel(s) }}</span>
                      @if (s.isPersonalRecord) {
                        <span class="pr-badge" aria-label="Nuevo récord personal">🏆</span>
                      }
                    </li>
                  }
                </ul>
              </li>
            }
          </ul>
        </section>
      }
    </ion-content>
  `,
})
export class WorkoutSummaryPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(TrainingApi);

  protected readonly workoutId = computed(
    () => this.route.snapshot.paramMap.get('id') ?? '');

  /** True when this render is the post-workout celebration. Reads
   *  `?fresh=1` — set once by session.page after /complete. Re-navigating
   *  to the same URL without the query param falls back to history mode. */
  protected readonly fresh = computed(
    () => this.route.snapshot.queryParamMap.get('fresh') === '1');

  protected readonly query = injectQuery(() => ({
    queryKey: trainingKeys.workoutDetail(this.workoutId()),
    queryFn: () => firstValueFrom(this.api.getWorkoutSummary(this.workoutId())),
    enabled: this.workoutId().length > 0,
  }));

  /** Header timestamp shown in the celebration banner. Falls back to
   *  the started-at when completedAt hasn't landed (shouldn't happen
   *  after a successful /complete but the type allows null). */
  protected completedAtLabel(): string {
    const w = this.query.data();
    if (!w) return '';
    const iso = w.completedAt ?? w.startedAt;
    return new Date(iso).toLocaleString('es-AR', {
      dateStyle: 'short', timeStyle: 'short',
    });
  }

  protected durationLabel(): string {
    return this.formatDuration(this.query.data()?.durationSeconds ?? 0);
  }
  protected volumeLabel(): string {
    const kg = Number(this.query.data()?.totalVolumeKg ?? 0);
    return kg >= 1000 ? `${(kg / 1000).toFixed(1)}t` : `${Math.round(kg)}kg`;
  }
  protected setsLabel(): string {
    return String(this.query.data()?.totalSets ?? 0);
  }

  /** PR rows flattened across exercises so the "Récords" section can
   *  render them together with exercise name + set detail. Key is
   *  exerciseId + local set index — the slim shape has no set uuid. */
  protected readonly prSets = computed<PrSetRow[]>(() => {
    const w = this.query.data();
    if (!w) return [];
    const out: PrSetRow[] = [];
    for (const ex of w.exercises) {
      let i = 0;
      for (const s of ex.sets) {
        if (s.isPersonalRecord) {
          out.push({
            key: `${ex.exerciseId}/${i}`,
            exerciseName: ex.exerciseName ?? `Ejercicio #${ex.exerciseId}`,
            detail: this.setLabel(s),
          });
        }
        i++;
      }
    }
    return out;
  });

  protected completedSetsFor(ex: WorkoutSummaryExercise): number {
    let n = 0;
    for (const s of ex.sets) if (s.completed) n++;
    return n;
  }

  /** "Best set" label for the exercise row — the max weightKg among
   *  completed sets, or the total duration for isometric holds. Empty
   *  when nothing was completed. */
  protected topWeightFor(ex: WorkoutSummaryExercise): string {
    let maxKg: number | null = null;
    let maxSec: number | null = null;
    for (const s of ex.sets) {
      if (!s.completed) continue;
      if (s.weightKg != null) {
        const kg = Number(s.weightKg);
        if (maxKg == null || kg > maxKg) maxKg = kg;
      } else if (s.durationSeconds != null) {
        if (maxSec == null || s.durationSeconds > maxSec) maxSec = s.durationSeconds;
      }
    }
    if (maxKg != null) return `${maxKg}kg`;
    if (maxSec != null) return this.formatDuration(maxSec);
    return '';
  }

  protected setLabel(s: WorkoutSummarySet): string {
    const parts: string[] = [];
    if (s.weightKg != null) parts.push(`${Number(s.weightKg)}kg`);
    if (s.reps != null) parts.push(`× ${s.reps}`);
    else if (s.durationSeconds != null) parts.push(this.formatDuration(s.durationSeconds));
    if (s.distanceKm != null) parts.push(`${Number(s.distanceKm)}km`);
    return parts.join(' ') || '—';
  }

  protected close(): void {
    // Both variants land on /training — fresh so the user doesn't get
    // bounced back into the finished session route, history because the
    // page is reachable from the routine detail / list and back-to-home
    // is the safest default. Router.navigate returns a Promise we
    // deliberately drop.
    void this.router.navigate(['/training']);
  }

  constructor() {
    addIcons({
      'checkmark-outline': checkmarkOutline,
      'close-outline': closeOutline,
      'trophy-outline': trophyOutline,
      'time-outline': timeOutline,
      'barbell-outline': barbellOutline,
      'layers-outline': layersOutline,
    });
  }

  private formatDuration(totalSeconds: number): string {
    const s = Math.max(0, Math.round(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    const mm = m.toString().padStart(2, '0');
    const rr = r.toString().padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${rr}` : `${m}:${rr}`;
  }
}

interface PrSetRow {
  key: string;
  exerciseName: string;
  detail: string;
}
