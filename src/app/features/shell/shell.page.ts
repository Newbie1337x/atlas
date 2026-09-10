import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { IonNote, IonRouterOutlet } from '@ionic/angular';
import { NetworkService } from '@core/network/network.service';
import { ActiveWorkoutBarComponent } from '../training/session/active-workout-bar.component';

/** URL patterns that hide the top notif / chat strip. Any route
 *  ending in an editor (/edit) is considered immersive. */
const HIDE_CHROME_RE = /\/edit(\/|$)/;

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
  imports: [RouterLink, RouterLinkActive, IonNote, IonRouterOutlet, ActiveWorkoutBarComponent],
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

    @if (showSecondary()) {
      <div class="secondary-actions">
        <a routerLink="/notifications" routerLinkActive="active">🔔 Notificaciones</a>
        <a routerLink="/chat"          routerLinkActive="active">💬 Chat</a>
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
              <a [routerLink]="tab.path" routerLinkActive="active">{{ tab.label }}</a>
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

  /** Hide the Notificaciones / Chat strip on immersive editors where
   *  every pixel counts (routine editor is the current one). Add more
   *  routes here as they need the full canvas. */
  protected readonly showSecondary = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => !HIDE_CHROME_RE.test(e.urlAfterRedirects)),
      startWith(!HIDE_CHROME_RE.test(this.router.url)),
    ),
    { initialValue: true },
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
  protected readonly primaryTabs: readonly { path: string; label: string }[] = [
    { path: '/home',     label: 'Inicio'         },
    { path: '/training', label: 'Entrenamiento'  },
    { path: '/profile',  label: 'Perfil'         },
  ];

  constructor() {
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
