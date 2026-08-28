import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { injectQuery } from '@tanstack/angular-query-experimental';
import {
  IonContent, IonHeader, IonTitle, IonToolbar,
  IonButtons, IonBackButton, IonButton, IonIcon,
  IonNote, IonSpinner, ActionSheetController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { ellipsisVertical } from 'ionicons/icons';
import { TrainingApi } from '@core/training/training.api';
import { TrainingActionsService } from '@core/training/training-actions.service';
import { trainingKeys } from '@core/training/training.keys';
import { RoutineDetail } from '@core/training/routine.model';
import { RoutineExerciseListComponent } from './routine-detail/routine-exercise-list.component';

/**
 * Single routine detail. Reads /training/routines/:id.
 *   - Header: back button + title + ellipsis menu (rename / duplicate / delete)
 *   - Body: exercise + set breakdown via RoutineExerciseListComponent
 *   - Footer CTA: "Empezar rutina" → /training/session?routineId=...
 *
 * Composition-only. Query owns the fetch, actions service owns every
 * mutation + prompt, subcomponent owns rendering the exercise list.
 *
 * Post-mutation navigation:
 *   Rename / duplicate leave the user on the same page (rename updates
 *   the title in place; duplicate fires and returns — user can open the
 *   copy from the training list). Delete kicks back to /training since
 *   the current record is gone.
 */
@Component({
  selector: 'page-training-routine-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    IonContent, IonHeader, IonTitle, IonToolbar,
    IonButtons, IonBackButton, IonButton, IonIcon,
    IonNote, IonSpinner,
    RoutineExerciseListComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/training" />
        </ion-buttons>
        <ion-title>{{ routineQuery.data()?.title ?? 'Rutina' }}</ion-title>
        @if (routineQuery.data(); as r) {
          <ion-buttons slot="end">
            <ion-button (click)="openMenu(r)" aria-label="Opciones de la rutina">
              <ion-icon slot="icon-only" name="ellipsis-vertical" />
            </ion-button>
          </ion-buttons>
        }
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      @if (routineQuery.isPending()) {
        <ion-spinner />
      } @else if (routineQuery.isError()) {
        <ion-note color="danger">No pudimos cargar la rutina.</ion-note>
      } @else if (routineQuery.data(); as r) {
        @if (r.notes; as n) {
          <ion-note>{{ n }}</ion-note>
        }
        <ion-button
          expand="block"
          [routerLink]="['/training/session']"
          [queryParams]="{ routineId: r.id }">
          Empezar rutina
        </ion-button>

        <training-routine-exercise-list [exercises]="r.exercises" />
      }
    </ion-content>
  `,
})
export class RoutineDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(TrainingApi);
  private readonly actions = inject(TrainingActionsService);
  private readonly sheets = inject(ActionSheetController);

  protected readonly routineId = computed(() => {
    const raw = this.route.snapshot.paramMap.get('id');
    return raw ? Number(raw) : NaN;
  });

  protected readonly routineQuery = injectQuery(() => ({
    queryKey: trainingKeys.routineDetail(this.routineId()),
    queryFn: () => firstValueFrom(this.api.getRoutine(this.routineId())),
    enabled: Number.isFinite(this.routineId()),
  }));

  constructor() {
    addIcons({ 'ellipsis-vertical': ellipsisVertical });
  }

  protected async openMenu(routine: RoutineDetail): Promise<void> {
    const sheet = await this.sheets.create({
      header: routine.title,
      buttons: [
        { text: 'Editar ejercicios', handler: () => { this.router.navigate(['/training/routines', routine.id, 'edit']); } },
        { text: 'Renombrar', handler: () => { this.actions.promptRenameRoutine(routine); } },
        { text: 'Duplicar',  handler: () => { this.actions.confirmCloneRoutine(routine); } },
        {
          text: 'Borrar rutina',
          role: 'destructive',
          handler: () => {
            this.actions.confirmDeleteRoutine(routine).then(() => {
              this.router.navigate(['/training']);
            });
          },
        },
        { text: 'Cancelar', role: 'cancel' },
      ],
    });
    await sheet.present();
  }
}
