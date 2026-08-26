import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { IonContent, IonSpinner, IonNote, IonButton } from '@ionic/angular';
import { AuthService } from '@core/auth/auth.service';

/**
 * Landing page for the Proteus OAuth2 success handler redirect. Proteus mints
 * the JWT + refresh pair on its side after Google/Facebook auth and 302s
 * here with the tokens in the query string:
 *
 *   /auth/oauth-callback?token=...&refreshToken=...&email=...&role=...
 *
 * Contract with backend (documented in Proteus `docs/GOOGLE-OAUTH-SETUP.md`
 * and mirrored in this repo's PLAYBOOK.md §4):
 *   - Both `token` and `refreshToken` are required; missing either is an error.
 *   - `email` and `role` come along for display but the JWT payload is the
 *     authoritative source — SessionStore derives everything from the token.
 *   - Tokens land in the URL exactly once; navigating away and back means the
 *     user has to re-authenticate.
 *
 * We deliberately don't touch DOM/history to strip the token from the URL —
 * once acceptExternalTokens finishes we navigateByUrl('/') which replaces the
 * history entry anyway. Browser back button won't hit this route with the
 * token in it because the /auth parent has no back-nav to it.
 *
 * Skinless by design — visual polish comes with the design pass. The only
 * job right now is: parse → hydrate → navigate.
 */
@Component({
  selector: 'page-oauth-callback',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonSpinner, IonNote, IonButton],
  template: `
    <ion-content class="ion-padding">
      @if (error()) {
        <ion-note color="danger">{{ error() }}</ion-note>
        <ion-button expand="block" (click)="backToLogin()">Volver al login</ion-button>
      } @else {
        <ion-spinner />
        <p>Completando ingreso…</p>
      }
    </ion-content>
  `,
})
export class OAuthCallbackPage implements OnInit {
  private readonly auth   = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route  = inject(ActivatedRoute);

  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const token        = params.get('token');
    const refreshToken = params.get('refreshToken');

    if (!token || !refreshToken) {
      // Landed here without the expected params — either someone navigated
      // manually, or backend dropped them. Either way we can't proceed.
      this.error.set('Faltan tokens en la respuesta de autenticación.');
      return;
    }

    void this.handle(token, refreshToken);
  }

  private async handle(token: string, refreshToken: string): Promise<void> {
    try {
      const user = await this.auth.acceptExternalTokens(token, refreshToken);
      if (!user) {
        this.error.set('El token recibido es inválido o está expirado.');
        return;
      }
      // Replace history so the URL with the raw tokens doesn't survive in
      // browser history. `replaceUrl: true` overwrites this entry instead of
      // pushing a new one on top.
      void this.router.navigateByUrl('/', { replaceUrl: true });
    } catch {
      this.error.set('No pudimos completar el ingreso. Intentá de nuevo.');
    }
  }

  protected backToLogin(): void {
    void this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }
}
