import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { environment } from '@env';
import { DemoShowcaseComponent } from '@core/demo/demo-showcase.component';

/** Below this width we're a phone or a tablet in portrait — render
 *  edge-to-edge as normal. Above it, only in the demo build, show the
 *  desktop showcase instead of stretching mobile-only UI full-bleed.
 *  768 is the conventional tablet/desktop breakpoint — deliberately NOT
 *  a wide "fullscreen monitor" threshold, since a recruiter's browser
 *  window is often not maximized.
 *
 *  Also doubles as the recursion guard for DemoShowcaseComponent's
 *  iframe: it's given a ~375px-wide box, well under 768, so when THIS
 *  component re-bootstraps inside it, computeShowShowcase() is false
 *  there and it just renders the real app — no explicit "am I embedded"
 *  flag needed. */
const DESKTOP_BREAKPOINT = 768;

/**
 * Root shell. IonApp is the Ionic runtime wrapper (owns modal stack, toast
 * root, back-button routing). IonRouterOutlet integrates Ionic's page
 * transitions with the Angular router — use this instead of plain
 * <router-outlet> at the top level.
 *
 * `[animated]="false"` on the outlet drops the horizontal slide between
 * top-level pages (tab switches, Empezar rutina → tracker, etc). Modal
 * / sheet animations are unaffected — they live on `ion-modal`, not on
 * the outlet, so vertical-up sheets (reorder, exercise picker, save
 * workout) keep their transition.
 *
 * Desktop showcase: Atlas is deliberately mobile-only (see README "What
 * Atlas is") — fine on a real device or the shipped app, but the public
 * demo build gets opened cold in a recruiter's desktop browser, where
 * the same UI stretched full-bleed just looked broken. demoMode-gated so
 * this never touches the real app. DemoShowcaseComponent renders the
 * real app inside a same-origin <iframe> — see its doc comment for why
 * a plain sized CSS box doesn't work (vh/dvh units resolve against the
 * true viewport, never a constrained ancestor).
 */
@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonApp, IonRouterOutlet, DemoShowcaseComponent],
  template: `
    @if (showShowcase()) {
      <app-demo-showcase />
    } @else {
      <ion-app>
        <ion-router-outlet [animated]="false"></ion-router-outlet>
      </ion-app>
    }
  `,
})
export class App {
  private readonly destroyRef = inject(DestroyRef);

  protected readonly showShowcase = signal(this.computeShowShowcase());

  constructor() {
    if (!environment.demoMode || typeof window === 'undefined') return;
    const onResize = () => this.showShowcase.set(this.computeShowShowcase());
    window.addEventListener('resize', onResize);
    this.destroyRef.onDestroy(() => window.removeEventListener('resize', onResize));
  }

  private computeShowShowcase(): boolean {
    return environment.demoMode && typeof window !== 'undefined' && window.innerWidth >= DESKTOP_BREAKPOINT;
  }
}
