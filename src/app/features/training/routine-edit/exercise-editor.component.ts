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
import { RoutineExercise } from '@core/training/routine.model';
import { TrainingActionsService } from '@core/training/training-actions.service';
import { RoutineEditFormService } from './routine-edit-form.service';
import { RepsMode, SetEditorComponent } from './set-editor.component';
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
    .reps-header {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      cursor: pointer;
      color: var(--ion-color-primary, #3880ff);
    }
    .reps-header ion-icon { font-size: 0.85em; }
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
          (valueChange)="form.updateExerciseRest(index(), $event)" />

        <ion-input
          label="Notas"
          labelPlacement="stacked"
          [ngModel]="exercise().notes"
          (ngModelChange)="form.updateExerciseNotes(index(), $event)" />

        <div class="header-legend" [style.grid-template-columns]="gridTemplate()">
          <span>Serie</span>
          <span>Kg</span>
          <span class="reps-header" (click)="openRepsOptions()">
            {{ repsMode() === 'range' ? 'Rango de reps' : 'Reps' }}
            <ion-icon name="caret-down" aria-hidden="true" />
          </span>
          @if (showRpe()) { <span>RPE</span> }
          <span></span>
        </div>

        @for (s of exercise().sets; track $index) {
          <training-set-editor
            [set]="s"
            [index]="$index"
            [repsMode]="repsMode()"
            [showRpe]="showRpe()"
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

  /**
   * Per-exercise view preferences. Inferred from the initial data
   * (sets with min === max → single; any set with a non-null RPE →
   * showRpe on) and then mutable via the ⋮ menu. Not persisted
   * server-side; when the editor is reopened the same inference runs
   * again on whatever the routine now contains.
   */
  protected readonly repsMode = signal<RepsMode>('range');
  protected readonly showRpe = signal<boolean>(false);

  /** Grid template mirrors the set-editor row so the legend + data
   *  align: Serie | Kg | Reps | [RPE] | (×). */
  protected readonly gridTemplate = computed(() => {
    const serie = '48px';
    const kg = '1fr';
    const reps = this.repsMode() === 'range' ? '1.4fr' : '1fr';
    const rpe = this.showRpe() ? '60px' : '';
    const remove = '32px';
    return [serie, kg, reps, rpe, remove].filter(Boolean).join(' ');
  });

  /** Guards the inference below — once the user opens the menu and
   *  toggles anything, their choice wins even if the raw data would
   *  suggest otherwise. */
  private inferred = false;

  constructor() {
    addIcons({ 'add-outline': addOutline, 'caret-down': caretDown, 'ellipsis-vertical': ellipsisVertical });
    // Seed the view preferences from the initial data ONCE. Later set
    // edits (e.g. mirror-write in single mode) must not flip the mode
    // back and forth.
    effect(() => {
      const ex = this.exercise();
      if (this.inferred) return;
      const inferredMode: RepsMode = ex.sets.every(s => s.targetRepsMin === s.targetRepsMax)
        ? 'single' : 'range';
      this.repsMode.set(inferredMode);
      this.showRpe.set(ex.sets.some(s => s.targetRpe != null));
      this.inferred = true;
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
      value: this.repsMode(),
      options: [
        { label: 'Repeticiones',          value: 'single' },
        { label: 'Rango de repeticiones', value: 'range' },
      ],
    });
    if (picked === 'single' || picked === 'range') this.setRepsMode(picked);
  }

  /**
   * When switching TO single mode, mirror every set's max into its min
   * so the backend sees consistent "N reps" values (min===max). When
   * switching TO range, leave the data as-is — user can widen max
   * per-set from there.
   */
  private setRepsMode(mode: RepsMode): void {
    if (this.repsMode() === mode) return;
    this.repsMode.set(mode);
    if (mode === 'single') {
      const ex = this.exercise();
      ex.sets.forEach((s, i) => {
        if (s.targetRepsMin !== s.targetRepsMax) {
          this.form.updateSet(this.index(), i, { targetRepsMax: s.targetRepsMin });
        }
      });
    }
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
