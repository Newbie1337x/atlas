import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { injectQuery } from '@tanstack/angular-query-experimental';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonSpinner, IonNote,
} from '@ionic/angular';
import { UsersApi } from '@core/users/users.api';

/**
 * Home / dashboard. Skinless functional — reads the enriched user profile
 * from GET /api/users/me and renders the raw facts (name, email, tenant,
 * linked providers). Real dashboard content (today's session, streak,
 * recent activity) drops in feature-by-feature as those backends land.
 *
 * Query key: ['me']. Shared with profile.page — same cache, no refetch
 * on navigation between the two.
 */
@Component({
  selector: 'page-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonContent, IonHeader, IonTitle, IonToolbar, IonSpinner, IonNote,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Inicio</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      @if (meQuery.isPending()) {
        <ion-spinner />
      } @else if (meQuery.isError()) {
        <ion-note color="danger">No pudimos cargar tu perfil.</ion-note>
      } @else if (meQuery.data(); as u) {
        <p>Hola <strong>{{ u.firstName || u.email }}</strong>{{ u.lastName ? ' ' + u.lastName : '' }}</p>
        @if (u.avatarUrl) {
          <img [src]="u.avatarUrl" alt="avatar" width="64" height="64" />
        }
        <p>Email: {{ u.email }}</p>
        <p>Rol: {{ u.role }}</p>
        <p>Tenant: {{ u.organizationId }}</p>
        <p>Cuentas vinculadas: {{ u.linkedProviders.length ? u.linkedProviders.join(', ') : '(ninguna)' }}</p>
        <p>Contraseña local: {{ u.hasLocalPassword ? 'sí' : 'no' }}</p>
      }
    </ion-content>
  `,
})
export class HomePage {
  private readonly api = inject(UsersApi);

  protected readonly meQuery = injectQuery(() => ({
    queryKey: ['me'] as const,
    queryFn:  () => firstValueFrom(this.api.getMe()),
  }));
}
