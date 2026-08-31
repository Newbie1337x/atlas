import {
  ChangeDetectionStrategy, Component, ViewContainerRef,
  inject, input, signal,
} from '@angular/core';
import {
  IonList, IonListHeader, IonLabel, IonNote, IonIcon, IonButton,
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
import { SelectSheetService } from '@shared/ui/select-sheet.service';
import { RoutineCardComponent } from './routine-card.component';

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
 */
@Component({
  selector: 'training-folder-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonList, IonListHeader, IonLabel, IonNote, IonIcon, IonButton,
    RoutineCardComponent,
  ],
  styles: [`
    .folder-header {
      cursor: pointer;
      user-select: none;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .folder-header:hover {
      opacity: 0.75;
    }
    .folder-title {
      flex: 1;
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
  `],
  template: `
    <ion-list>
      <ion-list-header class="folder-header" role="button" [attr.aria-expanded]="!collapsed()">
        <ion-icon
          [name]="collapsed() ? 'chevron-forward' : 'chevron-down'"
          (click)="toggle()"
          aria-hidden="true" />
        <ion-label class="folder-title" (click)="toggle()">
          <h2>
            {{ label() }}
            <span class="count-badge">({{ routines().length }})</span>
          </h2>
        </ion-label>
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
      </ion-list-header>

      @if (!collapsed()) {
        @if (routines().length === 0) {
          <ion-note class="ion-padding-start">Carpeta vacía</ion-note>
        } @else {
          @for (r of routines(); track r.id) {
            <training-routine-card [routine]="r" />
          }
        }
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

  protected async openMenu(folder: RoutineFolder): Promise<void> {
    const options = [
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
      leadingIcon: 'trash-outline', destructive: true } as never);
    const picked = await this.sheets.open(this.vcr, {
      header: 'Opciones de la carpeta',
      subtitle: folder.name,
      value: '',
      options,
    });
    switch (picked) {
      case 'rename':           this.actions.promptRenameFolder(folder); break;
      case 'new':              this.actions.promptCreateRoutine(folder.id); break;
      case 'reorder-routines': this.actions.openReorderRoutines(this.routines()); break;
      case 'reorder-folders':  this.actions.openReorderFolders(this.allFolders()); break;
      case 'delete':           this.actions.confirmDeleteFolder(folder); break;
    }
  }
}
