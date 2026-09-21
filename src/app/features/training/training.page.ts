import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { injectQuery } from '@tanstack/angular-query-experimental';
import { CdkDropListGroup } from '@angular/cdk/drag-drop';
import {
  IonContent, IonHeader, IonTitle, IonToolbar,
  IonNote, IonSpinner, IonIcon,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  flameOutline, compassOutline, folderOpenOutline, addCircleOutline,
} from 'ionicons/icons';
import { TrainingApi } from '@core/training/training.api';
import { TrainingActionsService } from '@core/training/training-actions.service';
import { trainingKeys } from '@core/training/training.keys';
import {
  groupRoutinesByFolder, RoutineBucket,
} from './routines/grouped-routines.util';
import { FolderSectionComponent } from './routines/folder-section.component';

/**
 * Training tab landing:
 *   1. Header actions to start an empty workout / open explore.
 *   2. Folder sections in displayOrder, each with its routines
 *      sorted by displayOrder.
 *   3. "Mis rutinas" section for routines with folderId=null.
 *      Frontend-only label — no server-side default folder exists.
 *
 * Composition-only page. Grouping is a pure util, rendering per folder
 * lives in `FolderSectionComponent`, rows in `RoutineCardComponent`.
 *
 * Two parallel queries: folders + first page of routines. Both share the
 * 'training' key namespace so mutations (added in the next slice) can
 * invalidate everything at once with `['training']`.
 */
@Component({
  selector: 'page-training',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    IonContent, IonHeader, IonTitle, IonToolbar,
    IonNote, IonSpinner, IonIcon,
    CdkDropListGroup,
    FolderSectionComponent,
  ],
  styles: [`
    .cta-card {
      margin: 4px 0 16px;
      padding: 20px;
      border-radius: var(--atlas-radius-lg);
      background: linear-gradient(135deg, #ff5a1f, #ff8a3d);
      color: #0a0c0f;
      display: flex;
      align-items: center;
      justify-content: space-between;
      text-decoration: none;
      -webkit-tap-highlight-color: transparent;
    }
    .cta-card:active {
      opacity: 0.9;
    }
    .cta-text h3 {
      margin: 0 0 2px;
      font-size: 18px;
      font-weight: 800;
    }
    .cta-text p {
      margin: 0;
      font-size: 13px;
      opacity: 0.85;
    }
    .cta-icon {
      font-size: 30px;
    }
    .quick-actions {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 24px;
    }
    .quick-action {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 14px 6px;
      border-radius: var(--atlas-radius-md);
      background: var(--atlas-surface);
      border: 1px solid var(--atlas-border);
      color: var(--ion-text-color);
      text-decoration: none;
      font-size: 12px;
      font-weight: 600;
      text-align: center;
      -webkit-tap-highlight-color: transparent;
    }
    .quick-action:active {
      background: var(--atlas-surface-raised);
    }
    .quick-action ion-icon {
      font-size: 22px;
      color: var(--atlas-accent);
    }
    .center-pad {
      display: flex;
      justify-content: center;
      padding: 24px 0;
    }
  `],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Entrenamiento</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <a class="cta-card" routerLink="/training/session">
        <div class="cta-text">
          <h3>Entrenamiento vacío</h3>
          <p>Empezá a registrar sin una rutina</p>
        </div>
        <ion-icon class="cta-icon" name="flame-outline" />
      </a>

      <div class="quick-actions">
        <a class="quick-action" routerLink="/training/explore">
          <ion-icon name="compass-outline" />
          Explorar
        </a>
        <button class="quick-action" (click)="actions.promptCreateFolder()">
          <ion-icon name="folder-open-outline" />
          Carpeta
        </button>
        <button class="quick-action" (click)="actions.promptCreateRoutine()">
          <ion-icon name="add-circle-outline" />
          Rutina
        </button>
      </div>

      @if (foldersQuery.isPending() || routinesQuery.isPending()) {
        <div class="center-pad"><ion-spinner /></div>
      } @else if (foldersQuery.isError() || routinesQuery.isError()) {
        <ion-note color="danger">No pudimos cargar tus rutinas.</ion-note>
      } @else {
        @if (visibleBuckets().length === 0) {
          <ion-note>Todavía no tenés rutinas. Creá una para empezar.</ion-note>
        }
        <!-- Groups every folder-section's cdkDropList so a press-and-hold
             drag can carry a routine card across folder boundaries, not
             just reorder within the one it started in. -->
        <div cdkDropListGroup>
          @for (bucket of visibleBuckets(); track bucketKey(bucket)) {
            <app-training-folder-section
              [label]="bucket.folder?.name ?? 'Mis rutinas'"
              [folder]="bucket.folder"
              [allFolders]="foldersQuery.data() ?? []"
              [routines]="bucket.routines" />
          }
        </div>
      }
    </ion-content>
  `,
})
export class TrainingPage {
  private readonly api = inject(TrainingApi);
  protected readonly actions = inject(TrainingActionsService);

  constructor() {
    addIcons({
      'flame-outline': flameOutline,
      'compass-outline': compassOutline,
      'folder-open-outline': folderOpenOutline,
      'add-circle-outline': addCircleOutline,
    });
  }

  /** Default first page — pagination controls arrive when a real user starts
   *  hitting >20 routines (not this milestone). */
  private static readonly PAGE_OFFSET = 0;
  private static readonly PAGE_SIZE = 20;

  protected readonly foldersQuery = injectQuery(() => ({
    queryKey: trainingKeys.folders(),
    queryFn: () => firstValueFrom(this.api.listFolders()),
  }));

  protected readonly routinesQuery = injectQuery(() => ({
    queryKey: trainingKeys.myRoutinesPage(
      TrainingPage.PAGE_OFFSET, TrainingPage.PAGE_SIZE),
    queryFn: () => firstValueFrom(
      this.api.listMyRoutines(TrainingPage.PAGE_OFFSET, TrainingPage.PAGE_SIZE)),
  }));

  /** Sorted buckets minus any empty "Mis rutinas" bucket. Folders stay
   *  visible even when empty so the user still sees them (rename target,
   *  drop target). */
  protected readonly visibleBuckets = computed(() => {
    const folders = this.foldersQuery.data() ?? [];
    const page = this.routinesQuery.data();
    const routines = page?.items ?? [];
    const buckets = groupRoutinesByFolder(folders, routines);
    return buckets.filter(b => b.folder != null || b.routines.length > 0);
  });

  protected bucketKey(bucket: RoutineBucket): string {
    return bucket.folder ? `f-${bucket.folder.id}` : 'loose';
  }
}
