import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonNote,
} from '@ionic/angular';

/**
 * Training main page (Hevy's "Entrenamiento" tab):
 *   - Top: 'Empezar entrenamiento vacío' → navigates to /training/session
 *   - Routines section: user's routines + link to /training/explore
 *   - List of routines with per-item 'Empezar rutina' button
 *
 * Skinless placeholder — real content ships when backend TRAINING endpoints
 * are wired (list routines by user + start session).
 */
@Component({
  selector: 'page-training',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonNote,
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

      <h3>Rutinas</h3>
      <ion-button fill="outline" expand="block" routerLink="/training/explore">
        Explorar (templates de la comunidad)
      </ion-button>

      <ion-note>Placeholder — acá va la lista de tus rutinas con botón "Empezar" por card.</ion-note>
    </ion-content>
  `,
})
export class TrainingPage {}
