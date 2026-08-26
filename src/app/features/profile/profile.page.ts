import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonButton,
} from '@ionic/angular';
import { AuthService } from '@core/auth/auth.service';

/**
 * Profile / settings — logged-in user's identity, linked accounts (Google/
 * Facebook/Apple/Spotify integrations), preferences, logout. Skinless
 * placeholder — for now only surfaces the logout button (which used to
 * live on the shell placeholder). Real page comes with the design pass.
 */
@Component({
  selector: 'page-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, IonButton],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Perfil</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <p><strong>{{ user()?.email }}</strong></p>
      <p>Roles: {{ (user()?.roles ?? []).join(', ') }}</p>

      <ion-button expand="block" color="medium" (click)="logout()">
        Cerrar sesión
      </ion-button>
    </ion-content>
  `,
})
export class ProfilePage {
  private readonly auth   = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly user = this.auth.currentUser;

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/auth/login']);
  }
}
