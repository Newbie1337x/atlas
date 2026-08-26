import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  IonContent, IonHeader, IonTitle, IonToolbar,
  IonButtons, IonBackButton, IonNote,
} from '@ionic/angular';

/**
 * Notifications list — accessed via the bell icon in the shell header.
 * NOT in the bottom nav (Hevy pattern). Reads from a notifications feed
 * once the backend `notifications` module lands (post-fase 4.5).
 */
@Component({
  selector: 'page-notifications',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonContent, IonHeader, IonTitle, IonToolbar,
    IonButtons, IonBackButton, IonNote,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/home" /></ion-buttons>
        <ion-title>Notificaciones</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-note>Placeholder — likes, follows, comentarios, respuestas de coach.</ion-note>
    </ion-content>
  `,
})
export class NotificationsPage {}
