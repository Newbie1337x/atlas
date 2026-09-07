import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { injectQuery } from '@tanstack/angular-query-experimental';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
  IonContent, IonSearchbar, IonList, IonItem, IonLabel, IonNote, IonSpinner,
  ModalController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { close } from 'ionicons/icons';
import { TrainingApi } from '@core/training/training.api';
import { trainingKeys } from '@core/training/training.keys';
import { CatalogExercise } from '@core/training/exercise.model';
import { ExerciseIconComponent } from '../shared/exercise-icon.component';

/**
 * Full-screen IonModal for picking an exercise from the tenant's catalog.
 * Opens via ModalController from the editor page — dismiss returns the
 * chosen exercise or `null` on cancel. The catalog stays cached for 30
 * minutes (long staleTime; it barely changes and re-fetching between
 * add-exercise clicks would be wasteful).
 *
 * Search is client-side: the catalog is small enough (a few hundred rows)
 * that filtering in memory is snappier than a debounced server request.
 * If catalogs grow we swap for a search endpoint.
 */
@Component({
  selector: 'app-training-exercise-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
    IonContent, IonSearchbar, IonList, IonItem, IonLabel, IonNote, IonSpinner,
    ExerciseIconComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Elegí un ejercicio</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="dismiss(null)" aria-label="Cerrar">
            <ion-icon slot="icon-only" name="close" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar
          placeholder="Buscar (nombre o músculo)"
          [debounce]="150"
          (ionInput)="query.set($any($event.target).value ?? '')" />
      </ion-toolbar>
    </ion-header>

    <ion-content>
      @if (catalog.isPending()) {
        <ion-spinner />
      } @else if (catalog.isError()) {
        <ion-note color="danger">No pudimos cargar el catálogo.</ion-note>
      } @else {
        @if (filtered().length === 0) {
          <ion-note class="ion-padding">Sin resultados.</ion-note>
        }
        <ion-list>
          @for (ex of filtered(); track ex.id) {
            <ion-item button (click)="dismiss(ex)">
              <app-training-exercise-icon slot="start" [name]="ex.name" size="small" />
              <ion-label>
                <h3>{{ ex.name }}</h3>
                @if (ex.primaryMuscles.length) {
                  <p>{{ ex.primaryMuscles.join(', ') }}</p>
                }
              </ion-label>
            </ion-item>
          }
        </ion-list>
      }
    </ion-content>
  `,
})
export class ExercisePickerComponent {
  private readonly api = inject(TrainingApi);
  private readonly modal = inject(ModalController);

  protected readonly query = signal('');

  protected readonly catalog = injectQuery(() => ({
    queryKey: trainingKeys.exerciseCatalog(),
    queryFn: () => firstValueFrom(this.api.listExercises()),
    staleTime: 30 * 60_000,
  }));

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const items = this.catalog.data() ?? [];
    if (!q) return items.slice(0, 100);
    return items
      .filter(ex =>
        ex.name.toLowerCase().includes(q) ||
        ex.primaryMuscles.some(m => m.toLowerCase().includes(q)))
      .slice(0, 100);
  });

  constructor() {
    addIcons({ close });
  }

  protected dismiss(picked: CatalogExercise | null): void {
    this.modal.dismiss(picked);
  }
}
