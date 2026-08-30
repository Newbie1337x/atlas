import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonInput, IonSelect, IonSelectOption, IonButton, IonIcon,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { closeCircle } from 'ionicons/icons';
import { ExerciseCapabilities, RepsMode, RoutineSet } from '@core/training/routine.model';

/** Wildly permissive default when the parent has not yet resolved the
 *  exercise's capabilities from the backend (older routines missing the
 *  computed field). Prefer showing every input over silently hiding one. */
const PERMISSIVE_CAPS: ExerciseCapabilities = {
  weight: true, reps: true, duration: false, distance: false,
  rpe: true, bricks: false,
  allowedSetTypes: ['WORKING', 'WARMUP', 'NORMAL', 'DROP_SET', 'FAILURE'],
};

/**
 * One set row. Column order matches Hevy: Serie | Kg | Reps | [RPE] | (×).
 *
 * Serie:
 *   - WORKING rows display the set number (index + 1).
 *   - WARMUP / DROP / FAILURE show W / D / F.
 *   Numbering is a plain index+1 for the MVP — a future refinement is to
 *   number only among WORKING sets so a warmup as row 0 does not push
 *   the working numbers up.
 *
 * Reps:
 *   Lives in a single grid cell. In range mode it renders two inputs
 *   with an "a" separator so 8 a 12 reads inline; in single mode it is
 *   just one input, and typing there mirrors into both min and max on
 *   write so the backend keeps consistent "N reps" values.
 *
 * Duration + distance columns are omitted from this compact row — they
 * apply to cardio / timed sets which the MVP does not surface.
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
      text-align: center;
    }
    .serie {
      text-align: center;
      font-size: 0.9em;
      color: var(--ion-color-medium, #888);
      --min-height: 32px;
    }
    .reps-range {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .reps-range ion-input { flex: 1; }
    .reps-sep {
      font-size: 0.85em;
      color: var(--ion-color-medium, #888);
    }
  `],
  template: `
    <div class="row" [style.grid-template-columns]="gridTemplate()">
      <!-- Serie: dropdown filtered to allowed set types (WORKING option
           shows the row number). -->
      <ion-select
        class="serie"
        interface="popover"
        [ngModel]="set().setType"
        (ngModelChange)="patch({ setType: $event })"
        aria-label="Tipo de serie">
        @for (opt of typeOptions(); track opt.value) {
          <ion-select-option [value]="opt.value">{{ opt.label }}</ion-select-option>
        }
      </ion-select>

      <!-- Kg — hidden entirely when the exercise doesn't support weight
           (bodyweight-only, cardio, band-only). -->
      @if (caps().weight) {
        <ion-input
          type="number"
          inputmode="decimal"
          placeholder="kg"
          aria-label="Peso"
          [ngModel]="set().targetWeightKg"
          (ngModelChange)="patch({ targetWeightKg: numeric($event) })" />
      }

      <!-- Reps: 1 or 2 inputs sharing a single grid cell. Hidden when
           the exercise is duration/distance-only. -->
      @if (caps().reps) {
        @if (repsMode() === 'RANGE') {
          <div class="reps-range">
            <ion-input
              type="number"
              placeholder="min"
              aria-label="Repeticiones mínimas"
              [ngModel]="set().targetRepsMin"
              (ngModelChange)="patch({ targetRepsMin: numeric($event) })" />
            <span class="reps-sep">a</span>
            <ion-input
              type="number"
              placeholder="max"
              aria-label="Repeticiones máximas"
              [ngModel]="set().targetRepsMax"
              (ngModelChange)="patch({ targetRepsMax: numeric($event) })" />
          </div>
        } @else {
          <ion-input
            type="number"
            placeholder="reps"
            aria-label="Repeticiones"
            [ngModel]="set().targetRepsMin"
            (ngModelChange)="onSingleRepsChange($event)" />
        }
      }

      @if (showRpe() && caps().rpe) {
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
  readonly index = input.required<number>();
  readonly repsMode = input<RepsMode>('SINGLE');
  readonly showRpe = input<boolean>(false);
  readonly capabilities = input<ExerciseCapabilities | null>(null);
  readonly patchSet = output<Partial<RoutineSet>>();
  readonly remove = output<void>();

  /** Resolved caps — never null in the template; falls back permissively. */
  protected readonly caps = computed(() => this.capabilities() ?? PERMISSIVE_CAPS);

  /** Set-type options the backend guard will actually accept for this exercise. */
  protected readonly typeOptions = computed(() => {
    const allowed = new Set(this.caps().allowedSetTypes);
    return [
      { value: 'WORKING', label: `${this.index() + 1}` },
      { value: 'WARMUP',  label: 'W' },
      { value: 'DROP_SET', label: 'D' },
      { value: 'FAILURE',  label: 'F' },
    ].filter(o => allowed.has(o.value as never));
  });

  /** Column layout: Serie | [Kg] | [Reps] | [RPE] | (×). Any of the
   *  three middle columns collapses out of the grid entirely when the
   *  exercise's capabilities do not support it. */
  protected readonly gridTemplate = computed(() => {
    const c = this.caps();
    const serie = '48px';
    const kg = c.weight ? '1fr' : '';
    const reps = c.reps
      ? (this.repsMode() === 'RANGE' ? '1.4fr' : '1fr')
      : '';
    const rpe = (this.showRpe() && c.rpe) ? '60px' : '';
    const remove = '32px';
    return [serie, kg, reps, rpe, remove].filter(Boolean).join(' ');
  });

  /** Single-mode reps: mirror into both min and max so the backend keeps
   *  a consistent "N reps" value (not min:N max:null). */
  protected onSingleRepsChange(raw: unknown): void {
    const n = this.numeric(raw);
    this.patchSet.emit({ targetRepsMin: n, targetRepsMax: n });
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

  constructor() {
    addIcons({ 'close-circle': closeCircle });
  }
}
