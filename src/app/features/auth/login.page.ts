import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonNote,
} from '@ionic/angular';
import { AuthApi } from '@core/auth/auth.api';
import { AuthService } from '@core/auth/auth.service';
import { HttpError } from '@core/errors/http-error';

/**
 * Skeleton login. Zero styling by design — visual pass comes later. Only
 * job right now: prove the full flow works end-to-end (form → HttpClient →
 * interceptor → AuthService → storage → guard release → shell load).
 */
@Component({
  selector: 'page-login',
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
        <ion-title>Login</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <form (ngSubmit)="submit()">
        <ion-item>
          <ion-label position="stacked">Email</ion-label>
          <ion-input
            type="email"
            name="email"
            autocomplete="email"
            [(ngModel)]="email"
            required
          />
        </ion-item>

        <ion-item>
          <ion-label position="stacked">Contraseña</ion-label>
          <ion-input
            type="password"
            name="password"
            autocomplete="current-password"
            [(ngModel)]="password"
            required
          />
        </ion-item>

        @if (error()) {
          <ion-note color="danger">{{ error() }}</ion-note>
        }

        <ion-button
          type="submit"
          expand="block"
          [disabled]="loading()"
        >
          {{ loading() ? 'Ingresando…' : 'Ingresar' }}
        </ion-button>
      </form>

      <ion-button expand="block" fill="outline" (click)="loginWithGoogle()">
        Continuar con Google
      </ion-button>

      <ion-button fill="clear" expand="block" routerLink="/auth/forgot-password">
        ¿Olvidaste tu contraseña?
      </ion-button>

      <ion-button fill="clear" expand="block" routerLink="/auth/register">
        Crear cuenta nueva
      </ion-button>
    </ion-content>
  `,
})
export class LoginPage {
  private readonly api    = inject(AuthApi);
  private readonly auth   = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route  = inject(ActivatedRoute);

  protected email    = '';
  protected password = '';
  protected readonly loading = signal(false);
  protected readonly error   = signal<string | null>(null);

  submit(): void {
    if (!this.email || !this.password) {
      this.error.set('Completá email y contraseña.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);

    this.auth.login(this.email, this.password).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/';
        void this.router.navigateByUrl(returnUrl);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        if (err instanceof HttpError) {
          this.error.set(
            err.status === 401 ? 'Credenciales inválidas.' :
            err.status === 403 ? 'Verificá tu cuenta antes de ingresar.' :
            err.status === 429 ? 'Demasiados intentos. Probá de nuevo en un minuto.' :
            err.userMessage,
          );
        } else {
          this.error.set('No pudimos ingresar. Intentá de nuevo.');
        }
      },
    });
  }

  /**
   * Full-page redirect to Proteus's OAuth2 kickoff. Not an XHR — the OAuth
   * flow requires a same-tab navigation so Google's login screen can render.
   * Landing point after Google auth is /auth/oauth-callback (see
   * OAuthCallbackPage).
   */
  loginWithGoogle(): void {
    window.location.href = this.api.oauthAuthorizeUrl('google');
  }
}
