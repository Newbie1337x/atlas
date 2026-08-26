import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import {
  IonContent, IonHeader, IonTitle, IonToolbar,
  IonItem, IonLabel, IonInput, IonButton, IonNote,
  IonBackButton, IonButtons,
} from '@ionic/angular';
import { AuthService } from '@core/auth/auth.service';
import { HttpError } from '@core/errors/http-error';

/**
 * Email + password form — the FALLBACK auth path. Prominent social buttons
 * live on /auth/login; this page is what the tiny "Ingresar con email" link
 * leads to. Keeping it on its own route means the main login stays a clean
 * three-button choose-your-provider screen, and the folks who need to type
 * a password get a focused screen with no other UI competing.
 */
@Component({
  selector: 'page-email-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, RouterLink,
    IonContent, IonHeader, IonTitle, IonToolbar,
    IonItem, IonLabel, IonInput, IonButton, IonNote,
    IonBackButton, IonButtons,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/auth/login" />
        </ion-buttons>
        <ion-title>Ingresar con email</ion-title>
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

        <ion-button type="submit" expand="block" [disabled]="loading()">
          {{ loading() ? 'Ingresando…' : 'Ingresar' }}
        </ion-button>

        <ion-button fill="clear" expand="block" routerLink="/auth/forgot-password">
          ¿Olvidaste tu contraseña?
        </ion-button>

        <ion-button fill="clear" expand="block" routerLink="/auth/register">
          Crear cuenta nueva
        </ion-button>
      </form>
    </ion-content>
  `,
})
export class EmailLoginPage {
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
          // 422 = credentials OK but account deactivated (email not verified yet).
          // 403 reserved for other forbidden reasons (banned, role-locked).
          this.error.set(
            err.status === 401 ? 'Credenciales inválidas.' :
            err.status === 403 || err.status === 422
              ? 'Verificá tu cuenta desde el link que te llegó por email antes de ingresar.'
              :
            err.status === 429 ? 'Demasiados intentos. Probá de nuevo en un minuto.' :
            err.userMessage,
          );
        } else {
          this.error.set('No pudimos ingresar. Intentá de nuevo.');
        }
      },
    });
  }
}
