import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { IonNote, IonRouterOutlet, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  home, homeOutline, barbell, barbellOutline, person, personOutline,
  notificationsOutline, chatbubbleOutline,
} from 'ionicons/icons';
import { NetworkService } from '@core/network/network.service';
import { ActiveWorkoutBarComponent } from '../training/session/active-workout-bar.component';

/** URL patterns where the top notif / chat strip is allowed. Home is
 *  the "landing" surface (social + notifications live here mentally),
 *  so we anchor these icons there. Everything else (training tracker,
 *  routine editor, profile, secondary pages) hides the strip. */
const SHOW_CHROME_RE = /^\/home(\/|$|\?)/;

/** URL patterns that hide the bottom tab bar: routine detail,
 *  routine editor (create + edit), active workout tracker. Keeps
 *  the bar visible on the top-level tab index pages only. */
const HIDE_TABS_RE = /\/(session|routines\/[^/]+)(\/|$)/;

/** URLs on which the active-workout mini-bar duplicates the page's
 *  own chrome — the tracker already shows the elapsed time in its
 *  toolbar, and the celebratory summary is post-workout so a live
 *  "workout in progress" indicator would confuse the reader. */
const HIDE_ACTIVE_BAR_RE = /\/(session|workouts\/[^/]+\/summary)(\/|$)/;

/** Exact URLs of the top-level tab pages. Back gesture on any of
 *  these should be trapped (see tab-guard trick below) so the user
 *  cannot fall off the app by hammering back on Inicio. */
const TOP_LEVEL_TAB_RE = /^\/(home|training|profile)\/?(\?|$)/;

/**
 * Authenticated app shell (3-tab layout, skinless).
 *
 * Chrome, top → bottom:
 *   1. Tiny 'sin conexión' banner when navigator.onLine is false.
 *      Everything stays functional — banner is informational, no feature
 *      gets disabled by it. Writes queue offline-first.
 *   2. Secondary actions row: bell (notifications). NOT in the bottom
 *      nav (Instagram/Strava layout). Chat icon commented out until
 *      the chat feature ships — see the template.
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
  imports: [RouterLink, RouterLinkActive, IonNote, IonRouterOutlet, IonIcon, ActiveWorkoutBarComponent],
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      height: 100dvh;
      background: var(--ion-background-color);
    }
    .offline-banner {
      display: block;
      padding: 8px;
      text-align: center;
    }
    .secondary-actions {
      display: flex;
      justify-content: flex-end;
      gap: 20px;
      padding: 14px 20px;
      padding-top: calc(14px + env(safe-area-inset-top));
    }
    .secondary-actions a {
      display: flex;
      color: var(--atlas-muted);
      text-decoration: none;
      font-size: 22px;
    }
    .secondary-actions a.active {
      color: var(--atlas-accent);
    }
    .main-content {
      flex: 1;
      position: relative;
      overflow: hidden;
    }
    nav {
      padding: 6px 12px calc(6px + env(safe-area-inset-bottom));
      border-top: 1px solid var(--atlas-border);
      background: var(--ion-background-color);
    }
    nav ul {
      display: flex;
      justify-content: space-around;
      list-style: none;
      margin: 0;
      padding: 0;
    }
    nav a {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
      padding: 8px 18px;
      text-decoration: none;
      color: var(--atlas-muted);
      font-size: 11px;
      font-weight: 500;
      -webkit-tap-highlight-color: transparent;
    }
    nav a ion-icon {
      font-size: 23px;
    }
    nav a.active {
      color: var(--atlas-accent);
      font-weight: 700;
    }
  `],
  template: `
    @if (!network.isOnline()) {
      <ion-note color="warning" class="offline-banner ion-padding-horizontal">
        Sin conexión — se sincronizará cuando vuelva.
      </ion-note>
    }

    @if (showSecondary()) {
      <div class="secondary-actions">
        <a routerLink="/notifications" routerLinkActive="active" aria-label="Notificaciones">
          <ion-icon name="notifications-outline" />
        </a>
        <!-- Chat icon hidden until the chat feature actually ships —
             an icon that goes nowhere real is worse than no icon.
        <a routerLink="/chat" routerLinkActive="active" aria-label="Chat">
          <ion-icon name="chatbubble-outline" />
        </a>
        -->
      </div>
    }

    <div class="main-content">
      <!-- animated:false → no horizontal slide when switching between
           child tabs (Inicio / Entrenamiento / Perfil) or drilling
           into routine detail / session. Modal + sheet transitions
           are unaffected (they live on ion-modal). -->
      <ion-router-outlet [animated]="false"></ion-router-outlet>
    </div>

    @if (showActiveBar()) {
      <app-active-workout-bar />
    }

    @if (showPrimaryNav()) {
      <nav aria-label="Navegación principal">
        <ul>
          @for (tab of primaryTabs; track tab.path) {
            <li>
              <a [routerLink]="tab.path" routerLinkActive="active">
                <ion-icon [name]="tab.icon" />
                {{ tab.label }}
              </a>
            </li>
          }
        </ul>
      </nav>
    }
  `,
})
export class ShellPage {
  protected readonly network = inject(NetworkService);
  private readonly router = inject(Router);

  /** Show the Notificaciones / Chat strip only on the Home tab. Every
   *  other page (training tracker, editor, profile, chat/notifs
   *  themselves, secondary pages) hides it to keep the top clean. */
  protected readonly showSecondary = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => SHOW_CHROME_RE.test(e.urlAfterRedirects)),
      startWith(SHOW_CHROME_RE.test(this.router.url)),
    ),
    { initialValue: false },
  );

  /** Hide the bottom tab bar on nested / immersive pages — routine
   *  detail, routine editor (create + edit), active session tracker.
   *  Keeps top-level tabs (home / training list / profile) as the only
   *  places the tab bar appears, matching the mental model of
   *  Instagram / Strava. */
  protected readonly showPrimaryNav = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => !HIDE_TABS_RE.test(e.urlAfterRedirects)),
      startWith(!HIDE_TABS_RE.test(this.router.url)),
    ),
    { initialValue: true },
  );

  /** Hide the mini "workout in progress" pill on routes that already
   *  show it as chrome (session tracker itself, celebration summary).
   *  The pill also hides itself when no workout is active — this only
   *  gates the URL-shape check. */
  protected readonly showActiveBar = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => !HIDE_ACTIVE_BAR_RE.test(e.urlAfterRedirects)),
      startWith(!HIDE_ACTIVE_BAR_RE.test(this.router.url)),
    ),
    { initialValue: true },
  );

  /**
   * Primary tabs — everything else lives OUTSIDE the bottom nav to keep it
   * to the 3 buckets the user mentally groups by. Adding a fourth here is
   * a UX regression — think twice.
   */
  protected readonly primaryTabs: readonly { path: string; label: string; icon: string }[] = [
    { path: '/home',     label: 'Inicio',        icon: 'home-outline'    },
    { path: '/training', label: 'Entrenamiento', icon: 'barbell-outline' },
    { path: '/profile',  label: 'Perfil',        icon: 'person-outline'  },
  ];

  constructor() {
    addIcons({
      home, 'home-outline': homeOutline,
      barbell, 'barbell-outline': barbellOutline,
      person, 'person-outline': personOutline,
      'notifications-outline': notificationsOutline,
      'chatbubble-outline': chatbubbleOutline,
    });
    this.installBackGestureTrap();
  }

  /**
   * Trap the browser back gesture on top-level tab pages so the user
   * cannot "fall off" the app by pressing back on Inicio / Entrenamiento
   * / Perfil.
   *
   * How: after every NavigationEnd that lands on a top-level tab, push
   * a sentinel history entry that carries `{ tabGuard: true }`. When
   * the user presses back, the sentinel is popped — URL stays put
   * (pushState('') preserves URL). A popstate listener notices the
   * guard is gone and pushes a fresh one, effectively looping the user
   * back onto the tab.
   *
   * Coexists with the modal history trick (RestPicker / ReorderModal /
   * ExercisePicker each push their own state on open, pop on close):
   * modal popstate handlers run first, dismiss the modal, then Router
   * settles at the top-level tab and we re-push. Native Capacitor back
   * will replace this via App.backButton — noted in
   * gym-sheet-back-gesture-capacitor.
   */
  private installBackGestureTrap(): void {
    const guardIfTop = () => {
      if (
        TOP_LEVEL_TAB_RE.test(this.router.url) &&
        (window.history.state as { tabGuard?: boolean } | null)?.tabGuard !== true
      ) {
        history.pushState({ tabGuard: true }, '');
      }
    };
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(guardIfTop);
    // microtask defers past any modal popstate handler that also ran on
    // this event, so we do not re-push while a modal is dismissing.
    window.addEventListener('popstate', () => queueMicrotask(guardIfTop));
  }
}
