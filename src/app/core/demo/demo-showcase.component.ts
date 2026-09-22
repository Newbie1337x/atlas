import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { SHOWCASE_COPY, ShowcaseLang } from './demo-showcase.i18n';

/** Natural phone-frame size — see .phone-frame in demo-showcase.component.css. */
const FRAME_HEIGHT = 852;
/** Vertical chrome around the frame (topbar + info-panel-on-wrap + padding
 *  + caption) to leave room for when computing how much a short viewport
 *  needs to shrink the frame by. */
const FRAME_CHROME = 190;

const GITHUB_URL = 'https://github.com/Newbie1337x/atlas';

/**
 * Desktop landing wrapped around the demo build — see App's doc comment
 * for why this exists and why the real app renders inside an <iframe>
 * rather than a plain sized box (vh/dvh units resolve against the true
 * viewport, not a constrained ancestor — the iframe IS a real viewport).
 *
 * Only ever rendered by App when environment.demoMode && viewport is
 * desktop-sized — never touches the real app. Bilingual (demo-showcase.
 * i18n.ts) to match the README's EN/ES split; the app inside the phone
 * stays Spanish-only regardless of the toggle here.
 */
@Component({
  selector: 'app-demo-showcase',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './demo-showcase.component.css',
  template: `
    <header class="topbar">
      <span class="topbar-logo">ATLAS</span>
      <nav class="topbar-links">
        <div class="lang-toggle">
          <button type="button" [class.active]="lang() === 'en'" (click)="lang.set('en')">EN</button>
          <button type="button" [class.active]="lang() === 'es'" (click)="lang.set('es')">ES</button>
        </div>
        <a class="topbar-link" [href]="githubUrl" target="_blank" rel="noopener">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/>
          </svg>
          GitHub
        </a>
      </nav>
    </header>

    <div class="body">
      <div class="info-panel">
        <p class="info-eyebrow">{{ copy().eyebrow }}</p>
        <h1 class="info-title">Atlas</h1>
        <p class="info-tagline">{{ copy().tagline }}</p>
        <ul class="info-features">
          @for (feature of copy().features; track feature) {
            <li>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.5 12L13 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              {{ feature }}
            </li>
          }
        </ul>
        <p class="info-stack">Angular 22 · Ionic 9 · TanStack Query · Capacitor</p>
        <div class="info-btn-row">
          <a class="info-btn" [href]="githubUrl" target="_blank" rel="noopener">{{ copy().githubLabel }}</a>
        </div>
      </div>

      <div class="phone-column">
        <div class="phone-frame" [style.--phone-frame-zoom]="frameZoom()">
          <iframe class="phone-frame-iframe" [src]="selfUrl" title="Atlas"></iframe>
        </div>
        <p class="phone-caption">{{ copy().caption }}</p>
      </div>
    </div>
  `,
})
export class DemoShowcaseComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly githubUrl = GITHUB_URL;
  protected readonly lang = signal<ShowcaseLang>('en');
  protected readonly copy = computed(() => SHOWCASE_COPY[this.lang()]);

  protected readonly frameZoom = signal(this.computeZoom());
  protected readonly selfUrl: SafeResourceUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
    typeof window !== 'undefined' ? window.location.href : '',
  );

  constructor() {
    if (typeof window === 'undefined') return;
    const onResize = () => this.frameZoom.set(this.computeZoom());
    window.addEventListener('resize', onResize);
    this.destroyRef.onDestroy(() => window.removeEventListener('resize', onResize));
  }

  /** 1 when the viewport comfortably fits the frame at full size; shrinks
   *  proportionally (whole layout, not just a crop) on a short window. */
  private computeZoom(): number {
    if (typeof window === 'undefined') return 1;
    return Math.min(1, (window.innerHeight - FRAME_CHROME) / FRAME_HEIGHT);
  }
}
