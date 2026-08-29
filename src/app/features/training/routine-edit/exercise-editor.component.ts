import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonButton, IonIcon, IonInput,
  ActionSheetController, AlertController, ModalController, ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { addOutline, ellipsisVertical } from 'ionicons/icons';
import { RoutineExercise } from '@core/training/routine.model';
import { RoutineEditFormService } from './routine-edit-form.service';
import { SetEditorComponent } from './set-editor.component';
import { ExerciseIconComponent } from '../shared/exercise-icon.component';
import { ReorderExercisesModalComponent } from './reorder-exercises-modal.component';

/**
 * One exercise inside the routine editor. Header shows the name + a single
 * ellipsis (⋮) button that opens an ActionSheet with every per-exercise
 * action (Hevy pattern): reorder — replace — superset — delete. The old
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
  private readonly sheets = inject(ActionSheetController);
  private readonly alerts = inject(AlertController);
  private readonly modal = inject(ModalController);
  private readonly toasts = inject(ToastController);

  constructor() {
    addIcons({ 'add-outline': addOutline, 'ellipsis-vertical': ellipsisVertical });
  }

  protected numeric(raw: unknown): number | null {
    if (raw == null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
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
      // Hold jumps straight to reorder — Hevy pattern. The ⋮ button still
      // opens the ActionSheet with rename / replace / superset / delete.
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
        { text: 'Reordenar ejercicios',   handler: () => { this.openReorder(); } },
        { text: 'Reemplazar ejercicio',   handler: () => { this.notImplemented('Reemplazar'); } },
        { text: 'Agregar a superserie',   handler: () => { this.notImplemented('Superserie'); } },
        { text: 'Eliminar ejercicio', role: 'destructive', handler: () => { this.confirmDelete(); } },
        { text: 'Cancelar', role: 'cancel' },
      ],
    });
    await sheet.present();
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

  private async notImplemented(feature: string): Promise<void> {
    const toast = await this.toasts.create({
      message: `${feature}: próximamente`,
      duration: 1500,
      position: 'bottom',
    });
    await toast.present();
  }
}
