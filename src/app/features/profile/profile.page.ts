import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { injectQuery, injectQueryClient } from '@tanstack/angular-query-experimental';
import {
  IonContent, IonHeader, IonTitle, IonToolbar,
  IonButton, IonNote, IonSpinner, IonList, IonItem, IonLabel,
} from '@ionic/angular';
import { AuthService } from '@core/auth/auth.service';
import { UsersApi } from '@core/users/users.api';

/**
 * Profile main landing:
 *   - Header: avatar + username + firstName/lastName + basic stats
 *   - Sub-nav to the secondary pages (stats / exercises / measurements /
 *     calendar / settings) — each is its own lazy route so this landing
 *     stays fast.
 *   - Logout at the bottom
 *
 * Linked-provider management (unlink) MOVED to /profile/settings — it
 * belongs to the "power user" corner alongside password backup, deletion,
 * integrations. Landing stays clean.
 *
 * Uses the SAME ['me'] query key as home.page so the cache is shared.
 */
@Component({
  selector: 'page-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    IonContent, IonHeader, IonTitle, IonToolbar,
    IonButton, IonNote, IonSpinner, IonList, IonItem, IonLabel,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Perfil</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      @if (meQuery.isPending()) {
        <ion-spinner />
      } @else if (meQuery.isError()) {
        <ion-note color="danger">No pudimos cargar tu perfil.</ion-note>
      } @else if (meQuery.data(); as u) {
        <section>
          @if (u.avatarUrl) {
            <img [src]="u.avatarUrl" alt="avatar" width="80" height="80" />
          }
          <p><strong>{{ u.email }}</strong></p>
          <p>{{ (u.firstName || '') + ' ' + (u.lastName || '') }}</p>
        </section>

        <ion-list>
          @for (link of subPages; track link.path) {
            <ion-item [routerLink]="link.path" button>
              <ion-label>{{ link.label }}</ion-label>
            </ion-item>
          }
        </ion-list>
      }

      <ion-button expand="block" color="medium" (click)="logout()">
        Cerrar sesión
      </ion-button>
    </ion-content>
  `,
})
export class ProfilePage {
  private readonly api         = inject(UsersApi);
  private readonly auth        = inject(AuthService);
  private readonly router      = inject(Router);
  private readonly queryClient = injectQueryClient();

  protected readonly meQuery = injectQuery(() => ({
    queryKey: ['me'] as const,
    queryFn:  () => firstValueFrom(this.api.getMe()),
  }));

  /**
   * Secondary pages linked from the profile landing. Order matters — most
   * frequently viewed first (stats + exercises). Settings last (rarely
   * touched by casual users).
   */
  protected readonly subPages: readonly { path: string; label: string }[] = [
    { path: '/profile/stats',        label: 'Estadísticas' },
    { path: '/profile/exercises',    label: 'Ejercicios'   },
    { path: '/profile/measurements', label: 'Medidas'      },
    { path: '/profile/calendar',     label: 'Calendario'   },
    { path: '/profile/settings',     label: 'Configuración' },
  ];

  async logout(): Promise<void> {
    await this.auth.logout();
    // Purge the cached profile so the next login doesn't briefly see the
    // previous user's data.
    this.queryClient.removeQueries({ queryKey: ['me'] });
    await this.router.navigate(['/auth/login']);
  }
}
