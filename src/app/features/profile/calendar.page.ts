import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  IonContent, IonHeader, IonTitle, IonToolbar,
  IonButtons, IonBackButton, IonNote,
} from '@ionic/angular';

/**
 * Personal calendar — planned routines (from Rutinas semanal) + completed
 * WorkoutSessions + booked appointments (SCHEDULING module). Read-only
 * heatmap-style view of activity.
 */
@Component({
  selector: 'page-profile-calendar',
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
        <ion-title>Calendario</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-note>Placeholder — calendario personal (rutinas planeadas + sesiones + turnos).</ion-note>
    </ion-content>
  `,
})
export class CalendarPage {}
