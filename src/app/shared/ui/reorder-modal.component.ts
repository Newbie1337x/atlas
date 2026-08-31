import {
  ChangeDetectionStrategy, Component, Input, TemplateRef,
  inject, input,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
  IonContent, IonFooter, ModalController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { removeCircle, reorderThree } from 'ionicons/icons';

/**
 * Generic hold-to-drag reorder modal. Shared across the app —
 * exercises inside a routine, folders in the training list, routines
 * within a folder, etc.
 *
 * Consumers pass:
 *   - `title`                    header text
 *   - `items`                    the array to render
 *   - `labelFn`                  how to render each row's name
 *   - `iconTemplate` (optional)  a <ng-template let-item> for the row icon
 *   - `onMove`                   called with (from, to) whenever a drop lands
 *   - `onRemove` (optional)      when set, each row shows a red minus button
 *
 * Interaction: Angular CDK DragDrop with a 500 ms hold on touch (0 on
 * mouse) so scrolling never triggers a drag. The whole row is draggable
 * except the delete button.
 *
 * The caller is expected to keep `items` as a signal-backed reference
 * so this modal re-renders when the underlying data changes.
 */
@Component({
  selector: 'app-reorder-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet, DragDropModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
    IonContent, IonFooter,
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
    .cdk-drag-preview {
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
      background: var(--ion-background-color, #fff);
      opacity: 0.95;
    }
    .cdk-drag-placeholder { opacity: 0.25; }
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
        <ion-title>{{ title }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div cdkDropList (cdkDropListDropped)="onDrop($event)">
        @for (item of items(); track $index) {
          <div
            class="row"
            cdkDrag
            [cdkDragStartDelay]="{ touch: 500, mouse: 0 }">
            @if (onRemove) {
              <ion-button
                fill="clear"
                size="small"
                class="remove-btn"
                (click)="removeAt($index)"
                aria-label="Quitar">
                <ion-icon slot="icon-only" name="remove-circle" color="danger" />
              </ion-button>
            }
            @if (iconTemplate) {
              <ng-container *ngTemplateOutlet="iconTemplate; context: { $implicit: item }" />
            }
            <span class="name">{{ labelFn(item) }}</span>
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
export class ReorderModalComponent<T> {
  /**
   * Injected by the parent via ModalController.componentProps.
   * ModalController writes fields directly by name, so these are
   * classic @Input properties (not signal inputs) except `items`,
   * which we accept as a signal-like getter so re-renders track
   * mutations upstream.
   */
  @Input({ required: true }) title!: string;
  @Input({ required: true }) items!: () => readonly T[];
  @Input({ required: true }) labelFn!: (item: T) => string;
  @Input({ required: true }) onMove!: (from: number, to: number) => void;
  /** Optional — when set, each row renders a red minus button. */
  @Input() onRemove?: (index: number) => void;
  /** Optional per-row icon template. Receives the item as $implicit. */
  @Input() iconTemplate?: TemplateRef<{ $implicit: T }>;

  private readonly modal = inject(ModalController);

  constructor() {
    addIcons({ 'remove-circle': removeCircle, 'reorder-three': reorderThree });
  }

  protected onDrop(event: CdkDragDrop<unknown>): void {
    if (event.previousIndex === event.currentIndex) return;
    this.onMove(event.previousIndex, event.currentIndex);
  }

  protected removeAt(index: number): void {
    this.onRemove?.(index);
  }

  protected close(): void {
    this.modal.dismiss();
  }
}
