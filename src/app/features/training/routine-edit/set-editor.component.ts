import {
  ChangeDetectionStrategy, Component, ViewContainerRef,
  computed, inject, input, output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonInput, IonButton } from '@ionic/angular';
import { ExerciseCapabilities, RepsMode, RoutineSet, SetType } from '@core/training/routine.model';
import { InputMode } from '@core/training/exercise.model';
import { SelectSheetService, SelectSheetOption } from '../shared/select-sheet.service';

/** Wildly permissive default when the parent has not yet resolved the
 *  exercise's capabilities from the backend (older routines missing the
 *  computed field). Prefer showing every input over silently hiding one. */
/** Glyph shown in the row for special set types; WORKING falls through
 *  to the numeric ordinal computed by the parent. */
const GLYPH_BY_TYPE: Partial<Record<SetType, string>> = {
  WARMUP: 'W', DROP_SET: 'D', FAILURE: 'F',
};
const CLASS_BY_TYPE: Partial<Record<SetType, string>> = {
  WARMUP: 'warmup', DROP_SET: 'drop', FAILURE: 'failure',
};

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
    IonInput, IonButton,
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
    /* Kill the native number-input spinner arrows in every engine.
       Ionic's input projects a real <input type="number"> so the
       browser paints its own increment/decrement UI on top. */
    .row ion-input input[type='number']::-webkit-inner-spin-button,
    .row ion-input input[type='number']::-webkit-outer-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    .row ion-input input[type='number'] {
      -moz-appearance: textfield;
      appearance: textfield;
    }
    .serie {
      --padding-start: 0; --padding-end: 0;
      --padding-top: 0; --padding-bottom: 0;
      min-height: 32px;
      font-size: 0.95em;
      font-weight: 600;
      margin: 0;
    }
    .serie.warmup  { color: var(--ion-color-warning, #f0ad4e); }
    .serie.drop    { color: var(--ion-color-primary, #3880ff); }
    .serie.failure { color: var(--ion-color-danger,  #eb445a); }
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
      <!-- Set-type opens the same SelectSheet used for reps and weight
           mode. Included "Eliminar" as a destructive row so the whole
           set-management sits in one place — matches Hevy's picker. -->
      <ion-button
        [class]="'serie ' + selectedSerieClass()"
        fill="clear"
        (click)="openTypeSheet()"
        aria-label="Tipo de serie">
        {{ selectedTypeGlyph() }}
      </ion-button>

      <!-- Kg / Ladrillos — hidden entirely when the exercise doesn't support
           weight. Mode toggle lives in the parent's header row, not here;
           this cell just reflects the currently active mode. Persisted
           target is always kg. -->
      @if (caps().weight) {
        <ion-input
          type="number"
          inputmode="decimal"
          [placeholder]="isBricks() ? 'ladr' : 'kg'"
          [attr.aria-label]="isBricks() ? 'Cantidad de ladrillos' : 'Peso en kg'"
          [ngModel]="displayedWeight()"
          (ngModelChange)="onWeightChange($event)" />
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

    </div>
  `,
})
export class SetEditorComponent {
  readonly set = input.required<RoutineSet>();
  readonly index = input.required<number>();
  /** 1-based ordinal counting ONLY working sets. `0` while this row is
   *  not a WORKING set (warmup/drop/failure use their own letter). */
  readonly workingOrdinal = input<number>(0);
  readonly repsMode = input<RepsMode>('SINGLE');
  readonly showRpe = input<boolean>(false);
  readonly capabilities = input<ExerciseCapabilities | null>(null);
  /** Current weight-input mode (KG default). Owned by the parent
   *  exercise-editor so the header + every set stay in sync. */
  readonly inputMode = input<InputMode>('KG');
  readonly brickWeightKg = input<number>(5);
  readonly patchSet = output<Partial<RoutineSet>>();
  readonly remove = output<void>();

  private readonly sheets = inject(SelectSheetService);
  private readonly vcr = inject(ViewContainerRef);

  protected readonly isBricks = computed(() => this.inputMode() === 'BRICKS');

  /** What the input shows: kg raw, or kg÷brickWeight for bricks mode. */
  protected readonly displayedWeight = computed<number | null>(() => {
    const kg = this.set().targetWeightKg;
    if (kg == null) return null;
    if (!this.isBricks()) return kg;
    const bw = this.brickWeightKg();
    return bw > 0 ? kg / bw : null;
  });

  /** Resolved caps — never null in the template; falls back permissively. */
  protected readonly caps = computed(() => this.capabilities() ?? PERMISSIVE_CAPS);

  /** Glyph shown in the row's "Serie" cell: the ordinal for WORKING,
   *  or W/D/F for the special types. Recomputes when a sibling change
   *  shifts our number. */
  protected readonly selectedTypeGlyph = computed(() =>
    GLYPH_BY_TYPE[this.set().setType] ?? `${this.workingOrdinal() || this.index() + 1}`);

  /** Class hook so the glyph picks the same color as the sheet's chip
   *  (warmup=amber, drop=blue, failure=red). */
  protected readonly selectedSerieClass = computed(() =>
    CLASS_BY_TYPE[this.set().setType] ?? '');

  /** Set-type sheet options — includes an "Eliminar serie" row so the
   *  whole set-management sits in the same overlay (Hevy pattern). */
  protected readonly typeSheetOptions = computed<SelectSheetOption[]>(() => {
    const allowed = new Set<SetType>(this.caps().allowedSetTypes);
    const workingLabel = `${this.workingOrdinal() || this.index() + 1}`;
    const options: SelectSheetOption[] = [
      { value: 'WARMUP',   label: 'Serie de Calentamiento',
        leading: 'W', leadingColor: 'var(--ion-color-warning, #f0ad4e)' },
      { value: 'WORKING',  label: 'Serie Normal',
        leading: workingLabel },
      { value: 'FAILURE',  label: 'Serie al Fallo',
        leading: 'F', leadingColor: 'var(--ion-color-danger, #eb445a)' },
      { value: 'DROP_SET', label: 'Serie Drop',
        leading: 'D', leadingColor: 'var(--ion-color-primary, #3880ff)' },
    ].filter(o => allowed.has(o.value as SetType));
    options.push({
      value: 'remove', label: 'Eliminar serie',
      leading: '×', leadingColor: 'var(--ion-color-danger, #eb445a)',
      destructive: true,
    });
    return options;
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
    return [serie, kg, reps, rpe].filter(Boolean).join(' ');
  });

  /** Single-mode reps: mirror into both min and max so the backend keeps
   *  a consistent "N reps" value (not min:N max:null). */
  protected onSingleRepsChange(raw: unknown): void {
    const n = this.numeric(raw);
    this.patchSet.emit({ targetRepsMin: n, targetRepsMax: n });
  }

  /** Weight input change — coerces to kg. In bricks mode multiplies by
   *  the brick weight so the persisted `targetWeightKg` stays canonical. */
  protected onWeightChange(raw: unknown): void {
    const n = this.numeric(raw);
    const kg = n == null ? null : (this.isBricks() ? n * this.brickWeightKg() : n);
    this.patchSet.emit({ targetWeightKg: kg });
  }

  protected patch(p: Partial<RoutineSet>): void {
    this.patchSet.emit(p);
  }

  /** Opens the shared bottom sheet — same look as reps + weight-mode.
   *  "remove" is handled inline; every other value is a SetType. */
  protected async openTypeSheet(): Promise<void> {
    const picked = await this.sheets.open(this.vcr, {
      header: 'Seleccionar Tipo de Serie',
      value: this.set().setType,
      options: this.typeSheetOptions(),
    });
    if (picked === null) return;
    if (picked === 'remove') { this.remove.emit(); return; }
    this.patch({ setType: picked as SetType });
  }

  /** Coerce IonInput's string / null to a number or null. Empty → null. */
  protected numeric(raw: unknown): number | null {
    if (raw == null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

}
