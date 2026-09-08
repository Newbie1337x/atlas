import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { IonCard, IonCardHeader, IonCardTitle, IonCardContent } from '@ionic/angular';
import { WorkoutExercise, WorkoutSet } from '@core/training/workout.model';
import { ExerciseIconComponent } from '../shared/exercise-icon.component';
import { SessionFormService } from './session-form.service';
import { RestTimerService } from './rest-timer.service';
import { SessionSetRowComponent } from './session-set-row.component';

/**
 * Session card for one exercise. Header + set rows. Every set row
 * reports check + patch back up here; the card forwards to the
 * form service (mutates the workout draft) and, on check, kicks the
 * rest timer using the set's targetRestSeconds (falling back to the
 * exercise-level restSeconds).
 */
@Component({
  selector: 'app-training-session-exercise-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    ExerciseIconComponent, SessionSetRowComponent,
  ],
  styles: [`
    ion-card-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding-bottom: 8px;
    }
    ion-card-title {
      flex: 1;
      font-size: 1rem;
    }
    .header-legend {
      display: grid;
      grid-template-columns: 32px 1fr 1fr 40px;
      gap: 6px;
      padding: 4px 0;
      font-size: 0.7em;
      color: var(--ion-color-medium, #666);
      text-transform: uppercase;
      text-align: center;
    }
  `],
  template: `
    <ion-card>
      <ion-card-header>
        <app-training-exercise-icon [name]="exercise().exerciseName" size="small" />
        <ion-card-title>
          {{ (index() + 1) + '. ' + (exercise().exerciseName ?? 'Ejercicio #' + exercise().exerciseId) }}
        </ion-card-title>
      </ion-card-header>

      <ion-card-content>
        <div class="header-legend">
          <span>Serie</span>
          <span>Kg</span>
          <span>Reps</span>
          <span>✓</span>
        </div>

        @for (s of exercise().sets; track s.id) {
          <app-training-session-set-row
            [set]="s"
            (checkChange)="onCheck($index, s)"
            (patchSet)="form.updateSet(index(), $index, $event)" />
        }
      </ion-card-content>
    </ion-card>
  `,
})
export class SessionExerciseCardComponent {
  readonly exercise = input.required<WorkoutExercise>();
  readonly index = input.required<number>();

  protected readonly form = inject(SessionFormService);
  private readonly restTimer = inject(RestTimerService);

  protected onCheck(setIndex: number, set: WorkoutSet): void {
    const wasCompleted = set.completed;
    this.form.toggleSetCompleted(this.index(), setIndex);
    // Only kick the timer when transitioning to completed — unchecking
    // should not start a rest countdown.
    if (!wasCompleted) {
      const rest = set.targetRestSeconds ?? this.exercise().restSeconds ?? 0;
      if (rest > 0) this.restTimer.start(rest);
    }
  }
}
