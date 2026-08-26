import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  injectMutation, injectQuery, injectQueryClient,
} from '@tanstack/angular-query-experimental';
import {
  IonContent, IonHeader, IonTitle, IonToolbar,
  IonButton, IonNote, IonSpinner, IonList, IonItem, IonLabel,
} from '@ionic/angular';
import { AuthService } from '@core/auth/auth.service';
import { UsersApi } from '@core/users/users.api';
import { HttpError } from '@core/errors/http-error';
import { UserProfile } from '@core/users/user.model';

/**
 * Profile — linked-accounts management + logout. Uses the SAME ['me'] query
 * key as home.page so mutating identities here (unlink) refreshes home's
 * displayed data too via `setQueryData` on success.
 *
 * Skinless — real design comes later. Focus is on the interaction contract:
 *   - Show each linked identity with an "Desvincular" button
 *   - Backend refuses (422) when unlink would leave account with no auth;
 *     surface that as a friendly message instead of a generic error
 *   - Logout clears session and returns to /auth/login
 */
@Component({
  selector: 'page-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonContent, IonHeader, IonTitle, IonToolbar,
    IonButton, IonNote, IonSpinner, IonList, IonItem, IonLabel,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Perfil</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      @if (meQuery.isPending()) {
        <ion-spinner />
      } @else if (meQuery.isError()) {
        <ion-note color="danger">No pudimos cargar tu perfil.</ion-note>
      } @else if (meQuery.data(); as u) {
        <p><strong>{{ u.email }}</strong></p>
        <p>{{ (u.firstName || '') + ' ' + (u.lastName || '') }}</p>

        <h3>Cuentas vinculadas</h3>
        @if (u.linkedProviders.length === 0) {
          <ion-note>No tenés ningún proveedor externo vinculado.</ion-note>
        } @else {
          <ion-list>
            @for (provider of u.linkedProviders; track provider) {
              <ion-item>
                <ion-label>{{ provider }}</ion-label>
                <ion-button
                  slot="end"
                  color="medium"
                  [disabled]="unlink.isPending()"
                  (click)="onUnlink(provider)"
                >
                  Desvincular
                </ion-button>
              </ion-item>
            }
          </ion-list>
        }

        <p>Contraseña local: {{ u.hasLocalPassword ? 'sí' : 'no' }}</p>

        @if (unlinkError()) {
          <ion-note color="danger">{{ unlinkError() }}</ion-note>
        }
      }

      <ion-button expand="block" color="medium" (click)="logout()">
        Cerrar sesión
      </ion-button>
    </ion-content>
  `,
})
export class ProfilePage {
  private readonly api         = inject(UsersApi);
  private readonly auth        = inject(AuthService);
  private readonly router      = inject(Router);
  private readonly queryClient = injectQueryClient();

  protected readonly meQuery = injectQuery(() => ({
    queryKey: ['me'] as const,
    queryFn:  () => firstValueFrom(this.api.getMe()),
  }));

  protected readonly unlink = injectMutation(() => ({
    mutationFn: (provider: string) => firstValueFrom(this.api.unlinkIdentity(provider)),
    onSuccess: (updated: UserProfile) => {
      // Write the fresh profile straight into the ['me'] cache — no
      // network round-trip needed since the DELETE endpoint returned it.
      this.queryClient.setQueryData(['me'], updated);
    },
  }));

  protected unlinkError(): string | null {
    const err = this.unlink.error();
    if (!err) return null;
    if (err instanceof HttpError) {
      // 422 = backend refused because it would leave account with no auth.
      // We surface the backend message directly — it's already actionable
      // ("configurá una contraseña primero o vinculá otro proveedor").
      if (err.status === 422) return err.userMessage;
      return 'No pudimos desvincular. Intentá de nuevo.';
    }
    return 'No pudimos desvincular. Intentá de nuevo.';
  }

  protected onUnlink(provider: string): void {
    this.unlink.mutate(provider);
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    // Purge the cached profile so the next login doesn't briefly see the
    // previous user's data.
    this.queryClient.removeQueries({ queryKey: ['me'] });
    await this.router.navigate(['/auth/login']);
  }
}
