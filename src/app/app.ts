import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { environment } from '@env';

/** Below this width we're a phone (real device or a narrow browser window) —
 *  render edge-to-edge as normal. Above it, only in the demo build, wrap
 *  in a phone-frame mockup instead of stretching mobile-only UI full-bleed. */
const DESKTOP_BREAKPOINT = 860;

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
 * where the same UI stretched full-bleed just looks broken. demoMode-gated
 * so this never touches the real app.
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
      padding: 14px;
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
    .phone-frame ion-app {
      width: 100%;
      height: 100%;
      border-radius: 34px;
      overflow: hidden;
      position: relative;
    }
    .phone-frame::before {
      content: '';
      position: absolute;
      top: 26px;
      left: 50%;
      transform: translateX(-50%);
      width: 110px;
      height: 26px;
      background: #0d0e10;
      border-radius: 16px;
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
          <ion-app>
            <ion-router-outlet [animated]="false"></ion-router-outlet>
          </ion-app>
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

  protected readonly showPhoneFrame = signal(this.computeShowFrame());
  protected readonly frameZoom = signal(this.computeZoom());

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
