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
 * Register form → POST /api/auth/register. Backend creates the user with
 * active=false + fires a verification email (see Proteus UserService.
 * registerLocal). User cannot login until they hit the /auth/verify link
 * from the email.
 *
 * OAuth users don't go through this — they land on /auth/oauth-callback
 * already verified. This form is ONLY for the email/password path.
 *
 * Skinless — visual polish comes later. Only job: wire the endpoint and
 * surface the outcome so we can test the flow via Mailhog end-to-end.
 */
@Component({
  selector: 'page-register',
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
        <ion-title>Crear cuenta</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      @if (success()) {
        <ion-note color="success">
          Cuenta creada. Revisá tu email para verificar antes de ingresar.
        </ion-note>
        <ion-button expand="block" routerLink="/auth/login">Ir al login</ion-button>
      } @else {
        <form (ngSubmit)="submit()">
          <ion-item>
            <ion-label position="stacked">Nombre</ion-label>
            <ion-input name="firstName" autocomplete="given-name" [(ngModel)]="firstName" required />
          </ion-item>

          <ion-item>
            <ion-label position="stacked">Apellido</ion-label>
            <ion-input name="lastName" autocomplete="family-name" [(ngModel)]="lastName" required />
          </ion-item>

          <ion-item>
            <ion-label position="stacked">Email</ion-label>
            <ion-input type="email" name="email" autocomplete="email" [(ngModel)]="email" required />
          </ion-item>

          <ion-item>
            <ion-label position="stacked">Contraseña</ion-label>
            <ion-input type="password" name="password" autocomplete="new-password" [(ngModel)]="password" required />
          </ion-item>

          @if (error()) {
            <ion-note color="danger">{{ error() }}</ion-note>
          }

          <ion-button type="submit" expand="block" [disabled]="loading()">
            {{ loading() ? 'Creando…' : 'Crear cuenta' }}
          </ion-button>

          <ion-button fill="clear" expand="block" routerLink="/auth/login">
            Ya tengo cuenta
          </ion-button>
        </form>
      }
    </ion-content>
  `,
})
export class RegisterPage {
  private readonly api = inject(AuthApi);

  protected firstName = '';
  protected lastName  = '';
  protected email     = '';
  protected password  = '';
  protected readonly loading = signal(false);
  protected readonly error   = signal<string | null>(null);
  protected readonly success = signal(false);

  submit(): void {
    if (!this.firstName || !this.lastName || !this.email || !this.password) {
      this.error.set('Completá todos los campos.');
      return;
    }
    if (this.password.length < 8) {
      this.error.set('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);

    this.api.register({
      firstName: this.firstName.trim(),
      lastName:  this.lastName.trim(),
      email:     this.email.trim(),
      password:  this.password,
    }).subscribe({
      next: () => this.success.set(true),
      error: (err: unknown) => {
        this.loading.set(false);
        if (err instanceof HttpError) {
          this.error.set(
            err.status === 409 ? 'Ya existe una cuenta con ese email.' :
            err.status === 429 ? 'Demasiados intentos. Probá de nuevo en un minuto.' :
            err.userMessage,
          );
        } else {
          this.error.set('No pudimos crear la cuenta. Intentá de nuevo.');
        }
      },
    });
  }
}
