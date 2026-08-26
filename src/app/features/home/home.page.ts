import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { AuthService } from '@core/auth/auth.service';

/**
 * Landing after login. Skinless placeholder — the real dashboard
 * (today's session, streak, next workout, recent activity) is built
 * feature-by-feature as the app grows. For now this just proves the
 * shell + route tree wired correctly and shows who's authenticated.
 */
@Component({
  selector: 'page-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Inicio</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <p>Autenticado como: <strong>{{ user()?.email }}</strong></p>
      <p>Rol activo: {{ user()?.activeRole }}</p>
      <p>Tenant: {{ user()?.organizationId }}</p>
      <p>Módulos: {{ (user()?.modules ?? []).join(', ') || '(ninguno)' }}</p>
    </ion-content>
  `,
})
export class HomePage {
  private readonly auth = inject(AuthService);
  protected readonly user = this.auth.currentUser;
}
