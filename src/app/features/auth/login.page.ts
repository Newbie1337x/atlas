import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { logoGoogle, logoFacebook } from 'ionicons/icons';
import { AuthApi } from '@core/auth/auth.api';

/**
 * Login landing — big social buttons only. Design north star: someone
 * unfamiliar with tech (a 60+ member joining a gym) should never have to
 * type an email + password unless they insist. Everything above the fold
 * is one-tap social login.
 *
 * Provider order is platform-adaptive:
 *   iOS      → [Apple slot when enabled] → Google → Facebook
 *   Android  → Google → Facebook → [Apple slot when enabled]
 *   Web      → Google → Facebook → [Apple slot when enabled]
 *
 * Apple sign-in is intentionally NOT rendered until we have an Apple
 * Developer account ($99/yr) + the backend JWT client_secret rotation
 * scaffolding + a @capacitor-community/apple-sign-in wire-up for native
 * iOS. Insert the button at position 0 for iOS / end for the rest when
 * enabling; the ordering above already reflects the shape.
 *
 * Email + password is a tiny link under the fold — accessible, but not
 * inviting. The dedicated page lives at /auth/email so the folks who
 * DO need it get a focused screen with no other UI in the way.
 */
@Component({
  selector: 'page-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IonContent, IonIcon],
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
    ion-content {
      --padding-top: env(safe-area-inset-top);
      --padding-bottom: env(safe-area-inset-bottom);
    }
    .screen {
      min-height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 48px 28px 32px;
      background:
        radial-gradient(120% 60% at 50% -10%, rgba(255, 90, 31, 0.18), transparent 60%),
        var(--ion-background-color);
    }
    .brand {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      margin-top: 8vh;
    }
    .logo-mark {
      width: 76px;
      height: 76px;
      border-radius: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: Georgia, 'Times New Roman', serif;
      font-weight: 700;
      font-size: 34px;
      color: #0a0c0f;
      background: linear-gradient(150deg, var(--atlas-accent-tint), var(--atlas-accent) 70%);
      animation: pulse 2.2s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% {
        transform: scale(1);
        box-shadow: 0 12px 32px -8px rgba(255, 90, 31, 0.55), 0 0 0 0 rgba(255, 90, 31, 0.45);
      }
      50% {
        transform: scale(1.06);
        box-shadow: 0 12px 32px -8px rgba(255, 90, 31, 0.55), 0 0 0 14px rgba(255, 90, 31, 0);
      }
    }
    .wordmark {
      font-size: 30px;
      font-weight: 800;
      letter-spacing: 6px;
      margin: 0;
      color: var(--ion-text-color);
    }
    .tagline {
      margin: 0;
      font-size: 14px;
      color: var(--atlas-muted);
      letter-spacing: 0.3px;
      text-align: center;
    }
    .actions {
      display: flex;
      flex-direction: column;
      gap: 14px;
      margin-bottom: 8px;
    }
    .social-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      height: 54px;
      border-radius: var(--atlas-radius-md);
      border: none;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .social-btn.google {
      background: #ffffff;
      color: #1f1f1f;
    }
    .social-btn.facebook {
      background: #1877f2;
      color: #ffffff;
    }
    .social-btn ion-icon {
      font-size: 20px;
    }
    .email-link {
      display: block;
      text-align: center;
      margin-top: 18px;
      color: var(--atlas-muted);
      font-size: 14px;
      text-decoration: none;
    }
    .email-link:active {
      opacity: 0.7;
    }
  `],
  template: `
    <ion-content [fullscreen]="true">
      <div class="screen">
        <div class="brand">
          <div class="logo-mark">A</div>
          <h1 class="wordmark">ATLAS</h1>
          <p class="tagline">Tu progreso. Tu ritmo.<br>Entrená sin fricción.</p>
        </div>

        <div class="actions">
          @for (p of providers(); track p.id) {
            <button class="social-btn" [class]="p.id" (click)="loginWith(p.id)">
              <ion-icon [name]="p.icon" />
              {{ p.label }}
            </button>
          }

          <a class="email-link" routerLink="/auth/email">Ingresar con email</a>
        </div>
      </div>
    </ion-content>
  `,
})
export class LoginPage {
  private readonly api = inject(AuthApi);

  constructor() {
    addIcons({ 'logo-google': logoGoogle, 'logo-facebook': logoFacebook });
  }

  /**
   * Runtime platform. Capacitor.getPlatform() returns 'ios' | 'android' | 'web'.
   * Read once at construction — platform can't change during a session.
   */
  private readonly platform = Capacitor.getPlatform();

  /**
   * Providers in the display order for the current platform. Signal-shaped
   * (computed) so a future 'user hides Facebook' toggle would trigger a
   * re-render for free.
   */
  protected readonly providers = computed<readonly { id: 'google' | 'facebook'; label: string; icon: string }[]>(() => {
    const google   = { id: 'google'   as const, label: 'Continuar con Google',   icon: 'logo-google'   };
    const facebook = { id: 'facebook' as const, label: 'Continuar con Facebook', icon: 'logo-facebook' };
    // Same list today (Apple absent) — order stays declarative so inserting
    // { id: 'apple', label: 'Continuar con Apple' } later is a one-line edit
    // at the platform-appropriate position.
    return this.platform === 'ios' ? [google, facebook] : [google, facebook];
  });

  loginWith(provider: 'google' | 'facebook'): void {
    window.location.href = this.api.oauthAuthorizeUrl(provider);
  }
}
