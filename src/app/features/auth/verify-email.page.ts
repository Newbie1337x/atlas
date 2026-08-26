import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonContent, IonSpinner, IonNote, IonButton } from '@ionic/angular';
import { AuthApi } from '@core/auth/auth.api';
import { HttpError } from '@core/errors/http-error';

/**
 * Landing for the verification-email link. Reads ?token=... from the URL
 * (the raw UUID emailed to the user — Proteus stores only its SHA-256 hash
 * at rest), fires GET /api/auth/verify?token=..., surfaces the outcome.
 *
 * On success the user's account.active flips to true server-side and they
 * can login. We deliberately DON'T auto-login here — the flow is: register
 * → verify → login (email/password). Keeps this route safe to open in any
 * browser (they might click the link on a device they don't want to stay
 * signed in on).
 *
 * NOT publicOnlyGuard'd — same reasoning as reset-password.
 */
@Component({
  selector: 'page-verify-email',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IonContent, IonSpinner, IonNote, IonButton],
  template: `
    <ion-content class="ion-padding">
      @switch (state()) {
        @case ('verifying') {
          <ion-spinner />
          <p>Verificando tu cuenta…</p>
        }
        @case ('success') {
          <ion-note color="success">Cuenta verificada. Ya podés ingresar.</ion-note>
          <ion-button expand="block" routerLink="/auth/login">Ir al login</ion-button>
        }
        @case ('error') {
          <ion-note color="danger">{{ error() }}</ion-note>
          <ion-button expand="block" routerLink="/auth/login">Volver al login</ion-button>
        }
        @case ('missing-token') {
          <ion-note color="danger">
            Link inválido — falta el token de verificación.
          </ion-note>
          <ion-button expand="block" routerLink="/auth/login">Volver al login</ion-button>
        }
      }
    </ion-content>
  `,
})
export class VerifyEmailPage implements OnInit {
  private readonly api   = inject(AuthApi);
  private readonly route = inject(ActivatedRoute);

  protected readonly state = signal<'verifying' | 'success' | 'error' | 'missing-token'>('verifying');
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.state.set('missing-token');
      return;
    }
    this.api.verifyEmail(token).subscribe({
      next: () => this.state.set('success'),
      error: (err: unknown) => {
        this.state.set('error');
        if (err instanceof HttpError) {
          this.error.set(
            err.status === 401 || err.status === 400
              ? 'El link expiró o ya fue usado. Pedí un nuevo email de verificación.'
              : err.userMessage,
          );
        } else {
          this.error.set('No pudimos verificar tu cuenta. Intentá de nuevo.');
        }
      },
    });
  }
}
