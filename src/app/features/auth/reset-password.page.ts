import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  IonContent, IonHeader, IonTitle, IonToolbar,
  IonItem, IonLabel, IonInput, IonButton, IonNote,
} from '@ionic/angular';
import { AuthApi } from '@core/auth/auth.api';
import { HttpError } from '@core/errors/http-error';

/**
 * Reset-password form → POST /api/auth/reset-password.
 *
 * Reads the one-time token from ?token=... — the email link the user just
 * clicked delivered it. Token is single-use, TTL 1h, hashed at rest server-side
 * (Proteus TokenHasher). On success backend also revokes all refresh tokens
 * for the user — any leaked session dies with the password change.
 *
 * NOT publicOnlyGuard'd: a logged-in user clicking a reset link (e.g. via
 * Gmail on a laptop where they're still signed in) still needs to complete
 * the reset, same reasoning as oauth-callback.
 */
@Component({
  selector: 'page-reset-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, RouterLink,
    IonContent, IonHeader, IonTitle, IonToolbar,
    IonItem, IonLabel, IonInput, IonButton, IonNote,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Nueva contraseña</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      @if (!token()) {
        <ion-note color="danger">
          Link inválido — falta el token. Volvé a pedir el reset.
        </ion-note>
        <ion-button expand="block" routerLink="/auth/forgot-password">
          Pedir link de nuevo
        </ion-button>
      } @else if (success()) {
        <ion-note color="success">
          Contraseña actualizada. Ya podés ingresar con la nueva.
        </ion-note>
        <ion-button expand="block" routerLink="/auth/login">Ir al login</ion-button>
      } @else {
        <form (ngSubmit)="submit()">
          <ion-item>
            <ion-label position="stacked">Nueva contraseña</ion-label>
            <ion-input
              type="password"
              name="newPassword"
              autocomplete="new-password"
              [(ngModel)]="newPassword"
              required
            />
          </ion-item>

          @if (error()) {
            <ion-note color="danger">{{ error() }}</ion-note>
          }

          <ion-button type="submit" expand="block" [disabled]="loading()">
            {{ loading() ? 'Actualizando…' : 'Actualizar contraseña' }}
          </ion-button>
        </form>
      }
    </ion-content>
  `,
})
export class ResetPasswordPage implements OnInit {
  private readonly api    = inject(AuthApi);
  private readonly route  = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected newPassword = '';
  protected readonly token   = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly error   = signal<string | null>(null);
  protected readonly success = signal(false);

  ngOnInit(): void {
    this.token.set(this.route.snapshot.queryParamMap.get('token'));
  }

  submit(): void {
    const t = this.token();
    if (!t) return;
    if (this.newPassword.length < 8) {
      this.error.set('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);

    this.api.resetPassword(t, this.newPassword).subscribe({
      next: () => {
        this.success.set(true);
        // Auto-bounce to login after a beat so the user doesn't have to click
        // if they leave the tab open. 2s is enough to read the success note.
        setTimeout(() => void this.router.navigateByUrl('/auth/login', { replaceUrl: true }), 2000);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        if (err instanceof HttpError) {
          this.error.set(
            err.status === 401 ? 'El link expiró o ya fue usado. Pedí uno nuevo.' :
            err.status === 429 ? 'Demasiados intentos. Probá de nuevo en un minuto.' :
            err.userMessage,
          );
        } else {
          this.error.set('No pudimos actualizar la contraseña. Intentá de nuevo.');
        }
      },
    });
  }
}
