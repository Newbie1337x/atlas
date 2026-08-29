import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, computed, input, output, signal } from '@angular/core';
import {
  IonItem, IonLabel, IonIcon,
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent,
  IonList,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { stopwatchOutline, checkmark } from 'ionicons/icons';
import { REST_OPTIONS, formatRestSeconds } from './rest-values';

/**
 * Rest-duration picker. The trigger row reads "Descanso: 1min 30s" and
 * opens a bottom-sheet with a scrollable list of curated durations. The
 * current value gets a checkmark; tapping any row commits it and closes
 * the sheet.
 *
 * Not a wheel picker — <ion-picker> in Ionic 9 has layout quirks inside
 * a breakpoint modal that we could not chase down inside our time
 * budget. A tap-to-pick list is more reliable and equally clear. The
 * component API stays the same either way, so swapping to a wheel later
 * touches only this file.
 *
 * Reusable — the session tracker (Slice 4) drops it in for per-set rest
 * overrides. Two-way-ish contract: takes `value` (nullable seconds),
 * emits `valueChange` on pick; 0 is emitted as null so callers do not
 * treat "Apagado" as a special number.
 */
@Component({
  selector: 'training-rest-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonItem, IonLabel, IonIcon,
    IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent,
    IonList,
  ],
  styles: [`
    .opt {
      --min-height: 44px;
    }
    .opt.selected {
      --background: var(--ion-color-primary-tint, rgba(56, 128, 255, 0.08));
      font-weight: 600;
    }
    .check {
      color: var(--ion-color-primary, #3880ff);
    }
  `],
  template: `
    <ion-item button [detail]="false" (click)="open()">
      <ion-icon slot="start" name="stopwatch-outline" aria-hidden="true" />
      <ion-label>
        <h3>Descanso</h3>
        <p>{{ label() }}</p>
      </ion-label>
    </ion-item>

    <ion-modal
      #modal
      [isOpen]="isOpen()"
      [initialBreakpoint]="0.6"
      [breakpoints]="[0, 0.6, 1]"
      (ionModalDidDismiss)="isOpen.set(false)">
      <ng-template>
        <ion-header>
          <ion-toolbar>
            <ion-title>Descanso</ion-title>
            <ion-buttons slot="end">
              <ion-button (click)="close()">Cerrar</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content>
          <ion-list>
            @for (opt of options; track opt) {
              <ion-item
                button
                [detail]="false"
                class="opt"
                [class.selected]="opt === (value() ?? 0)"
                (click)="pick(opt)">
                <ion-label>{{ format(opt) }}</ion-label>
                @if (opt === (value() ?? 0)) {
                  <ion-icon slot="end" name="checkmark" class="check" aria-hidden="true" />
                }
              </ion-item>
            }
          </ion-list>
        </ion-content>
      </ng-template>
    </ion-modal>
  `,
})
export class RestPickerComponent {
  /** Current value in seconds. `null` = APAGADO. */
  readonly value = input<number | null>(null);
  /** Emitted whenever the user picks a duration. 0 comes out as null. */
  readonly valueChange = output<number | null>();

  @ViewChild('modal') private modalRef?: { dismiss: () => Promise<unknown> };

  protected readonly isOpen = signal(false);
  protected readonly options = REST_OPTIONS;

  protected readonly label = computed(() => formatRestSeconds(this.value()));

  constructor() {
    addIcons({ 'stopwatch-outline': stopwatchOutline, checkmark });
  }

  protected open(): void {
    this.isOpen.set(true);
  }

  protected close(): void {
    this.isOpen.set(false);
  }

  protected pick(seconds: number): void {
    this.valueChange.emit(seconds === 0 ? null : seconds);
    this.close();
  }

  protected format(s: number): string {
    return formatRestSeconds(s);
  }
}
