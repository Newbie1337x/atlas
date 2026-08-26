import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  IonContent, IonHeader, IonTitle, IonToolbar,
  IonButtons, IonBackButton, IonNote,
} from '@ionic/angular';

/**
 * Training statistics — weekly hours / volume / reps chart, PRs, streak.
 * Backend: aggregation endpoints over WorkoutSession (may need to add
 * `GET /api/training/stats?range=&metric=`). Skinless placeholder.
 */
@Component({
  selector: 'page-profile-stats',
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
        <ion-title>Estadísticas</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-note>Placeholder — horas/volumen/reps por semana + PRs.</ion-note>
    </ion-content>
  `,
})
export class StatsPage {}
