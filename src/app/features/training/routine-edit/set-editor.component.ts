import {
  ChangeDetectionStrategy, Component, ViewContainerRef,
  computed, inject, input, output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonInput, IonButton, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { checkmarkOutline } from 'ionicons/icons';
import {
  ExerciseCapabilities, PERMISSIVE_CAPS, RepsMode, RoutineSet, SetType,
} from '@core/training/routine.model';
import { InputMode } from '@core/training/exercise.model';
import { SelectSheetService, SelectSheetOption } from '@shared/ui/select-sheet.service';
import { RoutineEditFormService } from './routine-edit-form.service';

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
  selector: 'app-training-set-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    IonInput, IonButton, IonIcon,
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
    .check-btn {
      width: 32px; height: 32px;
      border-radius: 8px;
      border: 1px solid var(--ion-color-step-300, #ccc);
      background: transparent;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: var(--ion-color-medium, #888);
    }
    .check-btn.on {
      background: var(--ion-color-success, #2dd36f);
      border-color: var(--ion-color-success, #2dd36f);
      color: #fff;
    }
    .check-btn ion-icon { font-size: 1.2rem; }
    .check-cell {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .pr-badge {
      font-size: 1rem;
      line-height: 1;
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
           weight. Session mode binds to actualWeightKg (workout log) with
           the target as placeholder; editor mode binds to targetWeightKg
           directly. -->
      @if (caps().weight) {
        <ion-input
          type="text"
          inputmode="decimal"
          (ionFocus)="clearOnFocus($event)"
          [placeholder]="weightPlaceholder()"
          [attr.aria-label]="isBricks() ? 'Cantidad de ladrillos' : 'Peso en kg'"
          [ngModel]="displayedWeight()"
          (ngModelChange)="onWeightChange($event)" />
      }

      <!-- Reps: session mode always collapses to a single input showing
           the range (or single target) as placeholder. Editor mode keeps
           the two-input RANGE / single input SINGLE split for template
           editing. -->
      @if (caps().reps) {
        @if (showCheck()) {
          <ion-input
            type="text"
            inputmode="numeric"
            (ionFocus)="clearOnFocus($event)"
            [placeholder]="repsPlaceholder()"
            aria-label="Repeticiones realizadas"
            [ngModel]="set().actualReps"
            (ngModelChange)="patch({ actualReps: numeric($event) })" />
        } @else if (repsMode() === 'RANGE') {
          <div class="reps-range">
            <ion-input
              type="text"
              inputmode="numeric"
              (ionFocus)="clearOnFocus($event)"
              [placeholder]="placeholderFor('repsMin', 'min')"
              aria-label="Repeticiones mínimas"
              [ngModel]="set().targetRepsMin"
              (ngModelChange)="patch({ targetRepsMin: numeric($event) })" />
            <span class="reps-sep">a</span>
            <ion-input
              type="text"
              inputmode="numeric"
              (ionFocus)="clearOnFocus($event)"
              [placeholder]="placeholderFor('repsMax', 'max')"
              aria-label="Repeticiones máximas"
              [ngModel]="set().targetRepsMax"
              (ngModelChange)="patch({ targetRepsMax: numeric($event) })" />
          </div>
        } @else {
          <ion-input
            type="text"
            inputmode="numeric"
            (ionFocus)="clearOnFocus($event)"
            [placeholder]="placeholderFor('reps', 'reps')"
            aria-label="Repeticiones"
            [ngModel]="set().targetRepsMin"
            (ngModelChange)="onSingleRepsChange($event)" />
        }
      }

      <!-- Duration — rendered when caps allow it (isometric holds:
           plank, l-sit, wall sit) and reps aren't the active mode.
           Input accepts mm:ss OR raw seconds; parsed by seconds(). -->
      @if (caps().duration && !caps().reps) {
        <ion-input
          type="text"
          inputmode="numeric"
          (ionFocus)="clearOnFocus($event)"
          [placeholder]="placeholderFor('duration', 'seg')"
          aria-label="Duración"
          [ngModel]="displayedDuration()"
          (ngModelChange)="onDurationChange($event)" />
      }

      @if (showRpe() && caps().rpe) {
        <ion-input
          type="text"
          inputmode="decimal"
          (ionFocus)="clearOnFocus($event)"
          [placeholder]="placeholderFor('rpe', 'RPE')"
          aria-label="RPE"
          [ngModel]="set().targetRpe"
          (ngModelChange)="patch({ targetRpe: numeric($event) })" />
      }

      <!-- Session-mode check column. Present only when the parent
           opted in via showCheck. Toggling emits checkChange; the
           session page mutates set.completed + kicks the rest timer.
           When isPr is true, a 🏆 badge sits inline before the check. -->
      @if (showCheck()) {
        <span class="check-cell">
          @if (isPr()) {
            <span class="pr-badge" aria-label="Nuevo récord personal">🏆</span>
          }
          <button
            type="button"
            class="check-btn"
            [class.on]="!!set().completed"
            [attr.aria-pressed]="!!set().completed"
            (click)="checkChange.emit()">
            <ion-icon name="checkmark-outline" aria-hidden="true" />
          </button>
        </span>
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
  /** Shown as a grey subtitle on the set-type sheet so the merchant
   *  sees which exercise this row belongs to. */
  readonly exerciseName = input<string>('');
  /** Session mode — when true, render the check column on the right
   *  and emit `checkChange` on tap. Off in the routine editor. */
  readonly showCheck = input<boolean>(false);
  /** Session-only: when true, render a 🏆 badge next to the check —
   *  the set's actuals beat this exercise's current PR client-side. */
  readonly isPr = input<boolean>(false);
  readonly patchSet = output<Partial<RoutineSet>>();
  readonly remove = output<void>();
  readonly checkChange = output<void>();

  private readonly sheets = inject(SelectSheetService);
  private readonly vcr = inject(ViewContainerRef);
  private readonly form = inject(RoutineEditFormService);

  constructor() {
    addIcons({ 'checkmark-outline': checkmarkOutline });
  }

  protected readonly isBricks = computed(() => this.inputMode() === 'BRICKS');

  /** What the input shows: kg raw, or kg÷brickWeight for bricks mode.
   *  Session mode reads actualWeightKg (workout log); editor reads
   *  targetWeightKg (template). */
  protected readonly displayedWeight = computed<number | null>(() => {
    const s = this.set();
    const kg = this.showCheck() ? s.actualWeightKg : s.targetWeightKg;
    if (kg == null) return null;
    if (!this.isBricks()) return Number(kg);
    const bw = this.brickWeightKg();
    return bw > 0 ? Number(kg) / bw : null;
  });

  /** Session mode uses target as placeholder so the user sees the plan
   *  while typing what they actually did. Editor keeps its own reference
   *  system (last-saved value via placeholderFor). */
  protected readonly weightPlaceholder = computed<string>(() => {
    if (!this.showCheck()) {
      return this.placeholderFor('kg', this.isBricks() ? 'ladr' : 'kg');
    }
    const t = this.set().targetWeightKg;
    return t == null ? (this.isBricks() ? 'ladr' : 'kg') : String(t);
  });

  /** Session-mode reps placeholder: RANGE routines show "min-max"
   *  (Hevy's convention), single routines show the raw target. */
  protected readonly repsPlaceholder = computed<string>(() => {
    const s = this.set();
    if (this.repsMode() === 'RANGE') {
      const lo = s.targetRepsMin, hi = s.targetRepsMax;
      if (lo != null && hi != null) return `${lo}-${hi}`;
      if (hi != null) return String(hi);
      if (lo != null) return String(lo);
    } else if (s.targetRepsMin != null) {
      return String(s.targetRepsMin);
    }
    return 'reps';
  });

  /** Duration rendered in mm:ss when >= 60s, else raw seconds. Same
   *  input accepts either format on the way in (see onDurationChange). */
  protected readonly displayedDuration = computed<string>(() => {
    const s = this.set().targetDurationSeconds;
    if (s == null) return '';
    return s < 60 ? String(s) : formatMmSs(s);
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

  /** Column layout: Serie | [Kg] | [Reps] | [Tiempo] | [RPE]. Any
   *  middle column collapses out of the grid when caps say the
   *  exercise doesn't use that metric. Tiempo only shows when the
   *  exercise supports duration AND reps isn't its primary metric
   *  (isometric holds — plank, l-sit, wall sit). */
  protected readonly gridTemplate = computed(() => {
    const c = this.caps();
    const serie = '48px';
    const kg = c.weight ? '1fr' : '';
    const reps = c.reps
      ? (this.repsMode() === 'RANGE' ? '1.4fr' : '1fr')
      : '';
    const duration = (c.duration && !c.reps) ? '1fr' : '';
    const rpe = (this.showRpe() && c.rpe) ? '60px' : '';
    const check = this.showCheck() ? '40px' : '';
    return [serie, kg, reps, duration, rpe, check].filter(Boolean).join(' ');
  });

  /** Single-mode reps: mirror into both min and max so the backend keeps
   *  a consistent "N reps" value (not min:N max:null). */
  protected onSingleRepsChange(raw: unknown): void {
    const n = this.numeric(raw);
    this.patchSet.emit({ targetRepsMin: n, targetRepsMax: n });
  }

  /** Weight input change — coerces to kg. In bricks mode multiplies by
   *  the brick weight so the persisted weight stays canonical. Session
   *  mode writes actualWeightKg (workout log); editor writes
   *  targetWeightKg (template). */
  protected onWeightChange(raw: unknown): void {
    const n = this.numeric(raw);
    const kg = n == null ? null : (this.isBricks() ? n * this.brickWeightKg() : n);
    this.patchSet.emit(
      this.showCheck() ? { actualWeightKg: kg } : { targetWeightKg: kg });
  }

  /** Duration parses "1:30" as 90 seconds, or a raw number as seconds.
   *  Persists as int seconds in targetDurationSeconds. */
  protected onDurationChange(raw: unknown): void {
    this.patchSet.emit({ targetDurationSeconds: parseMmSs(raw) });
  }

  protected patch(p: Partial<RoutineSet>): void {
    this.patchSet.emit(p);
  }

  /** Opens the shared bottom sheet — same look as reps + weight-mode.
   *  "remove" is handled inline; every other value is a SetType. */
  protected async openTypeSheet(): Promise<void> {
    const picked = await this.sheets.open(this.vcr, {
      header: 'Seleccionar Tipo de Serie',
      subtitle: this.exerciseName(),
      value: this.set().setType,
      options: this.typeSheetOptions(),
    });
    if (picked === null) return;
    if (picked === 'remove') { this.remove.emit(); return; }
    this.patch({ setType: picked as SetType });
  }

  /**
   * The saved reference value for a named field — from the last time
   * the routine was loaded from the backend (see
   * RoutineEditFormService.originalSetById). Independent of what the
   * user has been typing this session: even after edit + delete cycles,
   * this stays as the "what was there when I opened this routine"
   * anchor. Refreshes only on Save + refetch. New sets (id = 0) have
   * no snapshot → returns empty and the placeholder falls back to the
   * unit hint.
   *
   * Bricks mode: convert the kg snapshot into bricks so the displayed
   * placeholder matches the input's own unit.
   */
  private savedFor(name: string): string {
    const original = this.form.originalSetById(this.set().id);
    if (!original) return '';
    if (name === 'kg') {
      const kg = original.targetWeightKg;
      if (kg == null) return '';
      if (this.isBricks()) {
        const bw = this.brickWeightKg();
        return bw > 0 ? String(kg / bw) : '';
      }
      return String(kg);
    }
    if (name === 'duration') {
      const s = original.targetDurationSeconds;
      return s == null ? '' : (s < 60 ? String(s) : formatMmSs(s));
    }
    const raw = name === 'repsMax' ? original.targetRepsMax
              : name === 'rpe'     ? original.targetRpe
              :                      original.targetRepsMin;  // reps + repsMin
    return raw == null ? '' : String(raw);
  }

  /** Placeholder for a numeric input: saved reference value if present,
   *  otherwise the unit hint. Browser only paints it when the input is
   *  visually empty, which happens on load (untouched new sets), on
   *  focus (we clear the DOM), or after the user backspaces to empty. */
  protected placeholderFor(name: string, fallback: string): string {
    return this.savedFor(name) || fallback;
  }

  /**
   * On focus: clear the DOM value without firing an input event so the
   * model keeps the old number and the browser shows the placeholder
   * (which is now the saved reference). If the user blurs without
   * having typed anything, restore the value that was there at focus
   * time (which may not be the saved snapshot — it's whatever the
   * user had before this tap).
   *
   * No text selection ever happens, so Chrome Android's ActionMode
   * popup (Traducir/Cortar/Copiar/Pegar) never appears — works
   * identically in Capacitor.
   */
  protected clearOnFocus(ev: Event): void {
    const el = ev.target as HTMLIonInputElement | null;
    void el?.getInputElement().then(native => {
      if (!native) return;
      const prev = native.value;
      native.value = '';
      let touched = false;
      const onInput = () => { touched = true; };
      const onBlur = () => {
        native.removeEventListener('input', onInput);
        native.removeEventListener('blur', onBlur);
        if (!touched && native.value === '' && prev) {
          native.value = prev;
          native.dispatchEvent(new Event('input', { bubbles: true }));
        }
      };
      native.addEventListener('input', onInput);
      native.addEventListener('blur', onBlur);
    });
  }

  /** Coerce IonInput's string / null to a number or null. Empty → null. */
  protected numeric(raw: unknown): number | null {
    if (raw == null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

}

/**
 * Format a positive int of seconds as "m:ss". Under 60s we return the
 * raw number instead so short holds read as "30" not "0:30".
 * Undefined → ''.
 */
function formatMmSs(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Parse the duration input. Accepts:
 *   "90"    → 90     (raw seconds)
 *   "1:30"  → 90     (mm:ss)
 *   "1:5"   → 65     (mm:ss with 1-digit seconds still valid)
 *   ""      → null
 * Invalid input → null so the model clears instead of holding garbage.
 */
function parseMmSs(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const str = String(raw).trim();
  if (str.includes(':')) {
    const [mmStr, ssStr = '0'] = str.split(':');
    const mm = Number(mmStr);
    const ss = Number(ssStr);
    if (!Number.isFinite(mm) || !Number.isFinite(ss) || ss < 0 || ss >= 60) return null;
    return Math.max(0, Math.trunc(mm * 60 + ss));
  }
  const n = Number(str);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
}
