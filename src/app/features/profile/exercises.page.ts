import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  IonContent, IonHeader, IonTitle, IonToolbar,
  IonButtons, IonBackButton, IonNote,
} from '@ionic/angular';

/**
 * Exercise catalog — user's history per exercise + all-time best.
 * Backend: TRAINING module Exercise entity + WorkoutSession sets aggregation.
 * Curated icon images will come from a paid library in prod (deferred).
 */
@Component({
  selector: 'page-profile-exercises',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonContent, IonHeader, IonTitle, IonToolbar,
    IonButtons, IonBackButton, IonNote,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/profile" /></ion-buttons>
        <ion-title>Ejercicios</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-note>Placeholder — catálogo de ejercicios + tus PRs por ejercicio.</ion-note>
    </ion-content>
  `,
})
export class ExercisesPage {}
