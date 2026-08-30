import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { injectQuery, injectQueryClient } from '@tanstack/angular-query-experimental';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonInput, IonNote, IonSpinner, IonIcon,
  AlertController, ModalController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { addOutline, checkmarkOutline, chevronBackOutline } from 'ionicons/icons';
import { TrainingApi } from '@core/training/training.api';
import { trainingKeys } from '@core/training/training.keys';
import { toUpdateRequest } from '@core/training/training-actions.service';
import { RoutineEditFormService } from './routine-edit/routine-edit-form.service';
import { ExerciseEditorComponent } from './routine-edit/exercise-editor.component';
import { ExercisePickerComponent } from './routine-edit/exercise-picker.component';

/**
 * Routine editor. Route: /training/routines/:id/edit.
 *
 * Owns:
 *   - Query for the routine detail (readonly upstream cache).
 *   - RoutineEditFormService via providers[] so the draft dies on leave.
 *   - Load-once effect that seeds the draft from the query response.
 *   - Save (PUT) + Cancel (nav back) actions in the toolbar.
 *
 * The draft is the single source of truth for the template — the query
 * data only seeds it on first load. Subsequent mutations flow through
 * the form service; the query is not written to.
 *
 * Composition-only. Each exercise renders as ExerciseEditorComponent;
 * add-exercise opens ExercisePickerComponent modal.
 */
@Component({
  selector: 'page-training-routine-edit',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [RoutineEditFormService],
  imports: [
    FormsModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
    IonContent, IonInput, IonNote, IonSpinner, IonIcon,
    ExerciseEditorComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <!-- Custom back so we can gate on unsaved changes; matches the
               native ion-back-button visually without its automatic nav. -->
          <ion-button (click)="cancel()" aria-label="Volver">
            <ion-icon slot="icon-only" name="chevron-back-outline" />
          </ion-button>
        </ion-buttons>
        <ion-title>Editar rutina</ion-title>
        <ion-buttons slot="end">
          <ion-button
            [disabled]="!form.loaded() || saving()"
            (click)="save()"
            aria-label="Guardar cambios">
            <ion-icon slot="start" name="checkmark-outline" />
            Guardar
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      @if (query.isPending()) {
        <ion-spinner />
      } @else if (query.isError()) {
        <ion-note color="danger">No pudimos cargar la rutina.</ion-note>
      } @else if (form.draft(); as d) {
        <ion-input
          label="Título"
          labelPlacement="stacked"
          [ngModel]="d.title"
          (ngModelChange)="form.updateTitle($event)" />

        <ion-input
          label="Notas"
          labelPlacement="stacked"
          [ngModel]="d.notes"
          (ngModelChange)="form.updateNotes($event)" />

        @for (ex of d.exercises; track $index) {
          <training-exercise-editor [exercise]="ex" [index]="$index" />
        }

        <ion-button expand="block" fill="outline" (click)="openPicker()">
          <ion-icon slot="start" name="add-outline" />
          Agregar ejercicio
        </ion-button>
      }
    </ion-content>
  `,
})
export class RoutineEditPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(TrainingApi);
  private readonly queryClient = injectQueryClient();
  private readonly modal = inject(ModalController);
  private readonly alerts = inject(AlertController);
  protected readonly form = inject(RoutineEditFormService);

  protected readonly saving = signal(false);

  protected readonly routineId = computed(() => {
    const raw = this.route.snapshot.paramMap.get('id');
    return raw ? Number(raw) : NaN;
  });

  protected readonly query = injectQuery(() => ({
    queryKey: trainingKeys.routineDetail(this.routineId()),
    queryFn: () => firstValueFrom(this.api.getRoutine(this.routineId())),
    enabled: Number.isFinite(this.routineId()),
  }));

  constructor() {
    addIcons({
      'add-outline': addOutline,
      'checkmark-outline': checkmarkOutline,
      'chevron-back-outline': chevronBackOutline,
    });
    // Seed the draft once the query resolves. Runs again if the id changes
    // (unlikely — this page is one route with one id — but the effect is
    // idempotent because loadFrom replaces the whole draft).
    effect(() => {
      const data = this.query.data();
      if (data) this.form.loadFrom(data);
    });
  }

  protected async openPicker(): Promise<void> {
    const modal = await this.modal.create({ component: ExercisePickerComponent });
    await modal.present();
    const { data } = await modal.onDidDismiss();
    if (data) this.form.addExercise(data.id, data.name, data.demoMediaUrl, data.capabilities);
  }

  /**
   * Back handler. When the draft is dirty, prompt "descartar cambios?"
   * before leaving — matches Hevy's pattern. Clean draft just leaves.
   * Navigates to the routine detail page (same target the old
   * ion-back-button had via defaultHref).
   */
  protected async cancel(): Promise<void> {
    if (this.form.dirty()) {
      const alert = await this.alerts.create({
        header: '¿Estás seguro de que quieres descartar todos los cambios de la rutina?',
        buttons: [
          { text: 'Descartar cambios', role: 'destructive' },
          { text: 'Cancelar', role: 'cancel' },
        ],
      });
      await alert.present();
      const { role } = await alert.onDidDismiss();
      if (role !== 'destructive') return;
    }
    this.router.navigate(['/training/routines', this.routineId()]);
  }

  protected async save(): Promise<void> {
    const draft = this.form.draft();
    if (!draft) return;
    this.saving.set(true);
    try {
      await firstValueFrom(this.api.updateRoutine(draft.id, toUpdateRequest(draft)));
      await this.queryClient.invalidateQueries({ queryKey: trainingKeys.all });
      this.router.navigate(['/training/routines', draft.id]);
    } finally {
      this.saving.set(false);
    }
  }
}
