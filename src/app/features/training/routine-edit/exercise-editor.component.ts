import {
  ChangeDetectionStrategy, Component, ViewContainerRef,
  computed, effect, inject, input, signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonButton, IonIcon, IonInput,
  ActionSheetController, AlertController, ModalController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { addOutline, caretDown, ellipsisVertical } from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { injectQuery } from '@tanstack/angular-query-experimental';
import {
  ExerciseCapabilities, PERMISSIVE_CAPS, RepsMode, RoutineExercise,
} from '@core/training/routine.model';
import { InputMode } from '@core/training/exercise.model';
import { TrainingActionsService } from '@core/training/training-actions.service';
import { TrainingApi } from '@core/training/training.api';
import { trainingKeys } from '@core/training/training.keys';
import { RoutineEditFormService } from './routine-edit-form.service';
import { SetEditorComponent } from './set-editor.component';
import { WeightModePickerService } from '../shared/weight-mode-picker.service';
import { ExerciseIconComponent } from '../shared/exercise-icon.component';
import { RestPickerComponent } from '../shared/rest-picker.component';
import { SelectSheetService } from '../shared/select-sheet.service';
import { ReorderExercisesModalComponent } from './reorder-exercises-modal.component';

/**
 * One exercise inside the routine editor. Header shows the name + a single
 * ellipsis (⋮) button that opens an ActionSheet with every per-exercise
 * action: reorder — replace — superset — delete. The old
 * inline drag handle + trash icon were removed because on a phone the
 * small tap targets competed with the tap-to-edit affordance of the card.
 *
 * Delegates every mutation to the form service by index. Never mutates
 * the exercise input directly.
 */
@Component({
  selector: 'training-exercise-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonButton, IonIcon, IonInput,
    SetEditorComponent, ExerciseIconComponent, RestPickerComponent,
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
      gap: 4px;
      padding: 4px 8px;
      font-size: 0.75em;
      color: var(--ion-color-medium, #666);
      text-transform: uppercase;
      text-align: center;
    }
    .reps-header, .weight-header {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      cursor: pointer;
      color: var(--ion-color-primary, #3880ff);
    }
    .reps-header ion-icon, .weight-header ion-icon { font-size: 0.85em; }
  `],
  template: `
    <ion-card>
      <ion-card-header>
        <!-- Header doubles as long-press target for the actions menu.
             Interactive children (the ⋮ button) still get their own tap
             because we only fire from the div's pointer stream and cancel
             on movement / early release. -->
        <div
          class="header"
          (pointerdown)="onHeaderPointerDown($event)"
          (pointerup)="cancelLongPress()"
          (pointercancel)="cancelLongPress()"
          (pointerleave)="cancelLongPress()"
          (pointermove)="onHeaderPointerMove($event)">
          <training-exercise-icon [name]="exercise().exerciseName" size="small" />
          <ion-card-title>
            {{ (index() + 1) + '. ' + (exercise().exerciseName ?? 'Ejercicio #' + exercise().exerciseId) }}
          </ion-card-title>
          <ion-button fill="clear" size="small" (click)="openMenu()" aria-label="Opciones del ejercicio">
            <ion-icon slot="icon-only" name="ellipsis-vertical" />
          </ion-button>
        </div>
      </ion-card-header>

      <ion-card-content>
        <training-rest-picker
          [value]="exercise().restSeconds"
          [subtitle]="exercise().exerciseName ?? ''"
          (valueChange)="form.updateExerciseRest(index(), $event)" />

        <ion-input
          label="Notas"
          labelPlacement="stacked"
          [ngModel]="exercise().notes"
          (ngModelChange)="form.updateExerciseNotes(index(), $event)" />

        <div class="header-legend" [style.grid-template-columns]="gridTemplate()">
          <span>Serie</span>
          @if (caps().weight) {
            @if (caps().bricks) {
              <span class="weight-header" (click)="openWeightModeSheet()">
                {{ weightHeaderLabel() }}
                <ion-icon name="caret-down" aria-hidden="true" />
              </span>
            } @else {
              <span>Kg</span>
            }
          }
          @if (caps().reps) {
            <span class="reps-header" (click)="openRepsOptions()">
              {{ repsMode() === 'RANGE' ? 'Rango de reps' : 'Reps' }}
              <ion-icon name="caret-down" aria-hidden="true" />
            </span>
          }
          @if (showRpe() && caps().rpe) { <span>RPE</span> }
          <span></span>
        </div>

        @for (s of exercise().sets; track $index) {
          <training-set-editor
            [set]="s"
            [index]="$index"
            [workingOrdinal]="workingOrdinals()[$index]"
            [exerciseName]="exercise().exerciseName ?? ''"
            [repsMode]="repsMode()"
            [showRpe]="showRpe()"
            [capabilities]="caps()"
            [inputMode]="inputMode()"
            [brickWeightKg]="brickWeight()"
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
  private readonly sheets = inject(ActionSheetController);
  private readonly alerts = inject(AlertController);
  private readonly modal = inject(ModalController);
  private readonly actions = inject(TrainingActionsService);
  private readonly selectSheet = inject(SelectSheetService);
  private readonly vcr = inject(ViewContainerRef);
  private readonly api = inject(TrainingApi);
  private readonly weightPicker = inject(WeightModePickerService);

  /**
   * Per-user KG/BRICKS preference for this exercise. Fetched only on
   * exercises that actually support bricks (MACHINE/CABLE/SMITH). 404 →
   * null (user never set anything → default KG mode). Passed down to
   * every set-editor so the row inputs and column header stay in sync.
   */
  protected readonly prefQuery = injectQuery(() => ({
    queryKey: trainingKeys.inputPreference(this.exercise().exerciseId),
    queryFn: () => firstValueFrom(
      this.api.getInputPreference(this.exercise().exerciseId)),
    enabled: this.caps().bricks,
    staleTime: 5 * 60_000,
  }));

  protected readonly inputMode = computed<InputMode>(
    () => this.prefQuery.data()?.inputMode ?? 'KG');
  protected readonly brickWeight = computed<number>(
    () => Number(this.prefQuery.data()?.brickWeightKg ?? 5));
  protected readonly weightHeaderLabel = computed(() =>
    this.inputMode() === 'BRICKS'
      ? `Ladrillos (${this.brickWeight()}kg)`
      : 'Kg');

  /** Reps mode lives on the domain (persisted per exercise); reading it
   *  as a computed keeps the template reactive to draft mutations. */
  protected readonly repsMode = computed<RepsMode>(() => this.exercise().repsMode);

  /** Server-computed input matrix for this exercise; falls back permissive. */
  protected readonly caps = computed<ExerciseCapabilities>(() =>
    this.exercise().capabilities ?? PERMISSIVE_CAPS);

  /**
   * The number this row would carry if it were WORKING. Current WORKING
   * rows get their own ordinal (1..N); non-working rows get the number
   * they would take if switched — so the "WORKING" option in the
   * dropdown previews the right label instead of a stale array index.
   *
   * Example [W W W]: opening any row's dropdown shows WORKING = 1 (all
   * three would be the first working). [W WORKING W]: rows are 1 / 1 / 2.
   */
  protected readonly workingOrdinals = computed<number[]>(() => {
    let n = 0;
    return this.exercise().sets.map(s =>
      s.setType === 'WORKING' ? ++n : n + 1);
  });

  /** Show-RPE stays a local UI-only signal — no domain field. Seeded
   *  from data once so exercises that already carry an RPE reveal the
   *  column; from there the user's toggle wins for the session. */
  protected readonly showRpe = signal<boolean>(false);

  /** Grid template mirrors the set-editor row: Serie | [Kg] | [Reps] |
   *  [RPE] | (×). Middle columns collapse when caps say the exercise
   *  doesn't support them. */
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

  /** Guards the show-RPE inference so a set edit does not fight the
   *  user's manual choice. */
  private rpeInferred = false;

  constructor() {
    addIcons({ 'add-outline': addOutline, 'caret-down': caretDown, 'ellipsis-vertical': ellipsisVertical });
    effect(() => {
      const ex = this.exercise();
      if (this.rpeInferred) return;
      this.showRpe.set(ex.sets.some(s => s.targetRpe != null));
      this.rpeInferred = true;
    }, { allowSignalWrites: true });
  }

  // ---------- Long-press on header → same ActionSheet ----------

  /** Hold duration before the menu opens, mirrors the reorder modal. */
  private static readonly LONG_PRESS_MS = 500;
  /** Any pointer movement past this cancels the hold — user is scrolling. */
  private static readonly LONG_PRESS_SLOP_PX = 8;

  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private longPressStart: { x: number; y: number } | null = null;

  protected onHeaderPointerDown(ev: PointerEvent): void {
    this.longPressStart = { x: ev.clientX, y: ev.clientY };
    this.longPressTimer = setTimeout(() => {
      this.longPressTimer = null;
      // Hold jumps straight to reorder. The ⋮ button still opens the
      // ActionSheet with rename / replace / superset / delete.
      this.openReorder();
    }, ExerciseEditorComponent.LONG_PRESS_MS);
  }

  protected onHeaderPointerMove(ev: PointerEvent): void {
    if (!this.longPressStart) return;
    const dx = ev.clientX - this.longPressStart.x;
    const dy = ev.clientY - this.longPressStart.y;
    if (dx * dx + dy * dy > ExerciseEditorComponent.LONG_PRESS_SLOP_PX ** 2) {
      this.cancelLongPress();
    }
  }

  protected cancelLongPress(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    this.longPressStart = null;
  }

  protected async openMenu(): Promise<void> {
    const ex = this.exercise();
    const sheet = await this.sheets.create({
      header: ex.exerciseName ?? `Ejercicio #${ex.exerciseId}`,
      buttons: [
        { text: 'Opciones de repeticiones', handler: () => { this.openRepsOptions(); } },
        {
          text: this.showRpe() ? 'Ocultar RPE' : 'Mostrar RPE',
          handler: () => { this.toggleRpe(); },
        },
        { text: 'Reordenar ejercicios',   handler: () => { this.openReorder(); } },
        { text: 'Reemplazar ejercicio',   handler: () => { this.actions.notImplemented('Reemplazar'); } },
        { text: 'Agregar a superserie',   handler: () => { this.actions.notImplemented('Superserie'); } },
        { text: 'Eliminar ejercicio', role: 'destructive', handler: () => { this.confirmDelete(); } },
        { text: 'Cancelar', role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  protected async openRepsOptions(): Promise<void> {
    const picked = await this.selectSheet.open(this.vcr, {
      header: 'Opciones de repeticiones',
      subtitle: this.exercise().exerciseName ?? '',
      value: this.repsMode(),
      options: [
        { label: 'Repeticiones',          value: 'SINGLE' },
        { label: 'Rango de repeticiones', value: 'RANGE' },
      ],
    });
    if (picked === 'SINGLE' || picked === 'RANGE') this.setRepsMode(picked);
  }

  /** Delegate to the shared picker — one line here, all sheet/prompt/save
   *  flow lives in WeightModePickerService and is reusable from the
   *  workout runner. */
  protected openWeightModeSheet(): Promise<void> {
    return this.weightPicker.open(
      this.vcr, this.exercise().exerciseId, this.inputMode(), this.brickWeight(),
      this.exercise().exerciseName ?? '');
  }

  /**
   * Persists the picked mode on the exercise's domain field (server
   * round-trip on save). Does NOT touch the sets — max survives on the
   * record when switching to single; only typing into the single input
   * mirror-writes min===max via set-editor.
   */
  private setRepsMode(mode: RepsMode): void {
    if (this.repsMode() === mode) return;
    this.form.updateExerciseRepsMode(this.index(), mode);
  }

  private toggleRpe(): void {
    this.showRpe.update(v => !v);
  }

  private async openReorder(): Promise<void> {
    // Modal cannot inject the page-scoped form service via DI — pass it
    // through componentProps so both sides mutate the same draft.
    const modal = await this.modal.create({
      component: ReorderExercisesModalComponent,
      componentProps: { form: this.form },
    });
    await modal.present();
  }

  private async confirmDelete(): Promise<void> {
    const ex = this.exercise();
    const alert = await this.alerts.create({
      header: 'Eliminar ejercicio',
      message: `¿Quitar "${ex.exerciseName ?? 'este ejercicio'}" de la rutina?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Eliminar', role: 'confirm', cssClass: 'ion-color-danger' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role === 'confirm') this.form.removeExercise(this.index());
  }

}
