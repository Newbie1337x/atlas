import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';

/**
 * Workout tracker — live session with sets/reps/weight logging + rest timer.
 * Highest-frequency screen in the app (people use it MID-workout with sweaty
 * hands). Offline-first required: mid-session network loss must not lose data.
 * Skinless placeholder until Phase 3.
 */
@Component({
  selector: 'page-session',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Entrenamiento</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <p>Placeholder — acá va el tracker con timer de descanso.</p>
    </ion-content>
  `,
})
export class SessionPage {}
