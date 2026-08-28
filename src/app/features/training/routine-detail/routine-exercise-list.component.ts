import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IonList, IonItem, IonLabel, IonNote } from '@ionic/angular';
import { RoutineExercise } from '@core/training/routine.model';

/**
 * Read-only render of a routine's exercises + sets. Skinless — plays the
 * role of a table of contents for the routine. The editor (add/remove/
 * reorder) is Slice 3b.
 *
 * Sets show whichever target dimension is populated on the row (reps
 * range, weight, duration, distance, RPE) — the backend leaves fields
 * null when they don't apply to that set type.
 */
@Component({
  selector: 'training-routine-exercise-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonList, IonItem, IonLabel, IonNote],
  styles: [`
    .ex-header {
      display: flex;
      align-items: baseline;
      gap: 8px;
    }
    .rest {
      color: var(--ion-color-medium, #666);
      font-size: 0.85em;
    }
    .set-line {
      font-size: 0.9em;
      color: var(--ion-color-medium, #666);
      padding-left: 8px;
    }
  `],
  template: `
    @if (exercises().length === 0) {
      <ion-note class="ion-padding-start">Sin ejercicios todavía.</ion-note>
    } @else {
      <ion-list>
        @for (ex of exercises(); track ex.id) {
          <ion-item lines="full">
            <ion-label>
              <div class="ex-header">
                <h3>{{ ex.orderIndex + 1 }}. {{ ex.exerciseName ?? 'Ejercicio #' + ex.exerciseId }}</h3>
                @if (ex.restSeconds; as r) {
                  <span class="rest">· descanso {{ r }}s</span>
                }
              </div>
              @if (ex.notes; as n) {
                <p>{{ n }}</p>
              }
              @for (s of ex.sets; track s.id) {
                <div class="set-line">
                  {{ s.orderIndex + 1 }}. {{ setLabel(s) }}
                </div>
              }
            </ion-label>
          </ion-item>
        }
      </ion-list>
    }
  `,
})
export class RoutineExerciseListComponent {
  readonly exercises = input.required<readonly RoutineExercise[]>();

  /** Compact "8-12 reps · 60kg · RPE 8" line — skips null dimensions. */
  protected setLabel(s: RoutineExercise['sets'][number]): string {
    const parts: string[] = [];
    if (s.targetRepsMin != null || s.targetRepsMax != null) {
      const min = s.targetRepsMin ?? '?';
      const max = s.targetRepsMax ?? '?';
      parts.push(min === max ? `${min} reps` : `${min}-${max} reps`);
    }
    if (s.targetWeightKg != null) parts.push(`${s.targetWeightKg}kg`);
    if (s.targetDurationSeconds != null) parts.push(`${s.targetDurationSeconds}s`);
    if (s.targetDistanceKm != null) parts.push(`${s.targetDistanceKm}km`);
    if (s.targetRpe != null) parts.push(`RPE ${s.targetRpe}`);
    if (s.setType !== 'WORKING') parts.push(`(${s.setType.toLowerCase()})`);
    return parts.length > 0 ? parts.join(' · ') : '—';
  }
}
