import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonItem, IonLabel, IonNote, IonButton, IonIcon, ActionSheetController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { ellipsisVertical } from 'ionicons/icons';
import { RoutineSummary } from '@core/training/routine.model';
import { TrainingActionsService } from '@core/training/training-actions.service';

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
  imports: [RouterLink, IonItem, IonLabel, IonNote, IonButton, IonIcon],
  template: `
    <ion-item [routerLink]="['/training/routines', routine().id]" button [detail]="false">
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
      <ion-button
        slot="end"
        fill="clear"
        size="small"
        (click)="openMenu(); $event.stopPropagation(); $event.preventDefault()"
        aria-label="Opciones de la rutina">
        <ion-icon slot="icon-only" name="ellipsis-vertical" />
      </ion-button>
    </ion-item>
  `,
})
export class RoutineCardComponent {
  readonly routine = input.required<RoutineSummary>();

  private readonly actions = inject(TrainingActionsService);
  private readonly sheets = inject(ActionSheetController);

  constructor() {
    addIcons({ 'ellipsis-vertical': ellipsisVertical });
  }

  protected readonly previewText = computed(() => {
    const previews = this.routine().exercisePreviews;
    if (previews.length === 0) return null;
    const names = previews.map(p => p.name).filter((n): n is string => !!n);
    return names.length ? names.join(' · ') : null;
  });

  protected async openMenu(): Promise<void> {
    const r = this.routine();
    const sheet = await this.sheets.create({
      header: r.title,
      buttons: [
        { text: 'Borrar rutina', role: 'destructive', handler: () => { this.actions.confirmDeleteRoutine(r); } },
        { text: 'Cancelar', role: 'cancel' },
      ],
    });
    await sheet.present();
  }
}
