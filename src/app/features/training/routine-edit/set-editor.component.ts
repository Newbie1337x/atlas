import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonInput, IonSelect, IonSelectOption, IonButton, IonIcon,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { closeCircle } from 'ionicons/icons';
import { RoutineSet } from '@core/training/routine.model';

/** How reps are edited for this row. Chosen at the exercise level and
 *  passed down — single = one number, range = min-max. */
export type RepsMode = 'single' | 'range';

/**
 * One set row inside an exercise editor. Type select + reps input(s) +
 * weight + (optional) RPE + remove.
 *
 * Layout adapts to two exercise-level preferences (passed as inputs):
 *   - repsMode: 'single' collapses reps into one column and mirrors it
 *     into both min/max on write; 'range' keeps the two-column layout.
 *   - showRpe: hides the RPE column when off. Existing values stay on
 *     the row unchanged — the toggle is UI-only.
 *
 * Duration + distance columns are omitted from this compact row — they
 * apply to cardio / timed sets which the MVP does not surface. When we
 * do, they belong in a separate compact-select "kind: strength | cardio"
 * that swaps the visible column set.
 *
 * Emits partial patches; the parent (exercise-editor) forwards to the
 * form service. Zero business logic here beyond mirror-write for single
 * reps.
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
  `],
  template: `
    <div class="row" [style.grid-template-columns]="gridTemplate()">
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
        aria-label="Repeticiones"
        [ngModel]="set().targetRepsMin"
        (ngModelChange)="onRepsMinChange($event)" />

      @if (repsMode() === 'range') {
        <ion-input
          type="number"
          placeholder="a"
          aria-label="Repeticiones máximas"
          [ngModel]="set().targetRepsMax"
          (ngModelChange)="patch({ targetRepsMax: numeric($event) })" />
      }

      <ion-input
        type="number"
        inputmode="decimal"
        placeholder="kg"
        aria-label="Peso"
        [ngModel]="set().targetWeightKg"
        (ngModelChange)="patch({ targetWeightKg: numeric($event) })" />

      @if (showRpe()) {
        <ion-input
          type="number"
          inputmode="decimal"
          placeholder="RPE"
          aria-label="RPE"
          [ngModel]="set().targetRpe"
          (ngModelChange)="patch({ targetRpe: numeric($event) })" />
      }

      <ion-button fill="clear" size="small" (click)="remove.emit()" aria-label="Quitar serie">
        <ion-icon slot="icon-only" name="close-circle" color="danger" />
      </ion-button>
    </div>
  `,
})
export class SetEditorComponent {
  readonly set = input.required<RoutineSet>();
  readonly repsMode = input<RepsMode>('range');
  readonly showRpe = input<boolean>(false);
  readonly patchSet = output<Partial<RoutineSet>>();
  readonly remove = output<void>();

  /** Column layout — reflects which optional columns are visible. */
  protected readonly gridTemplate = computed(() => {
    const type = '32px';
    const reps = this.repsMode() === 'range' ? '60px 1fr' : '1fr';
    const kg = '1fr';
    const rpe = this.showRpe() ? '60px' : '';
    const remove = '32px';
    return [type, reps, kg, rpe, remove].filter(Boolean).join(' ');
  });

  constructor() {
    addIcons({ 'close-circle': closeCircle });
  }

  /** In single mode a rep count applies to both min and max so the
   *  backend treats "10 reps" as an exact target, not a range 10-null. */
  protected onRepsMinChange(raw: unknown): void {
    const n = this.numeric(raw);
    const patch: Partial<RoutineSet> = { targetRepsMin: n };
    if (this.repsMode() === 'single') patch.targetRepsMax = n;
    this.patchSet.emit(patch);
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
