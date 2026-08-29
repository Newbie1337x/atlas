import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
  IonContent, IonList, IonItem, IonLabel, IonReorderGroup, IonReorder,
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
 * Interaction: content that should be draggable (icon + name + chevron)
 * lives INSIDE an <ion-reorder> that stretches with flex:1. Ionic
 * activates the drag on touch anywhere inside that element — the whole
 * strip past the delete button is the drag surface. The delete button
 * stays outside the ion-reorder wrapper so tapping it never triggers a
 * drag by accident.
 *
 * Note on activation timing: Ionic's default is immediate drag on touch
 * (no long-press). If the user reports it feels too eager (accidental
 * reorders while scrolling), we would wrap the modal in a custom
 * long-press gesture and only mount ion-reorder-group after the hold
 * fires. Not needed yet.
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
    IonContent, IonList, IonItem, IonLabel, IonReorderGroup, IonReorder,
    IonFooter,
    ExerciseIconComponent,
  ],
  styles: [`
    .remove-btn {
      margin-inline-end: 8px;
    }
    /* <ion-reorder> wraps the row content and stretches to fill so the
       drag can be initiated from anywhere over the icon + name area,
       not just a tiny handle. */
    .drag-area {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 44px;
    }
    .drag-area .name {
      flex: 1;
    }
    .drag-hint {
      color: var(--ion-color-medium, #666);
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

              <!-- Everything inside ion-reorder becomes a drag target
                   (icon, name, chevron). Drag activates on touch anywhere
                   in that area. -->
              <ion-reorder class="drag-area">
                <training-exercise-icon [name]="ex.exerciseName" size="small" />
                <ion-label class="name">
                  {{ ex.exerciseName ?? 'Ejercicio #' + ex.exerciseId }}
                </ion-label>
                <ion-icon name="reorder-three" class="drag-hint" aria-hidden="true" />
              </ion-reorder>
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
