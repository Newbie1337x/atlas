import {
  ChangeDetectionStrategy, Component, ViewContainerRef,
  computed, inject, input, signal,
} from '@angular/core';
import {
  CdkDropList, CdkDrag, CdkDragDrop,
} from '@angular/cdk/drag-drop';
import {
  IonList, IonIcon, IonButton,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  chevronDown, chevronForward, ellipsisVertical,
  pencilOutline, addCircleOutline, trashOutline,
  reorderThreeOutline, swapVerticalOutline,
} from 'ionicons/icons';
import { RoutineFolder } from '@core/training/folder.model';
import { RoutineSummary } from '@core/training/routine.model';
import { TrainingActionsService } from '@core/training/training-actions.service';
import { SelectSheetService, SelectSheetOption } from '@shared/ui/select-sheet.service';
import { RoutineCardComponent } from './routine-card.component';

/** What a folder's drop list carries — the moved item's origin/target
 *  folder id plus the list it's leaving/entering, read straight off
 *  the CDK drop event so `onDrop` needs no cross-component lookup. */
interface DropListData {
  folderId: number | null;
  routines: readonly RoutineSummary[];
}

/**
 * One folder + the routines it holds. The "loose" bucket (folderId=null)
 * uses the frontend-only label "Mis rutinas" and never renders when empty —
 * that decision lives in the parent page.
 *
 * Header renders a chevron (collapse) + the ellipsis menu on the right when
 * `folder` is set — the loose bucket has no ellipsis because there's no
 * folder to rename or delete. Actions delegate to TrainingActionsService.
 *
 * Collapse state is a per-instance signal — not persisted. See memory note
 * "folder-collapsed-persistence" for the design decision: attempted backend
 * persistence, reverted because a PUT per toggle is wrong for cosmetic UI
 * state; the right home is Capacitor Preferences (device-local, survives
 * cold starts and reboots) when we add mobile persistence infra.
 *
 * Drag-and-drop: every folder-section's routine list is a `cdkDropList`,
 * connected to every other one via the `cdkDropListGroup` the parent
 * TrainingPage puts around the whole `@for` — so a press-and-hold drag
 * can carry a routine from this folder into any other (or the loose
 * bucket) and drop it at a chosen position. `cdkDragStartDelay` (touch
 * only) is what makes it "press and hold" instead of hijacking a normal
 * vertical scroll gesture. See `onDrop` for the resulting API calls.
 */
@Component({
  selector: 'app-training-folder-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonList, IonIcon, IonButton,
    CdkDropList, CdkDrag,
    RoutineCardComponent,
  ],
  styles: [`
    /* Plain div, not ion-list-header — in iOS mode ion-list-header sets
       align-items: flex-end and only compensates ::slotted(ion-label)/
       ::slotted(ion-button) with a hand-tuned margin-top, so a bare
       ::slotted(ion-icon) (this chevron) was left pinned to the top,
       floating well above the label text. Full manual flex control here
       sidesteps that shadow-CSS quirk entirely. */
    .folder-header {
      cursor: pointer;
      user-select: none;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
    }
    .folder-header:hover {
      opacity: 0.75;
    }
    .chevron {
      font-size: 20px;
      flex-shrink: 0;
    }
    .folder-title {
      flex: 1;
      display: flex;
      align-items: baseline;
      gap: 6px;
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--ion-text-color);
    }
    .count-badge {
      font-size: 0.85em;
      color: var(--ion-color-medium, #666);
      font-weight: normal;
    }
    .menu-btn {
      --padding-start: 8px;
      --padding-end: 8px;
    }
    .routine-list {
      min-height: 8px;
    }
    .routine-list.cdk-drop-list-dragging {
      background: var(--atlas-surface, rgba(255, 255, 255, 0.03));
      border-radius: var(--atlas-radius-md, 10px);
    }
    .cdk-drag-preview {
      box-shadow: 0 8px 24px -6px rgba(0, 0, 0, 0.5);
      border-radius: var(--atlas-radius-md, 10px);
      opacity: 0.95;
    }
    .cdk-drag-placeholder {
      opacity: 0.25;
    }
    .cdk-drag-animating {
      transition: transform 200ms cubic-bezier(0, 0, 0.2, 1);
    }
  `],
  template: `
    <ion-list>
      <div class="folder-header" role="button" [attr.aria-expanded]="!collapsed()" (click)="toggle()">
        <ion-icon
          class="chevron"
          [name]="collapsed() ? 'chevron-forward' : 'chevron-down'"
          aria-hidden="true" />
        <h2 class="folder-title">
          {{ label() }}
          <span class="count-badge">({{ routines().length }})</span>
        </h2>
        @if (folder(); as f) {
          <ion-button
            fill="clear"
            size="small"
            class="menu-btn"
            (click)="openMenu(f); $event.stopPropagation()"
            aria-label="Opciones de la carpeta">
            <ion-icon slot="icon-only" name="ellipsis-vertical" />
          </ion-button>
        }
      </div>

      @if (!collapsed()) {
        <!-- No "empty folder" placeholder text — min-height alone keeps
             a small droppable strip even with zero routines, invisibly. -->
        <div
          class="routine-list"
          cdkDropList
          [cdkDropListData]="dropData()"
          (cdkDropListDropped)="onDrop($event)">
          @for (r of routines(); track r.id) {
            <app-training-routine-card
              cdkDrag
              [cdkDragData]="r"
              [cdkDragStartDelay]="dragStartDelay"
              [routine]="r" />
          }
        </div>
      }
    </ion-list>
  `,
})
export class FolderSectionComponent {
  readonly label = input.required<string>();
  readonly routines = input.required<readonly RoutineSummary[]>();
  /** Undefined for the loose bucket. Presence gates the ellipsis menu. */
  readonly folder = input<RoutineFolder | null>(null);
  /** Full folder list — needed so "Reordenar carpetas" inside the ⋮
   *  menu can operate on every folder, not just this one. */
  readonly allFolders = input<readonly RoutineFolder[]>([]);

  private readonly actions = inject(TrainingActionsService);
  private readonly sheets = inject(SelectSheetService);
  private readonly vcr = inject(ViewContainerRef);

  protected readonly collapsed = signal(false);

  /** Touch needs a deliberate press-and-hold so a normal scroll gesture
   *  doesn't get hijacked as a drag; mouse (desktop/dev) stays instant. */
  protected readonly dragStartDelay = { touch: 300, mouse: 0 };

  protected readonly dropData = computed<DropListData>(() => ({
    folderId: this.folder()?.id ?? null,
    routines: this.routines(),
  }));

  constructor() {
    addIcons({
      'chevron-down': chevronDown,
      'chevron-forward': chevronForward,
      'ellipsis-vertical': ellipsisVertical,
      'pencil-outline': pencilOutline,
      'add-circle-outline': addCircleOutline,
      'trash-outline': trashOutline,
      'reorder-three-outline': reorderThreeOutline,
      'swap-vertical-outline': swapVerticalOutline,
    });
  }

  protected toggle(): void {
    this.collapsed.update(c => !c);
  }

  /**
   * Fires on whichever folder-section's list the routine was RELEASED
   * into — CDK's event carries both `previousContainer` (source) and
   * `container` (target) data, so this single handler covers same-folder
   * reorder and cross-folder move without the two FolderSectionComponent
   * instances needing to know about each other.
   */
  protected onDrop(event: CdkDragDrop<DropListData>): void {
    const sourceFolderId = event.previousContainer.data.folderId;
    const targetFolderId = event.container.data.folderId;
    const movedRoutine = event.previousContainer.data.routines[event.previousIndex];
    if (!movedRoutine) return;

    if (event.previousContainer === event.container) {
      const reordered = [...event.container.data.routines];
      reordered.splice(event.previousIndex, 1);
      reordered.splice(event.currentIndex, 0, movedRoutine);
      void this.actions.applyRoutineDrop({
        sourceFolderId, targetFolderId,
        sourceIdsAfter: reordered.map(r => r.id),
        targetIdsAfter: reordered.map(r => r.id),
        movedRoutineId: movedRoutine.id,
      });
      return;
    }

    const sourceAfter = [...event.previousContainer.data.routines];
    sourceAfter.splice(event.previousIndex, 1);
    const targetAfter = [...event.container.data.routines];
    targetAfter.splice(event.currentIndex, 0, movedRoutine);

    void this.actions.applyRoutineDrop({
      sourceFolderId, targetFolderId,
      sourceIdsAfter: sourceAfter.map(r => r.id),
      targetIdsAfter: targetAfter.map(r => r.id),
      movedRoutineId: movedRoutine.id,
    });
  }

  protected async openMenu(folder: RoutineFolder): Promise<void> {
    // Options built as a typed array from the start — previous version
    // had `as never` casts to shove destructive rows in, which silently
    // broke re-render in some cases. Explicit type = predictable.
    const options: SelectSheetOption[] = [
      { label: 'Renombrar',                     value: 'rename',
        leadingIcon: 'pencil-outline' },
      { label: 'Nueva rutina en esta carpeta',  value: 'new',
        leadingIcon: 'add-circle-outline' },
    ];
    if (this.routines().length >= 2) {
      options.push({ label: 'Reordenar rutinas', value: 'reorder-routines',
        leadingIcon: 'reorder-three-outline' });
    }
    if (this.allFolders().length >= 2) {
      options.push({ label: 'Reordenar carpetas', value: 'reorder-folders',
        leadingIcon: 'swap-vertical-outline' });
    }
    options.push({ label: 'Borrar carpeta', value: 'delete',
      leadingIcon: 'trash-outline', destructive: true });
    const picked = await this.sheets.open(this.vcr, {
      header: 'Opciones de la carpeta',
      subtitle: folder.name,
      value: '',
      options,
    });
    switch (picked) {
      case 'rename':           this.actions.promptRenameFolder(folder); break;
      case 'new':              this.actions.promptCreateRoutine(folder.id); break;
      case 'reorder-routines': this.actions.openReorderRoutines(folder.id, this.routines()); break;
      case 'reorder-folders':  this.actions.openReorderFolders(this.allFolders()); break;
      case 'delete':           this.actions.confirmDeleteFolder(folder); break;
    }
  }
}
