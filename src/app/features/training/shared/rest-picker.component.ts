import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import {
  IonItem, IonLabel, IonIcon,
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent,
  IonPicker, IonPickerColumn, IonPickerColumnOption,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { stopwatchOutline } from 'ionicons/icons';
import { REST_OPTIONS, formatRestSeconds } from './rest-values';

/**
 * Rest-duration picker. Renders as an ion-item that reads "Descanso: 1min 30s"
 * (or "Apagado" when the value is 0/null). Tapping it opens a bottom-sheet
 * modal containing a scroll-wheel with a curated list of durations.
 *
 * Reusable — same picker is needed by the session tracker (Slice 4) where
 * the user overrides the routine's default rest per set. Kept as its own
 * component so wire-up is one line at every call site.
 *
 * Two-way-ish contract: takes `value` (nullable seconds), emits
 * `valueChange` on pick. 0 is emitted as null so callers do not need to
 * treat "Apagado" as a special number.
 */
@Component({
  selector: 'training-rest-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonItem, IonLabel, IonIcon,
    IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent,
    IonPicker, IonPickerColumn, IonPickerColumnOption,
  ],
  styles: [`
    ion-modal {
      --height: auto;
    }
    .picker-shell {
      display: flex;
      flex-direction: column;
      max-height: 60vh;
    }
  `],
  template: `
    <ion-item button [detail]="false" (click)="open.set(true)">
      <ion-icon slot="start" name="stopwatch-outline" aria-hidden="true" />
      <ion-label>
        <h3>Descanso</h3>
        <p>{{ label() }}</p>
      </ion-label>
    </ion-item>

    <ion-modal
      [isOpen]="open()"
      [initialBreakpoint]="0.5"
      [breakpoints]="[0, 0.5]"
      (ionModalDidDismiss)="open.set(false)">
      <ng-template>
        <div class="picker-shell">
          <ion-header>
            <ion-toolbar>
              <ion-title>Descanso</ion-title>
              <ion-buttons slot="end">
                <ion-button (click)="open.set(false)">Listo</ion-button>
              </ion-buttons>
            </ion-toolbar>
          </ion-header>
          <ion-content>
            <ion-picker>
              <ion-picker-column
                [value]="pickerValue()"
                (ionChange)="onPick($event)">
                @for (opt of options; track opt) {
                  <ion-picker-column-option [value]="opt">
                    {{ format(opt) }}
                  </ion-picker-column-option>
                }
              </ion-picker-column>
            </ion-picker>
          </ion-content>
        </div>
      </ng-template>
    </ion-modal>
  `,
})
export class RestPickerComponent {
  /** Current value in seconds. `null` = APAGADO. */
  readonly value = input<number | null>(null);
  /** Emitted whenever the wheel lands on a new value. 0 comes out as null. */
  readonly valueChange = output<number | null>();

  protected readonly open = signal(false);
  protected readonly options = REST_OPTIONS;

  constructor() {
    addIcons({ 'stopwatch-outline': stopwatchOutline });
  }

  /** Text under the label — "1min 30s" / "45s" / "Apagado". */
  protected label(): string {
    return formatRestSeconds(this.value());
  }

  /** The picker column needs a real number; treat null as 0 (Apagado). */
  protected pickerValue(): number {
    return this.value() ?? 0;
  }

  protected onPick(ev: Event): void {
    const detail = (ev as CustomEvent<{ value?: unknown }>).detail;
    const raw = detail?.value;
    const seconds = typeof raw === 'number' ? raw : Number(raw ?? 0);
    this.valueChange.emit(seconds === 0 ? null : seconds);
  }

  protected format(s: number): string {
    return formatRestSeconds(s);
  }
}
