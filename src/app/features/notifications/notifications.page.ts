import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  IonContent, IonHeader, IonTitle, IonToolbar,
  IonButtons, IonBackButton, IonIcon,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { sparklesOutline } from 'ionicons/icons';

/**
 * Notifications panel — accessed via the bell icon in the shell header.
 * NOT in the bottom nav. Reads from a real notifications feed once the
 * backend `notifications` module lands (post-fase 4.5); until then this
 * renders as a real notification list UI with a single seeded welcome
 * card, so the bell opens something that actually looks/feels like a
 * notifications panel instead of a bare placeholder line.
 */
@Component({
  selector: 'page-notifications',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonContent, IonHeader, IonTitle, IonToolbar,
    IonButtons, IonBackButton, IonIcon,
  ],
  styles: [`
    .notif-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .notif-card {
      display: flex;
      gap: 12px;
      padding: 14px 16px;
      border-radius: var(--atlas-radius-md);
      background: var(--atlas-surface);
      border: 1px solid var(--atlas-border);
    }
    .notif-icon {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(150deg, var(--atlas-accent-tint), var(--atlas-accent) 70%);
      color: #0a0c0f;
      font-size: 18px;
    }
    .notif-body h4 {
      margin: 0 0 3px;
      font-size: 14px;
      font-weight: 700;
    }
    .notif-body p {
      margin: 0 0 4px;
      font-size: 13px;
      color: var(--ion-text-color);
      opacity: 0.85;
    }
    .notif-body time {
      font-size: 11px;
      color: var(--atlas-muted);
    }
  `],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/home" /></ion-buttons>
        <ion-title>Notificaciones</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="notif-list">
        <div class="notif-card">
          <div class="notif-icon"><ion-icon name="sparkles-outline" /></div>
          <div class="notif-body">
            <h4>¡Bienvenido a Atlas!</h4>
            <p>Tu cuenta está lista. Creá tu primera rutina o arrancá un entrenamiento libre cuando quieras.</p>
            <time>Ahora</time>
          </div>
        </div>
      </div>
    </ion-content>
  `,
})
export class NotificationsPage {
  constructor() {
    addIcons({ 'sparkles-outline': sparklesOutline });
  }
}
