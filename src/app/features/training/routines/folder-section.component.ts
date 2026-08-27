import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IonList, IonListHeader, IonLabel, IonNote } from '@ionic/angular';
import { RoutineSummary } from '@core/training/training.model';
import { RoutineCardComponent } from './routine-card.component';

/**
 * One folder + the routines it holds. The "loose" bucket (folderId=null)
 * uses the frontend-only label "Mis rutinas" and never renders when empty —
 * that decision lives in the parent page.
 *
 * No collapse / rename / delete controls yet — those land with the mutations
 * slice; keeping the read-only shape minimal.
 */
@Component({
  selector: 'training-folder-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonList, IonListHeader, IonLabel, IonNote, RoutineCardComponent],
  template: `
    <ion-list>
      <ion-list-header>
        <ion-label>
          <h2>{{ label() }}</h2>
        </ion-label>
      </ion-list-header>

      @if (routines().length === 0) {
        <ion-note class="ion-padding-start">Carpeta vacía</ion-note>
      } @else {
        @for (r of routines(); track r.id) {
          <training-routine-card [routine]="r" />
        }
      }
    </ion-list>
  `,
})
export class FolderSectionComponent {
  readonly label = input.required<string>();
  readonly routines = input.required<readonly RoutineSummary[]>();
}
