import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  IonContent, IonHeader, IonTitle, IonToolbar,
  IonItem, IonLabel, IonInput, IonButton, IonNote,
} from '@ionic/angular';
import { AuthApi } from '@core/auth/auth.api';
import { HttpError } from '@core/errors/http-error';

/**
 * Forgot-password form → POST /api/auth/forgot-password.
 *
 * Backend is enumeration-safe: returns 200 whether or not the email maps
 * to a real user (silent no-op for unknown / OAuth-provisioned users).
 * We mirror that — success message never confirms account existence.
 *
 * Rate limited server-side to 3/min per IP (Proteus bucket4j filter[5]).
 * 429 surfaces as a specific message instead of a generic error.
 */
@Component({
  selector: 'page-forgot-password',
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
        <ion-title>Recuperar contraseña</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      @if (sent()) {
        <ion-note color="success">
          Si el email existe, te enviamos un link para resetear tu contraseña.
          Revisá tu bandeja de entrada.
        </ion-note>
        <ion-button expand="block" routerLink="/auth/login">Volver al login</ion-button>
      } @else {
        <form (ngSubmit)="submit()">
          <ion-item>
            <ion-label position="stacked">Email</ion-label>
            <ion-input type="email" name="email" autocomplete="email" [(ngModel)]="email" required />
          </ion-item>

          @if (error()) {
            <ion-note color="danger">{{ error() }}</ion-note>
          }

          <ion-button type="submit" expand="block" [disabled]="loading()">
            {{ loading() ? 'Enviando…' : 'Enviar link' }}
          </ion-button>

          <ion-button fill="clear" expand="block" routerLink="/auth/login">
            Cancelar
          </ion-button>
        </form>
      }
    </ion-content>
  `,
})
export class ForgotPasswordPage {
  private readonly api = inject(AuthApi);

  protected email = '';
  protected readonly loading = signal(false);
  protected readonly error   = signal<string | null>(null);
  protected readonly sent    = signal(false);

  submit(): void {
    if (!this.email) {
      this.error.set('Ingresá tu email.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);

    this.api.forgotPassword(this.email.trim()).subscribe({
      next: () => this.sent.set(true),
      error: (err: unknown) => {
        this.loading.set(false);
        if (err instanceof HttpError && err.status === 429) {
          this.error.set('Demasiados intentos. Probá de nuevo en un minuto.');
        } else {
          this.error.set('No pudimos enviar el link. Intentá de nuevo.');
        }
      },
    });
  }
}
