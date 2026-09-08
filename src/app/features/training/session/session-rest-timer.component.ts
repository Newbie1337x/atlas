import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { addOutline, playSkipForwardOutline, removeOutline } from 'ionicons/icons';
import { RestTimerService } from './rest-timer.service';

/**
 * Sticky bottom banner that appears whenever the rest timer is
 * counting down. Shows MM:SS, ±15s buttons and a Skip. Renders as
 * `[hidden]` when inactive so the layout doesn't jump.
 */
@Component({
  selector: 'app-training-session-rest-timer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonButton, IonIcon],
  styles: [`
    :host {
      position: sticky;
      bottom: 0;
      display: block;
      background: var(--ion-color-primary, #3880ff);
      color: #fff;
      padding: 10px 12px;
      border-top: 1px solid rgba(255, 255, 255, 0.2);
      z-index: 10;
    }
    :host[hidden] { display: none; }
    .bar {
      display: flex;
      align-items: center;
      gap: 8px;
      justify-content: space-between;
    }
    .time {
      font-size: 1.6rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      flex: 1;
      text-align: center;
    }
    .btn {
      --color: #fff;
      --border-color: rgba(255, 255, 255, 0.5);
    }
  `],
  template: `
    <div class="bar">
      <ion-button fill="outline" size="small" class="btn" (click)="restTimer.bump(-15)"
                  aria-label="Restar 15 segundos">
        <ion-icon slot="icon-only" name="remove-outline" />
      </ion-button>

      <span class="time" aria-live="polite">{{ mmss() }}</span>

      <ion-button fill="outline" size="small" class="btn" (click)="restTimer.bump(15)"
                  aria-label="Sumar 15 segundos">
        <ion-icon slot="icon-only" name="add-outline" />
      </ion-button>

      <ion-button fill="clear" size="small" class="btn" (click)="restTimer.skip()"
                  aria-label="Saltar descanso">
        <ion-icon slot="icon-only" name="play-skip-forward-outline" />
      </ion-button>
    </div>
  `,
  host: { '[hidden]': '!restTimer.active()' },
})
export class SessionRestTimerComponent {
  protected readonly restTimer = inject(RestTimerService);

  constructor() {
    addIcons({
      'add-outline': addOutline,
      'remove-outline': removeOutline,
      'play-skip-forward-outline': playSkipForwardOutline,
    });
  }

  protected mmss(): string {
    const s = this.restTimer.remaining();
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, '0')}`;
  }
}
