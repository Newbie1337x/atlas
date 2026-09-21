import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RouterLink } from '@angular/router';
import { injectQuery } from '@tanstack/angular-query-experimental';
import {
  IonContent, IonSpinner, IonNote, IonIcon,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  flameOutline, chevronForward, barbellOutline, addCircleOutline,
} from 'ionicons/icons';
import { UsersApi } from '@core/users/users.api';
import { TrainingApi } from '@core/training/training.api';
import { trainingKeys } from '@core/training/training.keys';

/**
 * Home tab — today's landing surface. The eventual SOCIAL feed (backend:
 * SOCIAL module Post/Comment/Like/Follow + auto-posts from workouts) is a
 * later slice; until it ships, this renders what's real today: the user's
 * profile header + their own routines as quick-start cards, so the tab
 * is never an empty stub. Reuses /api/users/me (shared cache with
 * /profile) and /api/training/routines/me (shared cache with the
 * training tab) — no duplicate fetches, no bespoke home-only endpoints.
 */
@Component({
  selector: 'page-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IonContent, IonSpinner, IonNote, IonIcon],
  styles: [`
    ion-content {
      --padding-top: env(safe-area-inset-top);
    }
    .header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 20px 20px 8px;
    }
    .avatar {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
    }
    .avatar-fallback {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(150deg, var(--atlas-accent-tint), var(--atlas-accent) 70%);
      color: #0a0c0f;
      font-weight: 800;
      font-size: 20px;
    }
    .greeting p {
      margin: 0;
      color: var(--atlas-muted);
      font-size: 13px;
    }
    .greeting h2 {
      margin: 2px 0 0;
      font-size: 20px;
      font-weight: 700;
    }
    .cta-card {
      margin: 16px 20px 8px;
      padding: 20px;
      border-radius: var(--atlas-radius-lg);
      background: linear-gradient(135deg, #ff5a1f, #ff8a3d);
      color: #0a0c0f;
      display: flex;
      align-items: center;
      justify-content: space-between;
      text-decoration: none;
      -webkit-tap-highlight-color: transparent;
    }
    .cta-card:active {
      opacity: 0.9;
    }
    .cta-text h3 {
      margin: 0 0 2px;
      font-size: 18px;
      font-weight: 800;
    }
    .cta-text p {
      margin: 0;
      font-size: 13px;
      opacity: 0.85;
    }
    .cta-icon {
      font-size: 30px;
    }
    .section {
      padding: 24px 20px 8px;
    }
    .section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    .section-head h3 {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
      color: var(--ion-text-color);
    }
    .section-head a {
      font-size: 13px;
      color: var(--atlas-accent);
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 2px;
    }
    .routine-row {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 0 20px;
    }
    .routine-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      border-radius: var(--atlas-radius-md);
      background: var(--atlas-surface);
      border: 1px solid var(--atlas-border);
      text-decoration: none;
      color: var(--ion-text-color);
      -webkit-tap-highlight-color: transparent;
    }
    .routine-card:active {
      background: var(--atlas-surface-raised);
    }
    .routine-card h4 {
      margin: 0 0 2px;
      font-size: 15px;
      font-weight: 600;
    }
    .routine-card p {
      margin: 0;
      font-size: 12px;
      color: var(--atlas-muted);
    }
    .empty-routines {
      margin: 0 20px;
      padding: 22px;
      border-radius: var(--atlas-radius-md);
      border: 1px dashed var(--atlas-border);
      text-align: center;
      color: var(--atlas-muted);
      font-size: 14px;
    }
    .empty-routines a {
      display: inline-block;
      margin-top: 10px;
      color: var(--atlas-accent);
      font-weight: 600;
      text-decoration: none;
    }
    .center-pad {
      display: flex;
      justify-content: center;
      padding: 40px 0;
    }
  `],
  template: `
    <ion-content [fullscreen]="true">
      @if (meQuery.isPending()) {
        <div class="center-pad"><ion-spinner /></div>
      } @else if (meQuery.isError()) {
        <div class="center-pad"><ion-note color="danger">No pudimos cargar tu perfil.</ion-note></div>
      } @else if (meQuery.data(); as u) {
        <div class="header">
          @if (u.avatarUrl) {
            <img class="avatar" [src]="u.avatarUrl" alt="avatar">
          } @else {
            <div class="avatar-fallback">{{ initials(u.firstName, u.lastName, u.email) }}</div>
          }
          <div class="greeting">
            <p>Bienvenido de vuelta</p>
            <h2>{{ u.firstName || u.email }}</h2>
          </div>
        </div>

        <a class="cta-card" routerLink="/training">
          <div class="cta-text">
            <h3>Empezar entrenamiento</h3>
            <p>Elegí una rutina y arrancá ahora</p>
          </div>
          <ion-icon class="cta-icon" name="flame-outline" />
        </a>

        <div class="section">
          <div class="section-head">
            <h3>Tus rutinas</h3>
            <a routerLink="/training">Ver todas <ion-icon name="chevron-forward" /></a>
          </div>

          @if (routinesQuery.isPending()) {
            <div class="center-pad"><ion-spinner /></div>
          } @else if (topRoutines().length) {
            <div class="routine-row">
              @for (r of topRoutines(); track r.id) {
                <a class="routine-card" [routerLink]="['/training/routines', r.id]">
                  <div>
                    <h4>{{ r.title }}</h4>
                    <p>{{ r.totalExerciseCount }} ejercicios · {{ r.totalSetCount }} sets</p>
                  </div>
                  <ion-icon name="barbell-outline" />
                </a>
              }
            </div>
          } @else {
            <div class="empty-routines">
              Todavía no creaste ninguna rutina.
              <br>
              <a routerLink="/training">
                <ion-icon name="add-circle-outline" /> Crear tu primera rutina
              </a>
            </div>
          }
        </div>
      }
    </ion-content>
  `,
})
export class HomePage {
  private readonly usersApi = inject(UsersApi);
  private readonly trainingApi = inject(TrainingApi);

  constructor() {
    addIcons({
      'flame-outline': flameOutline,
      'chevron-forward': chevronForward,
      'barbell-outline': barbellOutline,
      'add-circle-outline': addCircleOutline,
    });
  }

  protected readonly meQuery = injectQuery(() => ({
    queryKey: ['me'] as const,
    queryFn:  () => firstValueFrom(this.usersApi.getMe()),
  }));

  protected readonly routinesQuery = injectQuery(() => ({
    queryKey: trainingKeys.myRoutinesPage(0, 3),
    queryFn:  () => firstValueFrom(this.trainingApi.listMyRoutines(0, 3)),
  }));

  protected readonly topRoutines = computed(() => this.routinesQuery.data()?.items ?? []);

  protected initials(firstName: string | null, lastName: string | null, email: string): string {
    if (firstName) return (firstName[0] + (lastName?.[0] ?? '')).toUpperCase();
    return email[0]?.toUpperCase() ?? '?';
  }
}
