import {
  ChangeDetectionStrategy, Component, computed, inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { IonIcon, AlertController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chevronUpOutline, trashOutline } from 'ionicons/icons';
import { ActiveWorkoutService } from './active-workout.service';

/**
 * Persistent "workout in progress" indicator, mounted by the app
 * shell above the primary tab bar. Reads {@link ActiveWorkoutService}
 * — appears while a workout is active, disappears when it isn't.
 *
 * Layout mirrors Hevy's bottom pill: green dot + elapsed time +
 * current exercise, chevron-up to expand into the tracker,
 * trash to discard (confirms first).
 */
@Component({
  selector: 'app-active-workout-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon],
  styles: [`
    :host {
      display: block;
      border-top: 1px solid var(--ion-color-step-150, rgba(255,255,255,0.08));
      background: var(--ion-background-color, #000);
    }
    .bar {
      display: grid;
      grid-template-columns: 44px 1fr 44px;
      align-items: center;
      padding: 8px 12px;
    }
    .side-btn {
      width: 40px; height: 40px;
      border-radius: 999px;
      border: 1px solid var(--ion-color-step-200, rgba(255,255,255,0.15));
      background: transparent;
      display: inline-flex;
      align-items: center; justify-content: center;
      color: var(--ion-text-color, #fff);
    }
    .side-btn.danger { color: var(--ion-color-danger, #eb445a); }
    .side-btn ion-icon { font-size: 20px; }
    .info {
      padding: 0 12px;
      display: flex; align-items: center; gap: 8px;
      overflow: hidden;
    }
    .dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--ion-color-success, #2dd36f);
      flex-shrink: 0;
    }
    .label {
      display: flex; flex-direction: column;
      overflow: hidden;
    }
    .title {
      font-weight: 600; font-size: 0.95rem;
      color: var(--ion-text-color, #fff);
      font-variant-numeric: tabular-nums;
    }
    .exercise {
      font-size: 0.8rem;
      color: var(--ion-color-medium, #888);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .expand {
      background: transparent; border: 0;
      display: flex; flex-direction: column; align-items: flex-start;
      cursor: pointer; padding: 0;
      text-align: left;
    }
  `],
  template: `
    @if (visible()) {
      <div class="bar">
        <button type="button" class="side-btn" (click)="expand()" aria-label="Volver al entrenamiento">
          <ion-icon name="chevron-up-outline" />
        </button>

        <button type="button" class="expand" (click)="expand()">
          <span class="info">
            <span class="dot" aria-hidden="true"></span>
            <span class="label">
              <span class="title">Entrenamiento {{ active.elapsedMmss() }}</span>
              @if (exerciseLabel(); as ex) {
                <span class="exercise">{{ ex }}</span>
              }
            </span>
          </span>
        </button>

        <button type="button" class="side-btn danger" (click)="confirmDiscard()" aria-label="Descartar entrenamiento">
          <ion-icon name="trash-outline" />
        </button>
      </div>
    }
  `,
})
export class ActiveWorkoutBarComponent {
  protected readonly active = inject(ActiveWorkoutService);
  private readonly router = inject(Router);
  private readonly alerts = inject(AlertController);

  /** Reads a signal (elapsedSeconds) so the label rerenders each tick
   *  under OnPush; also gates the whole component to only render when
   *  a workout is active. */
  protected readonly visible = computed(() => {
    // Access elapsedSeconds so the computed re-runs each tick, keeping
    // the mm:ss label live under OnPush.
    void this.active.elapsedSeconds();
    return this.active.isActive();
  });

  protected exerciseLabel(): string {
    return this.active.currentExerciseLabel();
  }

  constructor() {
    addIcons({
      'chevron-up-outline': chevronUpOutline,
      'trash-outline': trashOutline,
    });
  }

  protected expand(): void {
    const routineId = this.active.routineId();
    if (routineId !== null) {
      void this.router.navigate(['/training/session', routineId]);
    }
  }

  protected async confirmDiscard(): Promise<void> {
    const alert = await this.alerts.create({
      header: '¿Descartar entrenamiento?',
      message: 'Vas a perder lo que registraste hasta ahora.',
      buttons: [
        { text: 'Seguir entrenando', role: 'cancel' },
        { text: 'Descartar',         role: 'destructive' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role === 'destructive') await this.active.discard();
  }
}
