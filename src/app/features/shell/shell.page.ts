import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IonNote, IonRouterOutlet } from '@ionic/angular';
import { NetworkService } from '@core/network/network.service';

/**
 * Authenticated app shell (3-tab layout, skinless).
 *
 * Chrome, top → bottom:
 *   1. Tiny 'sin conexión' banner when navigator.onLine is false.
 *      Everything stays functional — banner is informational, no feature
 *      gets disabled by it. Writes queue offline-first.
 *   2. Secondary actions row: bell (notifications) + chat icon. NOT in
 *      the bottom nav (Instagram/Strava layout).
 *   3. <ion-router-outlet> — the active feature's page.
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
  imports: [RouterLink, RouterLinkActive, IonNote, IonRouterOutlet],
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      height: 100dvh;
      background: var(--ion-background-color, #fff);
    }
    .offline-banner {
      display: block;
      padding: 8px;
      text-align: center;
    }
    .secondary-actions {
      display: flex;
      gap: 16px;
      padding: 16px;
      border-bottom: 1px solid var(--ion-color-step-150, #eee);
      background: var(--ion-color-step-50, #f9f9f9);
    }
    .main-content {
      flex: 1;
      position: relative;
    }
    nav {
      padding: 16px;
      border-top: 1px solid var(--ion-color-step-150, #eee);
      background: var(--ion-color-step-50, #f9f9f9);
    }
    nav ul {
      display: flex;
      justify-content: space-around;
      list-style: none;
      margin: 0;
      padding: 0;
    }
    a {
      text-decoration: none;
      color: var(--ion-text-color, #333);
    }
    a.active {
      font-weight: bold;
      color: var(--ion-color-primary, #000);
    }
  `],
  template: `
    @if (!network.isOnline()) {
      <ion-note color="warning" class="offline-banner ion-padding-horizontal">
        Sin conexión — se sincronizará cuando vuelva.
      </ion-note>
    }

    <div class="secondary-actions">
      <a routerLink="/notifications" routerLinkActive="active">🔔 Notificaciones</a>
      <a routerLink="/chat"          routerLinkActive="active">💬 Chat</a>
    </div>

    <div class="main-content">
      <ion-router-outlet></ion-router-outlet>
    </div>

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
