import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  IonContent, IonHeader, IonTitle, IonToolbar,
  IonButtons, IonBackButton, IonNote,
} from '@ionic/angular';

/**
 * Active workout tracker — the highest-frequency screen once training ships.
 * Sets/reps/weight logging + rest timer + supersets. Offline-first required
 * (mid-workout network loss must not lose data). Skinless placeholder.
 */
@Component({
  selector: 'page-training-session',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonContent, IonHeader, IonTitle, IonToolbar,
    IonButtons, IonBackButton, IonNote,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/training" />
        </ion-buttons>
        <ion-title>Entrenamiento en curso</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-note>Placeholder — tracker con timer de descanso.</ion-note>
    </ion-content>
  `,
})
export class SessionPage {}
