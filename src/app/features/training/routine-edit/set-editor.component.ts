import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonInput, IonSelect, IonSelectOption, IonButton, IonIcon,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { closeCircle } from 'ionicons/icons';
import { RoutineSet, SetType } from '@core/training/routine.model';

/**
 * One set row inside an exercise editor. Inputs for reps range (min-max),
 * weight, RPE. Set type as a compact select (WORKING is the default and
 * the only one 95% of users touch — the others live under a small select
 * for the ones who do).
 *
 * Duration + distance columns are omitted from this compact row — they
 * apply to cardio / timed sets which the MVP does not surface. When we
 * do, they belong in a separate compact-select "kind: strength | cardio"
 * that swaps the visible column set.
 *
 * Emits a partial patch; the parent (exercise-editor) forwards to the
 * form service. Zero business logic here.
 */
@Component({
  selector: 'training-set-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    IonInput, IonSelect, IonSelectOption, IonButton, IonIcon,
  ],
  styles: [`
    .row {
      display: grid;
      grid-template-columns: 32px 60px 1fr 1fr 60px 32px;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
    }
    .row ion-input {
      --padding-start: 6px; --padding-end: 6px;
      font-size: 0.9em;
    }
    .type-label {
      font-size: 0.85em;
      text-align: center;
      color: var(--ion-color-medium, #666);
    }
    .num { text-align: right; }
  `],
  template: `
    <div class="row">
      <ion-select
        interface="popover"
        [ngModel]="set().setType"
        (ngModelChange)="patch({ setType: $event })"
        aria-label="Tipo de serie"
        class="type-label">
        <ion-select-option value="WORKING">W</ion-select-option>
        <ion-select-option value="WARMUP">C</ion-select-option>
        <ion-select-option value="DROP">D</ion-select-option>
        <ion-select-option value="FAILURE">F</ion-select-option>
      </ion-select>

      <ion-input
        type="number"
        placeholder="reps"
        aria-label="Repeticiones mínimas"
        [ngModel]="set().targetRepsMin"
        (ngModelChange)="patch({ targetRepsMin: numeric($event) })" />

      <ion-input
        type="number"
        placeholder="a"
        aria-label="Repeticiones máximas"
        [ngModel]="set().targetRepsMax"
        (ngModelChange)="patch({ targetRepsMax: numeric($event) })" />

      <ion-input
        type="number"
        inputmode="decimal"
        placeholder="kg"
        aria-label="Peso"
        [ngModel]="set().targetWeightKg"
        (ngModelChange)="patch({ targetWeightKg: numeric($event) })" />

      <ion-input
        type="number"
        inputmode="decimal"
        placeholder="RPE"
        aria-label="RPE"
        [ngModel]="set().targetRpe"
        (ngModelChange)="patch({ targetRpe: numeric($event) })" />

      <ion-button fill="clear" size="small" (click)="remove.emit()" aria-label="Quitar serie">
        <ion-icon slot="icon-only" name="close-circle" color="danger" />
      </ion-button>
    </div>
  `,
})
export class SetEditorComponent {
  readonly set = input.required<RoutineSet>();
  readonly patchSet = output<Partial<RoutineSet>>();
  readonly remove = output<void>();

  constructor() {
    addIcons({ 'close-circle': closeCircle });
  }

  protected patch(p: Partial<RoutineSet>): void {
    this.patchSet.emit(p);
  }

  /** Coerce IonInput's string / null to a number or null. Empty → null. */
  protected numeric(raw: unknown): number | null {
    if (raw == null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
}
