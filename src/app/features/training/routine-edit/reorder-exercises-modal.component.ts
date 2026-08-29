import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
  IonContent, IonList, IonItem, IonLabel, IonReorderGroup,
  IonFooter, ModalController, ItemReorderEventDetail,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { removeCircle, reorderThree } from 'ionicons/icons';
import { RoutineEditFormService } from './routine-edit-form.service';
import { ExerciseIconComponent } from '../shared/exercise-icon.component';

/**
 * Dedicated full-screen reorder screen — Hevy pattern. Tapping the drag
 * handle of a card in the main editor is fiddly on a phone (small target,
 * competes with the "tap to edit" affordance); this modal gives the user
 * a wide, uncluttered canvas.
 *
 * Interaction: no <ion-reorder> element inside the item on purpose —
 * that would gate dragging to only the handle area. Without it, the
 * WHOLE row is the drag target, and Ionic's built-in long-press gesture
 * (~500ms) activates the drag anywhere on the row. The trailing ≡ icon
 * is decorative only (pointer-events: none) so it does not eat the
 * touch.
 *
 * Reads and mutates the SAME RoutineEditFormService the page provides,
 * so changes here (reorder / delete) apply directly to the parent's draft.
 * Closing the modal does not persist to the server — save still happens
 * from the main editor's toolbar.
 */
@Component({
  selector: 'training-reorder-exercises-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
    IonContent, IonList, IonItem, IonLabel, IonReorderGroup,
    IonFooter,
    ExerciseIconComponent,
  ],
  styles: [`
    .remove-btn {
      margin-inline-end: 8px;
    }
    /* Decorative — the whole row is the drag target (no <ion-reorder>
       gating it), so the icon is just a visual affordance and does not
       need pointer events. */
    .drag-hint {
      color: var(--ion-color-medium, #666);
      pointer-events: none;
      margin-inline-start: 12px;
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
      <ion-list>
        <ion-reorder-group [disabled]="false" (ionItemReorder)="onReorder($event)">
          @for (ex of form.draft()?.exercises ?? []; track $index) {
            <ion-item lines="full">
              <ion-button
                slot="start"
                fill="clear"
                size="small"
                class="remove-btn"
                (click)="remove($index)"
                aria-label="Quitar ejercicio">
                <ion-icon slot="icon-only" name="remove-circle" color="danger" />
              </ion-button>
              <training-exercise-icon [name]="ex.exerciseName" size="small" />
              <ion-label class="ion-padding-start">
                {{ ex.exerciseName ?? 'Ejercicio #' + ex.exerciseId }}
              </ion-label>
              <ion-icon slot="end" name="reorder-three" class="drag-hint" aria-hidden="true" />
            </ion-item>
          }
        </ion-reorder-group>
      </ion-list>
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

  protected onReorder(ev: CustomEvent<ItemReorderEventDetail>): void {
    this.form.moveExercise(ev.detail.from, ev.detail.to);
    ev.detail.complete();
  }

  protected remove(index: number): void {
    this.form.removeExercise(index);
  }

  protected close(): void {
    this.modal.dismiss();
  }
}
