import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { injectQuery } from '@tanstack/angular-query-experimental';
import {
  IonContent, IonHeader, IonTitle, IonToolbar,
  IonButton, IonNote, IonSpinner,
} from '@ionic/angular';
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
    IonButton, IonNote, IonSpinner,
    FolderSectionComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Entrenamiento</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-button expand="block" routerLink="/training/session">
        Empezar entrenamiento vacío
      </ion-button>
      <ion-button fill="outline" expand="block" routerLink="/training/explore">
        Explorar templates
      </ion-button>
      <ion-button fill="outline" expand="block" (click)="actions.promptCreateFolder()">
        Nueva carpeta
      </ion-button>
      @if ((foldersQuery.data() ?? []).length > 1) {
        <ion-button
          fill="outline" expand="block"
          (click)="actions.openReorderFolders(foldersQuery.data() ?? [])">
          Reordenar carpetas
        </ion-button>
      }
      <ion-button fill="outline" expand="block" (click)="actions.promptCreateRoutine()">
        Nueva rutina
      </ion-button>

      @if (foldersQuery.isPending() || routinesQuery.isPending()) {
        <ion-spinner />
      } @else if (foldersQuery.isError() || routinesQuery.isError()) {
        <ion-note color="danger">No pudimos cargar tus rutinas.</ion-note>
      } @else {
        @if (visibleBuckets().length === 0) {
          <ion-note>Todavía no tenés rutinas. Creá una para empezar.</ion-note>
        }
        @for (bucket of visibleBuckets(); track bucketKey(bucket)) {
          <training-folder-section
            [label]="bucket.folder?.name ?? 'Mis rutinas'"
            [folder]="bucket.folder"
            [routines]="bucket.routines" />
        }
      }
    </ion-content>
  `,
})
export class TrainingPage {
  private readonly api = inject(TrainingApi);
  protected readonly actions = inject(TrainingActionsService);

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
