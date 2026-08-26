import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IonContent, IonNote } from '@ionic/angular';
import { NetworkService } from '@core/network/network.service';

/**
 * Authenticated app shell. Renders three things:
 *   1. A tiny 'sin conexión' banner at the top when navigator.onLine is false.
 *      Everything below stays working — the banner is informational, no
 *      feature gets disabled by it. Writes queue offline-first.
 *   2. The feature's <router-outlet> (children defined in shell.routes.ts).
 *   3. A temporary text-link nav at the bottom. This is NOT the final nav —
 *      it's a plain link list so we can traverse features while the app is
 *      in the skinless-functional phase. Swap for bottom tab bar / sidebar
 *      / whatever in the design pass; the route structure stays the same.
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

    <router-outlet />

    <nav aria-label="Navegación principal">
      <ul>
        @for (link of navLinks; track link.path) {
          <li>
            <a [routerLink]="link.path" routerLinkActive="active">{{ link.label }}</a>
          </li>
        }
      </ul>
    </nav>
  `,
})
export class ShellPage {
  protected readonly network = inject(NetworkService);

  /**
   * Text-link nav — placeholder for the eventual bottom tab bar / sidebar.
   * Adding a new feature adds an entry here. Keep in sync with children
   * routes in shell.routes.ts.
   */
  protected readonly navLinks: readonly { path: string; label: string }[] = [
    { path: '/home',     label: 'Inicio'         },
    { path: '/routines', label: 'Rutinas'        },
    { path: '/session',  label: 'Entrenamiento'  },
    { path: '/social',   label: 'Social'         },
    { path: '/chat',     label: 'Chat'           },
    { path: '/profile',  label: 'Perfil'         },
  ];
}
