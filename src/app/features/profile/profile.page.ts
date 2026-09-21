import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { injectQuery, injectQueryClient } from '@tanstack/angular-query-experimental';
import {
  IonContent, IonHeader, IonTitle, IonToolbar,
  IonNote, IonSpinner, IonIcon,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  chevronForward, statsChartOutline, barbellOutline, resizeOutline,
  calendarOutline, settingsOutline, logOutOutline,
} from 'ionicons/icons';
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
    IonNote, IonSpinner, IonIcon,
  ],
  styles: [`
    .header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 8px 0 20px;
    }
    .avatar {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
    }
    .avatar-fallback {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(150deg, var(--atlas-accent-tint), var(--atlas-accent) 70%);
      color: #0a0c0f;
      font-weight: 800;
      font-size: 22px;
    }
    .identity h2 {
      margin: 0 0 2px;
      font-size: 18px;
      font-weight: 700;
    }
    .identity p {
      margin: 0;
      font-size: 13px;
      color: var(--atlas-muted);
    }
    .nav-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 20px;
    }
    .nav-row {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 16px;
      border-radius: var(--atlas-radius-md);
      background: var(--atlas-surface);
      border: 1px solid var(--atlas-border);
      color: var(--ion-text-color);
      text-decoration: none;
      -webkit-tap-highlight-color: transparent;
    }
    .nav-row:active {
      background: var(--atlas-surface-raised);
    }
    .nav-row ion-icon:first-child {
      font-size: 20px;
      color: var(--atlas-accent);
    }
    .nav-row span {
      flex: 1;
      font-size: 15px;
      font-weight: 600;
    }
    .nav-row .chevron {
      font-size: 16px;
      color: var(--atlas-muted);
    }
    .logout-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      padding: 14px;
      border-radius: var(--atlas-radius-md);
      background: transparent;
      border: 1px solid var(--atlas-border);
      color: var(--atlas-muted);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .logout-btn:active {
      background: var(--atlas-surface);
    }
    .center-pad {
      display: flex;
      justify-content: center;
      padding: 40px 0;
    }
  `],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Perfil</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      @if (meQuery.isPending()) {
        <div class="center-pad"><ion-spinner /></div>
      } @else if (meQuery.isError()) {
        <div class="center-pad"><ion-note color="danger">No pudimos cargar tu perfil.</ion-note></div>
      } @else if (meQuery.data(); as u) {
        <div class="header">
          @if (u.avatarUrl) {
            <img class="avatar" [src]="u.avatarUrl" alt="avatar">
          } @else {
            <div class="avatar-fallback">{{ initials(u.firstName, u.lastName, u.email) }}</div>
          }
          <div class="identity">
            <h2>{{ (u.firstName || '') + ' ' + (u.lastName || '') || u.email }}</h2>
            <p>{{ u.email }}</p>
          </div>
        </div>

        <div class="nav-list">
          @for (link of subPages; track link.path) {
            <a class="nav-row" [routerLink]="link.path">
              <ion-icon [name]="link.icon" />
              <span>{{ link.label }}</span>
              <ion-icon class="chevron" name="chevron-forward" />
            </a>
          }
        </div>
      }

      <button class="logout-btn" (click)="logout()">
        <ion-icon name="log-out-outline" />
        Cerrar sesión
      </button>
    </ion-content>
  `,
})
export class ProfilePage {
  private readonly api         = inject(UsersApi);
  private readonly auth        = inject(AuthService);
  private readonly router      = inject(Router);
  private readonly queryClient = injectQueryClient();

  constructor() {
    addIcons({
      'chevron-forward': chevronForward,
      'stats-chart-outline': statsChartOutline,
      'barbell-outline': barbellOutline,
      'resize-outline': resizeOutline,
      'calendar-outline': calendarOutline,
      'settings-outline': settingsOutline,
      'log-out-outline': logOutOutline,
    });
  }

  protected readonly meQuery = injectQuery(() => ({
    queryKey: ['me'] as const,
    queryFn:  () => firstValueFrom(this.api.getMe()),
  }));

  /**
   * Secondary pages linked from the profile landing. Order matters — most
   * frequently viewed first (stats + exercises). Settings last (rarely
   * touched by casual users).
   */
  protected readonly subPages: readonly { path: string; label: string; icon: string }[] = [
    { path: '/profile/stats',        label: 'Estadísticas',  icon: 'stats-chart-outline' },
    { path: '/profile/exercises',    label: 'Ejercicios',    icon: 'barbell-outline'     },
    { path: '/profile/measurements', label: 'Medidas',       icon: 'resize-outline'      },
    { path: '/profile/calendar',     label: 'Calendario',    icon: 'calendar-outline'    },
    { path: '/profile/settings',     label: 'Configuración', icon: 'settings-outline'    },
  ];

  protected initials(firstName: string | null, lastName: string | null, email: string): string {
    if (firstName) return (firstName[0] + (lastName?.[0] ?? '')).toUpperCase();
    return email[0]?.toUpperCase() ?? '?';
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    // Purge the cached profile so the next login doesn't briefly see the
    // previous user's data.
    this.queryClient.removeQueries({ queryKey: ['me'] });
    await this.router.navigate(['/auth/login']);
  }
}
