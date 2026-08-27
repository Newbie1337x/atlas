import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonItem, IonLabel, IonNote, IonButton } from '@ionic/angular';
import { RoutineSummary } from '@core/training/training.model';

/**
 * One routine row in the training list. Tap the row → opens detail;
 * "Empezar" button starts a session from this routine (session page
 * consumes `?routineId=...`).
 *
 * Skinless: preview names shown as "ejA · ejB · …" so the merchant can
 * see the composition without opening the routine. Design pass replaces
 * this with icons + a proper card layout.
 */
@Component({
  selector: 'training-routine-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IonItem, IonLabel, IonNote, IonButton],
  template: `
    <ion-item [routerLink]="['/training/routines', routine().id]" button [detail]="true">
      <ion-label>
        <h3>{{ routine().title }}</h3>
        <p>
          {{ routine().totalExerciseCount }} ej ·
          {{ routine().totalSetCount }} sets
          @if (routine().estimatedDurationMinutes; as m) {
            · ~{{ m }} min
          }
        </p>
        @if (previewText(); as p) {
          <ion-note>{{ p }}</ion-note>
        }
      </ion-label>
      <ion-button
        slot="end"
        size="small"
        [routerLink]="['/training/session']"
        [queryParams]="{ routineId: routine().id }">
        Empezar
      </ion-button>
    </ion-item>
  `,
})
export class RoutineCardComponent {
  readonly routine = input.required<RoutineSummary>();

  protected readonly previewText = computed(() => {
    const previews = this.routine().exercisePreviews;
    if (previews.length === 0) return null;
    const names = previews.map(p => p.name).filter((n): n is string => !!n);
    return names.length ? names.join(' · ') : null;
  });
}
