import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { injectQuery, injectQueryClient } from '@tanstack/angular-query-experimental';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonInput, IonTextarea, IonNote, IonSpinner, IonIcon,
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
    IonContent, IonInput, IonTextarea, IonNote, IonSpinner, IonIcon,
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

        <ion-textarea
          label="Notas"
          labelPlacement="stacked"
          [autoGrow]="true"
          [rows]="1"
          [ngModel]="d.notes"
          (ngModelChange)="form.updateNotes($event)" />

        @for (ex of d.exercises; track $index) {
          <app-training-exercise-editor [exercise]="ex" [index]="$index" />
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

  /** Reentrance guard — while the confirm dialog is already showing,
   *  subsequent invocations (from rapid back-gesture pumps that
   *  Angular Router queues as it restores the URL after each cancel)
   *  return false immediately instead of stacking more alerts. */
  private confirming = false;

  /**
   * Shared confirm used by (a) the custom back button in the toolbar
   * and (b) the CanDeactivate guard that fires on system back / swipe.
   * Returns true when the caller may proceed with the exit (clean
   * draft or user picked "Descartar cambios"), false when they picked
   * Cancelar. Public because the guard reads it off the component.
   */
  async confirmDiscardIfDirty(): Promise<boolean> {
    if (!this.form.dirty()) return true;
    if (this.confirming) return false;
    this.confirming = true;
    try {
      const alert = await this.alerts.create({
        header: '¿Estás seguro de que quieres descartar todos los cambios de la rutina?',
        buttons: [
          { text: 'Descartar cambios', role: 'destructive' },
          { text: 'Cancelar',          role: 'cancel'      },
        ],
      });
      await alert.present();
      const { role } = await alert.onDidDismiss();
      return role === 'destructive';
    } finally {
      this.confirming = false;
    }
  }

  /** Toolbar back button. Router.navigate re-fires the guard, so if the
   *  user confirmed the discard here we skip the guard's re-prompt by
   *  the fact that guard's alert is the same code path. Small
   *  double-check race is fine — worst case one extra tap on Cancelar. */
  protected async cancel(): Promise<void> {
    this.router.navigate(['/training/routines', this.routineId()]);
  }

  protected async save(): Promise<void> {
    const draft = this.form.draft();
    if (!draft) return;
    this.saving.set(true);
    try {
      await firstValueFrom(this.api.updateRoutine(draft.id, toUpdateRequest(draft)));
      await this.queryClient.invalidateQueries({ queryKey: trainingKeys.all });
      // Clear dirty before navigating so the deactivate guard doesn't
      // prompt "descartar cambios?" over a just-saved routine.
      this.form.markPristine();
      this.router.navigate(['/training/routines', draft.id]);
    } finally {
      this.saving.set(false);
    }
  }
}
