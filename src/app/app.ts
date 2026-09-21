import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { environment } from '@env';

/** Below this width we're a phone or a tablet in portrait — render
 *  edge-to-edge as normal. Above it, only in the demo build, wrap in a
 *  phone-frame mockup instead of stretching mobile-only UI full-bleed.
 *  768 is the conventional tablet/desktop breakpoint — deliberately NOT
 *  a wide "fullscreen monitor" threshold, since a recruiter's browser
 *  window is often not maximized.
 *
 *  Also doubles as the recursion guard for the iframe below: the iframe
 *  is given a ~375px-wide box, well under 768, so when THIS component
 *  re-bootstraps inside it, computeShowFrame() is false there and it
 *  just renders the real app — no explicit "am I embedded" flag needed. */
const DESKTOP_BREAKPOINT = 768;

/** Natural phone-frame size — see .phone-frame in the styles below. */
const FRAME_HEIGHT = 852;
/** Backdrop's vertical chrome (padding + caption + gap) to leave room for
 *  when computing how much a short viewport needs to shrink the frame. */
const FRAME_CHROME = 120;

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
 * Phone-frame mockup: Atlas is deliberately mobile-only (see README "What
 * Atlas is") — on a real device or the actual shipped app that's fine, but
 * the public demo build gets opened cold in a recruiter's desktop browser,
 * where the same UI stretched full-bleed just looked broken. demoMode-gated
 * so this never touches the real app.
 *
 * Renders the real app inside a same-origin <iframe> rather than just a
 * sized CSS box — `vh`/`dvh` units ALWAYS resolve against the true browser
 * viewport, never a constrained ancestor, no matter how that ancestor is
 * sized (there's no CSS escape hatch for this — container query units
 * would work but nothing downstream uses them). Several pages (shell.page
 * among them) size themselves with `height: 100dvh`, so a plain CSS box
 * clipped the header and cut the bottom tab bar off entirely. An iframe
 * is a genuinely separate browsing context with its own real viewport, so
 * the SAME bundle re-bootstrapped inside it gets `100dvh` = the iframe's
 * own height and lays out correctly.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonApp, IonRouterOutlet],
  styles: [`
    :host {
      display: block;
    }
    .phone-frame-backdrop {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 20px;
      min-height: 100dvh;
      padding: 32px 16px;
      background:
        radial-gradient(120% 60% at 50% -10%, rgba(255, 90, 31, 0.16), transparent 60%),
        #050607;
    }
    .phone-frame {
      position: relative;
      width: 393px;
      height: 852px;
      border-radius: 48px;
      /* Extra top padding — a real bezel zone for the notch, so it never
         overlaps the app's own header (the earlier bug: the notch was
         painted OVER real header text, not beside it). */
      padding: 38px 14px 14px 14px;
      background: linear-gradient(155deg, #2a2c30, #0d0e10);
      box-shadow:
        0 40px 90px -25px rgba(0, 0, 0, 0.7),
        0 0 0 1px rgba(255, 255, 255, 0.06) inset;
      flex-shrink: 0;
      /* zoom (not transform) so a short viewport shrinks the WHOLE phone —
         internal px-based layout included — like a real device at a
         smaller size, instead of reflowing content inside a squished box. */
      zoom: var(--phone-frame-zoom, 1);
    }
    .phone-frame-iframe {
      width: 100%;
      height: 100%;
      border: 0;
      display: block;
      border-radius: 30px;
      background: #0a0c0f;
    }
    .phone-frame::before {
      content: '';
      position: absolute;
      top: 12px;
      left: 50%;
      transform: translateX(-50%);
      width: 100px;
      height: 18px;
      background: #0d0e10;
      border-radius: 12px;
      z-index: 20;
      pointer-events: none;
    }
    .phone-frame-caption {
      color: rgba(255, 255, 255, 0.35);
      font: 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      text-align: center;
    }
  `],
  template: `
    @if (showPhoneFrame()) {
      <div class="phone-frame-backdrop">
        <div class="phone-frame" [style.--phone-frame-zoom]="frameZoom()">
          <iframe class="phone-frame-iframe" [src]="selfUrl" title="Atlas"></iframe>
        </div>
        <p class="phone-frame-caption">Atlas es una app mobile — esto es una vista previa de escritorio.</p>
      </div>
    } @else {
      <ion-app>
        <ion-router-outlet [animated]="false"></ion-router-outlet>
      </ion-app>
    }
  `,
})
export class App {
  private readonly destroyRef = inject(DestroyRef);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly showPhoneFrame = signal(this.computeShowFrame());
  protected readonly frameZoom = signal(this.computeZoom());
  protected readonly selfUrl: SafeResourceUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
    typeof window !== 'undefined' ? window.location.href : '',
  );

  constructor() {
    if (!environment.demoMode || typeof window === 'undefined') return;
    const onResize = () => {
      this.showPhoneFrame.set(this.computeShowFrame());
      this.frameZoom.set(this.computeZoom());
    };
    window.addEventListener('resize', onResize);
    this.destroyRef.onDestroy(() => window.removeEventListener('resize', onResize));
  }

  private computeShowFrame(): boolean {
    return environment.demoMode && typeof window !== 'undefined' && window.innerWidth >= DESKTOP_BREAKPOINT;
  }

  /** 1 when the viewport comfortably fits the frame at full size; shrinks
   *  proportionally (whole layout, not just a crop) on a short window. */
  private computeZoom(): number {
    if (typeof window === 'undefined') return 1;
    return Math.min(1, (window.innerHeight - FRAME_CHROME) / FRAME_HEIGHT);
  }
}
