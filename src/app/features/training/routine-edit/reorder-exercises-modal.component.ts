import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
  IonContent, IonFooter, ModalController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { removeCircle, reorderThree } from 'ionicons/icons';
import { RoutineEditFormService } from './routine-edit-form.service';
import { ExerciseIconComponent } from '../shared/exercise-icon.component';

/**
 * Dedicated full-screen reorder screen — Hevy pattern.
 *
 * Interaction: uses Angular CDK DragDrop (not Ionic's ion-reorder) so we
 * can require a 500 ms hold before the drag starts. Ion-reorder activates
 * immediately on touch, which felt too eager while scrolling. On desktop
 * the delay is 0 ms — hold-to-drag is a mobile ergonomic, mouse users get
 * the immediate behaviour they expect.
 *
 * The whole row is `cdkDrag` so touching anywhere on the row (icon, name,
 * chevron) starts the drag after the hold. The delete button is a
 * separate item outside the draggable area so tapping it never triggers
 * a reorder by accident.
 *
 * Reads and mutates the SAME RoutineEditFormService the page provides,
 * so changes here (reorder / delete) apply directly to the parent's
 * draft. Closing the modal does not persist to the server — save still
 * happens from the main editor's toolbar.
 */
@Component({
  selector: 'training-reorder-exercises-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DragDropModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
    IonContent, IonFooter,
    ExerciseIconComponent,
  ],
  styles: [`
    .row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--ion-color-step-150, #eee);
      background: var(--ion-background-color, #fff);
      touch-action: none;   /* let CDK own vertical touch */
      user-select: none;
    }
    .name {
      flex: 1;
      font-size: 0.95rem;
    }
    .drag-hint {
      color: var(--ion-color-medium, #666);
    }
    .remove-btn {
      --padding-start: 6px;
      --padding-end: 6px;
    }
    /* CDK preview + placeholder polish while dragging. */
    .cdk-drag-preview {
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
      background: var(--ion-background-color, #fff);
      opacity: 0.95;
    }
    .cdk-drag-placeholder {
      opacity: 0.25;
    }
    .cdk-drop-list-dragging .row:not(.cdk-drag-placeholder) {
      transition: transform 180ms cubic-bezier(0, 0, 0.2, 1);
    }
  `],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button (click)="close()" aria-label="Volver">←</ion-button>
        </ion-buttons>
        <ion-title>Reordenar</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div cdkDropList (cdkDropListDropped)="onDrop($event)">
        @for (ex of form.draft()?.exercises ?? []; track $index) {
          <div
            class="row"
            cdkDrag
            [cdkDragStartDelay]="{ touch: 500, mouse: 0 }">
            <ion-button
              fill="clear"
              size="small"
              class="remove-btn"
              (click)="remove($index)"
              aria-label="Quitar ejercicio">
              <ion-icon slot="icon-only" name="remove-circle" color="danger" />
            </ion-button>
            <training-exercise-icon [name]="ex.exerciseName" size="small" />
            <span class="name">
              {{ ex.exerciseName ?? 'Ejercicio #' + ex.exerciseId }}
            </span>
            <ion-icon name="reorder-three" class="drag-hint" aria-hidden="true" />
          </div>
        }
      </div>
    </ion-content>

    <ion-footer>
      <ion-toolbar>
        <ion-button expand="block" (click)="close()">Listo</ion-button>
      </ion-toolbar>
    </ion-footer>
  `,
})
export class ReorderExercisesModalComponent {
  /**
   * Injected by the parent editor via ModalController.componentProps.
   * ModalController does NOT inherit the parent's injector, so the
   * page-scoped RoutineEditFormService cannot be reached via inject() —
   * we receive the parent's instance as an input instead. Kept as a
   * classic @Input (not signal input) because ModalController writes
   * fields directly by name.
   */
  @Input({ required: true }) form!: RoutineEditFormService;

  private readonly modal = inject(ModalController);

  constructor() {
    addIcons({ 'remove-circle': removeCircle, 'reorder-three': reorderThree });
  }

  /** CDK gives us (previousIndex, currentIndex) — same shape as ion-reorder. */
  protected onDrop(event: CdkDragDrop<unknown>): void {
    this.form.moveExercise(event.previousIndex, event.currentIndex);
  }

  protected remove(index: number): void {
    this.form.removeExercise(index);
  }

  protected close(): void {
    this.modal.dismiss();
  }
}
