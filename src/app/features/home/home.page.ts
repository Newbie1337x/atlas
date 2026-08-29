import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { injectQuery } from '@tanstack/angular-query-experimental';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonSpinner, IonNote,
} from '@ionic/angular';
import { UsersApi } from '@core/users/users.api';

/**
 * Home tab — the SOCIAL FEED of workouts. Merges what
 * used to be split across two features (dashboard + social).
 *
 * Feed content ships in a later slice (backend: SOCIAL module Post/Comment/
 * Like/Follow + auto-posts from workouts via sourceModule/sourceEventId).
 * For now the page proves the shell wiring by rendering the user's own
 * enriched profile via /api/users/me — same query used by /profile so the
 * cache is shared and navigation between the two doesn't refetch.
 */
@Component({
  selector: 'page-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonContent, IonHeader, IonTitle, IonToolbar, IonSpinner, IonNote,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Inicio</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      @if (meQuery.isPending()) {
        <ion-spinner />
      } @else if (meQuery.isError()) {
        <ion-note color="danger">No pudimos cargar tu perfil.</ion-note>
      } @else if (meQuery.data(); as u) {
        <p>Hola <strong>{{ u.firstName || u.email }}</strong>{{ u.lastName ? ' ' + u.lastName : '' }}</p>
        @if (u.avatarUrl) {
          <img [src]="u.avatarUrl" alt="avatar" width="64" height="64" />
        }
        <p>(Placeholder — acá va el feed social de workouts + sugeridos)</p>
      }
    </ion-content>
  `,
})
export class HomePage {
  private readonly api = inject(UsersApi);

  protected readonly meQuery = injectQuery(() => ({
    queryKey: ['me'] as const,
    queryFn:  () => firstValueFrom(this.api.getMe()),
  }));
}
