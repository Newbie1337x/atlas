import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

/** Natural phone-frame size — see .phone-frame in the styles below. */
const FRAME_HEIGHT = 852;
/** Vertical chrome around the frame (topbar + info-panel-on-wrap + padding
 *  + caption) to leave room for when computing how much a short viewport
 *  needs to shrink the frame by. */
const FRAME_CHROME = 190;

/**
 * Desktop landing wrapped around the demo build — see App's doc comment
 * for why this exists and why the real app renders inside an <iframe>
 * rather than a plain sized box (vh/dvh units resolve against the true
 * viewport, not a constrained ancestor — the iframe IS a real viewport).
 *
 * Only ever rendered by App when environment.demoMode && viewport is
 * desktop-sized — never touches the real app.
 */
@Component({
  selector: 'app-demo-showcase',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host {
      display: block;
      min-height: 100dvh;
      background:
        radial-gradient(120% 60% at 15% -10%, rgba(255, 90, 31, 0.14), transparent 55%),
        #050607;
    }
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 32px;
      max-width: 1180px;
      margin: 0 auto;
    }
    .topbar-logo {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #f2f3f5;
      font-weight: 800;
      letter-spacing: 2px;
      font-size: 15px;
    }
    .topbar-links {
      display: flex;
      gap: 10px;
    }
    .topbar-link {
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 8px 14px;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: rgba(255, 255, 255, 0.75);
      text-decoration: none;
      font-size: 13px;
      font-weight: 600;
      transition: border-color 120ms, color 120ms;
    }
    .topbar-link:hover {
      border-color: rgba(255, 144, 80, 0.5);
      color: #ffb385;
    }
    .topbar-link svg {
      flex-shrink: 0;
    }

    .body {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 64px;
      flex-wrap: wrap;
      max-width: 1180px;
      margin: 0 auto;
      padding: 24px 32px 48px;
    }

    .info-panel {
      max-width: 400px;
      flex: 1 1 340px;
    }
    .info-eyebrow {
      color: #ff8a4d;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin: 0 0 10px;
    }
    .info-title {
      color: #f2f3f5;
      font-size: 34px;
      font-weight: 800;
      margin: 0 0 12px;
      line-height: 1.15;
    }
    .info-tagline {
      color: rgba(255, 255, 255, 0.55);
      font-size: 15px;
      line-height: 1.6;
      margin: 0 0 28px;
    }
    .info-features {
      list-style: none;
      margin: 0 0 28px;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .info-features li {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      color: rgba(255, 255, 255, 0.85);
      font-size: 14px;
      line-height: 1.5;
    }
    .info-features svg {
      flex-shrink: 0;
      margin-top: 2px;
      color: #ff5a1f;
    }
    .info-stack {
      color: rgba(255, 255, 255, 0.4);
      font-size: 12.5px;
      letter-spacing: 0.3px;
      margin: 0 0 24px;
    }
    .info-ctas {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    .info-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 11px 20px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
      transition: opacity 120ms, transform 120ms;
    }
    .info-btn:active {
      transform: scale(0.97);
    }
    .info-btn.primary {
      background: linear-gradient(135deg, #ff5a1f, #ff8a3d);
      color: #0a0c0f;
    }
    .info-btn.secondary {
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: rgba(255, 255, 255, 0.85);
    }
    .info-btn:hover {
      opacity: 0.9;
    }

    .phone-column {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 18px;
      flex-shrink: 0;
    }
    .phone-frame {
      position: relative;
      width: 393px;
      height: 852px;
      border-radius: 48px;
      /* Real top-bezel zone for the notch, so it never overlaps the app's
         own header — it used to be painted OVER real header text. */
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
    .phone-caption {
      color: rgba(255, 255, 255, 0.35);
      font-size: 13px;
      text-align: center;
    }

    @media (max-width: 980px) {
      .body { gap: 36px; }
      .info-panel { text-align: center; }
      .info-features { align-items: center; }
      .info-features li { text-align: left; }
      .info-ctas { justify-content: center; }
    }
  `],
  template: `
    <header class="topbar">
      <span class="topbar-logo">🏔️ ATLAS</span>
      <nav class="topbar-links">
        <a class="topbar-link" href="https://github.com/Newbie1337x/atlas" target="_blank" rel="noopener">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/>
          </svg>
          Código
        </a>
        <a class="topbar-link" href="https://github.com/Newbie1337x/atlas#readme" target="_blank" rel="noopener">
          README
        </a>
      </nav>
    </header>

    <div class="body">
      <div class="info-panel">
        <p class="info-eyebrow">Demo pública — sin login</p>
        <h1 class="info-title">Atlas</h1>
        <p class="info-tagline">
          Tracker de entrenamientos para el módulo Gimnasio de Proteus.
          Esto es la app real corriendo con datos de prueba, no capturas.
        </p>
        <ul class="info-features">
          <li>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.5 12L13 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Rutinas en carpetas, con drag-and-drop entre ellas
          </li>
          <li>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.5 12L13 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Sesión en vivo con cronómetro de descanso
          </li>
          <li>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.5 12L13 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Detección de récords personales en tiempo real
          </li>
          <li>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.5 12L13 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Valores fantasma de tu entrenamiento anterior
          </li>
        </ul>
        <p class="info-stack">Angular 22 · Ionic 9 · TanStack Query · Capacitor</p>
        <div class="info-ctas">
          <a class="info-btn primary" href="https://github.com/Newbie1337x/atlas" target="_blank" rel="noopener">Ver el código</a>
          <a class="info-btn secondary" href="https://github.com/Newbie1337x/atlas#readme" target="_blank" rel="noopener">Leer el README</a>
        </div>
      </div>

      <div class="phone-column">
        <div class="phone-frame" [style.--phone-frame-zoom]="frameZoom()">
          <iframe class="phone-frame-iframe" [src]="selfUrl" title="Atlas"></iframe>
        </div>
        <p class="phone-caption">Atlas es una app mobile — esto es una vista previa de escritorio.</p>
      </div>
    </div>
  `,
})
export class DemoShowcaseComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly sanitizer = inject(DomSanitizer);

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
