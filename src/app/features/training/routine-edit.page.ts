import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { injectQuery, injectQueryClient } from '@tanstack/angular-query-experimental';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonInput, IonNote, IonSpinner, IonIcon,
  AlertController, ModalController, ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { addOutline, barbellOutline, checkmarkOutline, chevronBackOutline } from 'ionicons/icons';
import { HttpError } from '@core/errors/http-error';
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
  styles: [`
    .title-input {
      --padding-start: 0;
      --padding-end: 0;
      font-size: 1.25rem;
      font-weight: 600;
    }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 32px 24px 16px;
      color: var(--ion-color-medium, #666);
    }
    .empty-state ion-icon {
      font-size: 2.25rem;
      color: var(--ion-color-step-300, #ccc);
      margin-bottom: 10px;
    }
    .empty-state h3 {
      margin: 0 0 6px;
      color: var(--ion-text-color, #333);
      font-size: 0.95rem;
      font-weight: 600;
    }
    .empty-state p {
      margin: 0 0 14px;
      font-size: 0.8rem;
      max-width: 240px;
      line-height: 1.35;
    }
  `],
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
        <ion-title>{{ isCreate() ? 'Crear rutina' : 'Editar rutina' }}</ion-title>
        <ion-buttons slot="end">
          <ion-button
            [disabled]="!canSave()"
            (click)="save()"
            aria-label="Guardar cambios">
            <ion-icon slot="start" name="checkmark-outline" />
            Guardar
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      @if (!isCreate() && query.isPending()) {
        <ion-spinner />
      } @else if (!isCreate() && query.isError()) {
        <ion-note color="danger">No pudimos cargar la rutina.</ion-note>
      } @else if (form.draft(); as d) {
        <ion-input
          class="title-input"
          placeholder="Título de la rutina"
          [ngModel]="d.title"
          (ngModelChange)="form.updateTitle($event)" />

        @if (d.exercises.length === 0) {
          <div class="empty-state">
            <ion-icon name="barbell-outline" aria-hidden="true" />
            <h3>Empieza con tu primer ejercicio</h3>
            <p>
              Agrega ejercicios de la biblioteca para armar tu rutina.
              Puedes reordenarlos y agruparlos en superseries después.
            </p>
            <ion-button size="default" (click)="openPicker()">
              <ion-icon slot="start" name="add-outline" />
              Agregar ejercicio
            </ion-button>
          </div>
        } @else {
          @for (ex of d.exercises; track $index) {
            <app-training-exercise-editor [exercise]="ex" [index]="$index" />
          }

          <ion-button expand="block" fill="outline" (click)="openPicker()">
            <ion-icon slot="start" name="add-outline" />
            Agregar ejercicio
          </ion-button>
        }
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
  private readonly toasts = inject(ToastController);
  protected readonly form = inject(RoutineEditFormService);

  protected readonly saving = signal(false);

  /** Gate on: draft loaded, not mid-save, at least one exercise, and a
   *  non-empty title. Empty routines are useless to persist and the
   *  backend @NotBlank on title would 422 anyway. */
  protected readonly canSave = computed(() => {
    if (!this.form.loaded() || this.saving()) return false;
    const d = this.form.draft();
    return !!d && d.exercises.length > 0 && !!d.title?.trim();
  });

  /** True when the URL is /training/routines/new/edit — no backend fetch,
   *  editor seeds an empty draft locally and POSTs on save. */
  protected readonly isCreate = (): boolean => this.route.snapshot.url[1]?.path === 'new';

  protected readonly routineId = computed(() => {
    if (this.isCreate()) return NaN;
    const raw = this.route.snapshot.paramMap.get('id');
    return raw ? Number(raw) : NaN;
  });

  /** Optional folderId when creating via "Nueva rutina en esta carpeta". */
  private readonly initialFolderId = (): number | null => {
    const raw = this.route.snapshot.queryParamMap.get('folder');
    return raw ? Number(raw) : null;
  };

  protected readonly query = injectQuery(() => ({
    queryKey: trainingKeys.routineDetail(this.routineId()),
    queryFn: () => firstValueFrom(this.api.getRoutine(this.routineId())),
    enabled: Number.isFinite(this.routineId()),
  }));

  constructor() {
    addIcons({
      'add-outline': addOutline,
      'barbell-outline': barbellOutline,
      'checkmark-outline': checkmarkOutline,
      'chevron-back-outline': chevronBackOutline,
    });
    // Seed the draft once the query resolves. Runs again if the id changes
    // (unlikely — this page is one route with one id — but the effect is
    // idempotent because loadFrom replaces the whole draft).
    if (this.isCreate()) {
      // Local-only draft, no fetch. Save() will POST.
      this.form.startEmpty(this.initialFolderId());
    } else {
      // Seed the draft once the query resolves. Runs again if the id changes
      // (unlikely — this page is one route with one id — but the effect is
      // idempotent because loadFrom replaces the whole draft).
      effect(() => {
        const data = this.query.data();
        if (data) this.form.loadFrom(data);
      });
    }
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
      const creating = this.isCreate();
      const alert = await this.alerts.create({
        header: creating
          ? '¿Descartar esta rutina nueva?'
          : '¿Descartar los cambios de la rutina?',
        message: creating
          ? 'Todavía no se guardó. Si sales ahora se pierde lo que creaste.'
          : undefined,
        buttons: [
          { text: creating ? 'Descartar rutina' : 'Descartar cambios',
            role: 'destructive' },
          { text: 'Seguir editando', role: 'cancel' },
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
    // Create mode has no persisted routine to return to — go back to the
    // training list. Edit mode returns to the routine detail.
    if (this.isCreate()) {
      this.router.navigate(['/training']);
    } else {
      this.router.navigate(['/training/routines', this.routineId()]);
    }
  }

  protected async save(): Promise<void> {
    const draft = this.form.draft();
    if (!draft) return;
    this.saving.set(true);
    try {
      // POST for create (draft.id === 0) or PUT for update — both take
      // the same full-tree body (backend @NotEmpty on exercises applies
      // to both paths, so we never send a hollow routine to the server).
      const body = toUpdateRequest(draft);
      const saved = draft.id === 0
        ? await firstValueFrom(this.api.createRoutine(body))
        : await firstValueFrom(this.api.updateRoutine(draft.id, body));
      await this.queryClient.invalidateQueries({ queryKey: trainingKeys.all });
      // Clear dirty before navigating so the deactivate guard doesn't
      // prompt "descartar cambios?" over a just-saved routine.
      this.form.markPristine();
      this.router.navigate(['/training/routines', saved.id]);
    } catch (err) {
      // Draft stays intact so the user can retry without losing what
      // they built. HttpError carries a Spanish userMessage (mapped by
      // http-error.ts); anything else falls back to a generic string.
      const message = err instanceof HttpError
        ? err.userMessage
        : 'No pudimos guardar los cambios.';
      const toast = await this.toasts.create({
        message,
        duration: 4000,
        color: 'danger',
        position: 'bottom',
        buttons: [{ text: 'OK', role: 'cancel' }],
      });
      await toast.present();
    } finally {
      this.saving.set(false);
    }
  }
}
