import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IonContent, IonNote } from '@ionic/angular';
import { NetworkService } from '@core/network/network.service';

/**
 * Authenticated app shell (Hevy-style 3-tab layout, skinless).
 *
 * Chrome, top → bottom:
 *   1. Tiny 'sin conexión' banner when navigator.onLine is false.
 *      Everything stays functional — banner is informational, no feature
 *      gets disabled by it. Writes queue offline-first.
 *   2. Secondary actions row: bell (notifications) + chat icon. NOT in
 *      the bottom nav — Hevy pattern (Instagram/Strava do the same).
 *   3. <router-outlet> — the active feature's page.
 *   4. Primary bottom nav: home / training / profile — the 3 mental
 *      buckets a gym user thinks in (social + workouts + me).
 *
 * All links are text-only for now (skinless functional). Real bottom
 * tab bar + icons land in the design pass; route structure stays.
 */
@Component({
  selector: 'page-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IonContent, IonNote],
  template: `
    @if (!network.isOnline()) {
      <ion-note color="warning" class="ion-padding-horizontal">
        Sin conexión — se sincronizará cuando vuelva.
      </ion-note>
    }

    <div class="secondary-actions">
      <a routerLink="/notifications" routerLinkActive="active">🔔 Notificaciones</a>
      <a routerLink="/chat"          routerLinkActive="active">💬 Chat</a>
    </div>

    <router-outlet />

    <nav aria-label="Navegación principal">
      <ul>
        @for (tab of primaryTabs; track tab.path) {
          <li>
            <a [routerLink]="tab.path" routerLinkActive="active">{{ tab.label }}</a>
          </li>
        }
      </ul>
    </nav>
  `,
})
export class ShellPage {
  protected readonly network = inject(NetworkService);

  /**
   * Primary tabs — everything else lives OUTSIDE the bottom nav to keep it
   * to the 3 buckets the user mentally groups by. Adding a fourth here is
   * a UX regression — think twice.
   */
  protected readonly primaryTabs: readonly { path: string; label: string }[] = [
    { path: '/home',     label: 'Inicio'         },
    { path: '/training', label: 'Entrenamiento'  },
    { path: '/profile',  label: 'Perfil'         },
  ];
}
