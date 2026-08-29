import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonButton, IonIcon, IonInput, IonReorder,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { addOutline, trashOutline, reorderThree } from 'ionicons/icons';
import { RoutineExercise, RoutineSet } from '@core/training/routine.model';
import { RoutineEditFormService } from './routine-edit-form.service';
import { SetEditorComponent } from './set-editor.component';
import { ExerciseIconComponent } from '../shared/exercise-icon.component';

/**
 * One exercise inside the routine editor. Renders the exercise header
 * (name + drag handle + remove button), inline inputs for rest / notes,
 * a stack of set editors, and an "add set" button.
 *
 * Delegates every mutation to the form service by index. Never mutates
 * the input directly — the input is a signal-derived view.
 */
@Component({
  selector: 'training-exercise-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonButton, IonIcon, IonInput, IonReorder,
    SetEditorComponent, ExerciseIconComponent,
  ],
  styles: [`
    .header {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .header ion-card-title {
      flex: 1;
      font-size: 1rem;
    }
    .header-legend {
      display: grid;
      grid-template-columns: 32px 60px 1fr 1fr 60px 32px;
      gap: 4px;
      padding: 4px 8px;
      font-size: 0.75em;
      color: var(--ion-color-medium, #666);
      text-transform: uppercase;
    }
    .header-legend .num { text-align: right; }
    .field-row {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
    }
    .field-row ion-input {
      flex: 1;
    }
  `],
  template: `
    <ion-card>
      <ion-card-header>
        <div class="header">
          <ion-reorder />
          <training-exercise-icon [name]="exercise().exerciseName" size="small" />
          <ion-card-title>
            {{ (index() + 1) + '. ' + (exercise().exerciseName ?? 'Ejercicio #' + exercise().exerciseId) }}
          </ion-card-title>
          <ion-button fill="clear" size="small" (click)="form.removeExercise(index())" aria-label="Quitar ejercicio">
            <ion-icon slot="icon-only" name="trash-outline" color="danger" />
          </ion-button>
        </div>
      </ion-card-header>

      <ion-card-content>
        <div class="field-row">
          <ion-input
            label="Descanso (s)"
            labelPlacement="stacked"
            type="number"
            [ngModel]="exercise().restSeconds"
            (ngModelChange)="form.updateExerciseRest(index(), numeric($event))" />
          <ion-input
            label="Notas"
            labelPlacement="stacked"
            [ngModel]="exercise().notes"
            (ngModelChange)="form.updateExerciseNotes(index(), $event)" />
        </div>

        <div class="header-legend">
          <span>Tipo</span>
          <span>Reps</span>
          <span>Max</span>
          <span>Kg</span>
          <span>RPE</span>
          <span></span>
        </div>

        @for (s of exercise().sets; track $index) {
          <training-set-editor
            [set]="s"
            (patchSet)="form.updateSet(index(), $index, $event)"
            (remove)="form.removeSet(index(), $index)" />
        }

        <ion-button expand="block" fill="outline" size="small" (click)="form.addSet(index())">
          <ion-icon slot="start" name="add-outline" />
          Agregar serie
        </ion-button>
      </ion-card-content>
    </ion-card>
  `,
})
export class ExerciseEditorComponent {
  readonly exercise = input.required<RoutineExercise>();
  readonly index = input.required<number>();

  protected readonly form = inject(RoutineEditFormService);

  constructor() {
    addIcons({ 'add-outline': addOutline, 'trash-outline': trashOutline, 'reorder-three': reorderThree });
  }

  protected numeric(raw: unknown): number | null {
    if (raw == null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
}
