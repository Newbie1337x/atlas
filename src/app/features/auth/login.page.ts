import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import {
  IonContent, IonHeader, IonTitle, IonToolbar,
  IonButton, IonNote,
} from '@ionic/angular';
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
  imports: [
    RouterLink,
    IonContent, IonHeader, IonTitle, IonToolbar,
    IonButton, IonNote,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Ingresar</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      @for (p of providers(); track p.id) {
        <ion-button expand="block" size="large" (click)="loginWith(p.id)">
          {{ p.label }}
        </ion-button>
      }

      <ion-note class="ion-margin-top">
        <ion-button fill="clear" size="small" expand="block" routerLink="/auth/email">
          Ingresar con email
        </ion-button>
      </ion-note>
    </ion-content>
  `,
})
export class LoginPage {
  private readonly api = inject(AuthApi);

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
  protected readonly providers = computed<readonly { id: 'google' | 'facebook'; label: string }[]>(() => {
    const google   = { id: 'google'   as const, label: 'Continuar con Google'   };
    const facebook = { id: 'facebook' as const, label: 'Continuar con Facebook' };
    // Same list today (Apple absent) — order stays declarative so inserting
    // { id: 'apple', label: 'Continuar con Apple' } later is a one-line edit
    // at the platform-appropriate position.
    return this.platform === 'ios' ? [google, facebook] : [google, facebook];
  });

  loginWith(provider: 'google' | 'facebook'): void {
    window.location.href = this.api.oauthAuthorizeUrl(provider);
  }
}
