import {
  ChangeDetectionStrategy, Component, ViewContainerRef,
  computed, inject, input, output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  IonInput, IonSelect, IonSelectOption, IonButton, IonIcon,
  AlertController,
} from '@ionic/angular';
import {
  injectQuery, injectQueryClient,
} from '@tanstack/angular-query-experimental';
import { addIcons } from 'ionicons';
import { closeCircle } from 'ionicons/icons';
import { ExerciseCapabilities, RepsMode, RoutineSet } from '@core/training/routine.model';
import { InputMode } from '@core/training/exercise.model';
import { TrainingApi } from '@core/training/training.api';
import { trainingKeys } from '@core/training/training.keys';
import { SelectSheetService } from '../shared/select-sheet.service';

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
    /* kg / bricks composite cell: chip stacked above the input. */
    .weight-cell {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 2px;
    }
    .mode-chip {
      --padding-start: 4px; --padding-end: 4px;
      --padding-top: 0; --padding-bottom: 0;
      min-height: 18px;
      height: 18px;
      font-size: 0.65em;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      color: var(--ion-color-primary, #3880ff);
      margin: 0;
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

      <!-- Kg / Ladrillos — hidden entirely when the exercise doesn't support
           weight (bodyweight-only, cardio, band-only). On MACHINE/CABLE
           exercises (caps.bricks) the user can flip between counting in kg
           or in bricks; the stored target is always kg. -->
      @if (caps().weight) {
        <div class="weight-cell">
          @if (caps().bricks) {
            <ion-button
              class="mode-chip"
              size="small" fill="clear"
              (click)="openWeightModeSheet()"
              aria-label="Modo de peso">
              {{ modeLabel() }}
            </ion-button>
          }
          <ion-input
            type="number"
            inputmode="decimal"
            [placeholder]="isBricks() ? 'ladr' : 'kg'"
            [attr.aria-label]="isBricks() ? 'Cantidad de ladrillos' : 'Peso en kg'"
            [ngModel]="displayedWeight()"
            (ngModelChange)="onWeightChange($event)" />
        </div>
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
  readonly exerciseId = input.required<number>();
  readonly repsMode = input<RepsMode>('SINGLE');
  readonly showRpe = input<boolean>(false);
  readonly capabilities = input<ExerciseCapabilities | null>(null);
  readonly patchSet = output<Partial<RoutineSet>>();
  readonly remove = output<void>();

  private readonly api = inject(TrainingApi);
  private readonly queryClient = injectQueryClient();
  private readonly sheets = inject(SelectSheetService);
  private readonly alerts = inject(AlertController);
  private readonly vcr = inject(ViewContainerRef);

  /**
   * Per-exercise KG/BRICKS preference — a query keyed by exerciseId, only
   * fetched when the exercise supports bricks (MACHINE/CABLE/SMITH).
   * The backend defaults `brickWeightKg` to 5.00; a null/404 response
   * means the user never set anything → treat as KG mode.
   */
  protected readonly prefQuery = injectQuery(() => ({
    queryKey: trainingKeys.inputPreference(this.exerciseId()),
    queryFn: () => firstValueFrom(this.api.getInputPreference(this.exerciseId())),
    enabled: this.caps().bricks && Number.isFinite(this.exerciseId()),
    staleTime: 5 * 60_000,
  }));

  protected readonly inputMode = computed<InputMode>(
    () => this.prefQuery.data()?.inputMode ?? 'KG');
  protected readonly brickWeight = computed<number>(
    () => Number(this.prefQuery.data()?.brickWeightKg ?? 5));
  protected readonly isBricks = computed(() => this.inputMode() === 'BRICKS');
  protected readonly modeLabel = computed(() =>
    this.isBricks() ? `🧱 ${this.brickWeight()}kg` : 'kg');

  /** What the input shows: kg raw, or kg÷brickWeight for bricks mode. */
  protected readonly displayedWeight = computed<number | null>(() => {
    const kg = this.set().targetWeightKg;
    if (kg == null) return null;
    if (!this.isBricks()) return kg;
    const bw = this.brickWeight();
    return bw > 0 ? kg / bw : null;
  });

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

  /** Weight input change — coerces to kg. In bricks mode multiplies by
   *  the brick weight so the persisted `targetWeightKg` stays canonical. */
  protected onWeightChange(raw: unknown): void {
    const n = this.numeric(raw);
    const kg = n == null ? null : (this.isBricks() ? n * this.brickWeight() : n);
    this.patchSet.emit({ targetWeightKg: kg });
  }

  /**
   * Opens the KG/BRICKS sheet — same look as the reps sheet. Three rows
   * when bricks is currently the active mode (adds "cambiar peso"), two
   * rows otherwise. Uses two round-trips only when the picked action
   * actually changes state.
   */
  protected async openWeightModeSheet(): Promise<void> {
    const currentMode = this.inputMode();
    const currentWeight = this.brickWeight();
    const options = [
      { label: 'Kilos', value: 'KG' },
      { label: `Ladrillos (${currentWeight} kg c/u)`, value: 'BRICKS' },
    ];
    if (currentMode === 'BRICKS') {
      options.push({ label: 'Cambiar peso del ladrillo…', value: 'edit-weight' });
    }
    const picked = await this.sheets.open(this.vcr, {
      header: 'Contar el peso como',
      value: currentMode,
      options,
    });
    if (picked === null) return;
    if (picked === 'edit-weight') { await this.promptBrickWeight(currentWeight); return; }
    if (picked === currentMode) return;
    if (picked === 'BRICKS' && currentMode !== 'BRICKS') {
      // First switch → ask for the weight so the merchant doesn't get
      // stuck with the DB default silently.
      await this.saveInputPreference('BRICKS', currentWeight);
      await this.promptBrickWeight(currentWeight);
    } else {
      await this.saveInputPreference(picked as InputMode, currentWeight);
    }
  }

  private async promptBrickWeight(current: number): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Peso del ladrillo',
      inputs: [{
        name: 'kg', type: 'number', min: 0.25,
        attributes: { step: '0.25' },
        value: current, placeholder: 'kg',
      }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Guardar', role: 'confirm' },
      ],
    });
    await alert.present();
    const { role, data } = await alert.onDidDismiss<{ values: { kg: string } }>();
    if (role !== 'confirm') return;
    const kg = Number(data?.values?.kg);
    if (!Number.isFinite(kg) || kg <= 0) return;
    await this.saveInputPreference('BRICKS', kg);
  }

  private async saveInputPreference(inputMode: InputMode, brickWeightKg: number): Promise<void> {
    await firstValueFrom(this.api.putInputPreference(this.exerciseId(), {
      inputMode, brickWeightKg,
    }));
    await this.queryClient.invalidateQueries({
      queryKey: trainingKeys.inputPreference(this.exerciseId()),
    });
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
