import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButton,
} from '@ionic/angular';
import { AuthService } from '@core/auth/auth.service';

/**
 * Placeholder authenticated shell. Real tabs / navigation land here later —
 * for now this only proves the auth flow completed and shows current user.
 */
@Component({
  selector: 'page-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, IonButton],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Home (placeholder)</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <p>Autenticado como: <strong>{{ user()?.email }}</strong></p>
      <p>Rol: {{ user()?.role }}</p>
      <p>Tenant: {{ user()?.organizationId }}</p>
      <p>Módulos: {{ (user()?.modules ?? []).join(', ') || '(ninguno)' }}</p>

      <ion-button expand="block" color="medium" (click)="logout()">
        Cerrar sesión
      </ion-button>
    </ion-content>
  `,
})
export class ShellPage {
  private readonly auth   = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly user = this.auth.currentUser;

  async logout(): Promise<void> {
    await this.auth.logout();
    this.router.navigate(['/auth/login']);
  }
}
