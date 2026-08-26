import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  IonContent, IonHeader, IonTitle, IonToolbar,
  IonButtons, IonBackButton, IonNote,
} from '@ionic/angular';

/**
 * Settings — the "power user" corner:
 *   - Backup password ("Configurá una contraseña de respaldo — te permite
 *     ingresar sin depender de Google/Facebook. Opcional.") for OAuth-only
 *     users. Non-intrusive: sits here, not on Home. Plug-and-play default.
 *   - Change password for local-password users.
 *   - Integrations: Spotify, HealthKit/Google Fit (linked services, later).
 *   - Preferences: notifications, units (kg/lb), language.
 *   - Delete account.
 *
 * Skinless placeholder until each of those slots ships.
 */
@Component({
  selector: 'page-profile-settings',
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
        <ion-title>Configuración</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-note>Placeholder — contraseña de respaldo, integraciones (Spotify/HealthKit), preferencias, borrar cuenta.</ion-note>
    </ion-content>
  `,
})
export class SettingsPage {}
