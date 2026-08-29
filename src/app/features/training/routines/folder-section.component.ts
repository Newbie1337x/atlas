import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import {
  IonList, IonListHeader, IonLabel, IonNote, IonIcon, IonButton, ActionSheetController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chevronDown, chevronForward, ellipsisVertical } from 'ionicons/icons';
import { RoutineFolder } from '@core/training/folder.model';
import { RoutineSummary } from '@core/training/routine.model';
import { TrainingActionsService } from '@core/training/training-actions.service';
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
 * Collapse state:
 *   - For real folders it lives on the backend (RoutineFolder.collapsed —
 *     persisted per-account so a device switch keeps the layout).
 *   - For the loose "Mis rutinas" bucket there is no server row, so the
 *     signal is per-instance and does not persist. Cheap trade-off; the
 *     loose bucket is usually expanded anyway.
 *
 * Toggle flips a local signal optimistically for instant feedback, then
 * calls the backend and lets the invalidation re-sync. An effect keeps
 * the local signal aligned with the incoming input on data refetches.
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

  private readonly actions = inject(TrainingActionsService);
  private readonly sheets = inject(ActionSheetController);

  protected readonly collapsed = signal(false);

  constructor() {
    addIcons({
      'chevron-down': chevronDown,
      'chevron-forward': chevronForward,
      'ellipsis-vertical': ellipsisVertical,
    });
    // Keep the local signal aligned with the server value whenever the
    // folder input updates (initial render + every list refetch).
    effect(() => {
      const f = this.folder();
      this.collapsed.set(f?.collapsed ?? false);
    });
  }

  protected toggle(): void {
    const next = !this.collapsed();
    this.collapsed.set(next);
    const f = this.folder();
    // Loose bucket has no server row → stays local. Real folders persist.
    if (f) this.actions.toggleFolderCollapsed(f);
  }

  protected async openMenu(folder: RoutineFolder): Promise<void> {
    const sheet = await this.sheets.create({
      header: folder.name,
      buttons: [
        { text: 'Renombrar', handler: () => { this.actions.promptRenameFolder(folder); } },
        { text: 'Nueva rutina en esta carpeta', handler: () => { this.actions.promptCreateRoutine(folder.id); } },
        { text: 'Borrar carpeta', role: 'destructive', handler: () => { this.actions.confirmDeleteFolder(folder); } },
        { text: 'Cancelar', role: 'cancel' },
      ],
    });
    await sheet.present();
  }
}
