import {
  ChangeDetectionStrategy, Component, ElementRef, ViewChild,
  computed, effect, input, output, signal,
} from '@angular/core';
import {
  IonItem, IonLabel, IonIcon,
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { stopwatchOutline } from 'ionicons/icons';
import { REST_OPTIONS, formatRestSeconds } from './rest-values';

/**
 * Rest-duration picker as a native-feeling scroll wheel.
 *
 * <ion-picker> in Ionic 9 does not render its wheel inside a
 * breakpoint modal (only the header shows). PickerController was
 * removed in v9. Rather than a plain list, we build the wheel with
 * CSS scroll-snap + a top/bottom fade mask. Real touch scroll physics,
 * one file, no framework fight.
 *
 * Interaction:
 *   - Tap the trigger row → opens the sheet.
 *   - Drag the wheel with the finger — item snapped to the middle
 *     row is the "selected" one (larger, tinted).
 *   - Tap Listo → emits the current selection and closes.
 *
 * Two-way contract: `value` in (nullable seconds), `valueChange` out
 * (0 becomes null). Reusable — session tracker in Slice 4 drops it in
 * for per-set rest overrides.
 */
@Component({
  selector: 'training-rest-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonItem, IonLabel, IonIcon,
    IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  ],
  styles: [`
    /* Wheel geometry: each row 44px, wheel 5 rows tall so 2 fade above
       + selected + 2 fade below. Padding above/below equals 2 rows so
       the first/last items can center in the highlight strip. */
    .wheel-shell {
      position: relative;
      padding: 8px 0 24px;
    }
    .wheel {
      position: relative;
      height: 220px;                /* 5 × 44px */
      overflow-y: scroll;
      scroll-snap-type: y mandatory;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior: contain;
      mask-image: linear-gradient(to bottom, transparent 0%, #000 30%, #000 70%, transparent 100%);
      -webkit-mask-image: linear-gradient(to bottom, transparent 0%, #000 30%, #000 70%, transparent 100%);
    }
    .wheel::-webkit-scrollbar { display: none; }
    .wheel-inner {
      padding-block: 88px;          /* 2 × 44px so first/last snap to center */
    }
    .wheel-item {
      height: 44px;
      scroll-snap-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--ion-color-medium, #888);
      font-size: 1rem;
      transition: color 140ms, font-size 140ms, font-weight 140ms;
    }
    .wheel-item.selected {
      color: var(--ion-text-color, #fff);
      font-size: 1.35rem;
      font-weight: 600;
    }
    /* Center highlight bar — pointer-events off so it does not steal drag. */
    .wheel-highlight {
      position: absolute;
      top: 50%;
      left: 12px;
      right: 12px;
      height: 44px;
      transform: translateY(-50%);
      border-top: 1px solid var(--ion-color-step-200, rgba(255, 255, 255, 0.1));
      border-bottom: 1px solid var(--ion-color-step-200, rgba(255, 255, 255, 0.1));
      pointer-events: none;
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
      [isOpen]="isOpen()"
      [initialBreakpoint]="0.5"
      [breakpoints]="[0, 0.5]"
      (ionModalDidPresent)="onPresented()"
      (ionModalDidDismiss)="isOpen.set(false)">
      <ng-template>
        <ion-header>
          <ion-toolbar>
            <ion-title>Descanso</ion-title>
            <ion-buttons slot="end">
              <ion-button (click)="commit()">Listo</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>

        <div class="wheel-shell">
          <div #wheelEl class="wheel" (scroll)="onScroll()">
            <div class="wheel-inner">
              @for (opt of options; track opt) {
                <div class="wheel-item" [class.selected]="opt === draft()">
                  {{ format(opt) }}
                </div>
              }
            </div>
          </div>
          <div class="wheel-highlight" aria-hidden="true"></div>
        </div>
      </ng-template>
    </ion-modal>
  `,
})
export class RestPickerComponent {
  readonly value = input<number | null>(null);
  readonly valueChange = output<number | null>();

  @ViewChild('wheelEl') private wheelEl?: ElementRef<HTMLDivElement>;

  private static readonly ITEM_HEIGHT = 44;

  protected readonly isOpen = signal(false);
  protected readonly options = REST_OPTIONS;
  /** Value currently under the highlight bar — updated on scroll. */
  protected readonly draft = signal<number>(0);

  protected readonly label = computed(() => formatRestSeconds(this.value()));

  constructor() {
    addIcons({ 'stopwatch-outline': stopwatchOutline });
    // Seed the draft from the input whenever it changes so re-opening
    // the modal starts at the persisted value.
    effect(() => this.draft.set(this.value() ?? 0));
  }

  protected open(): void {
    this.isOpen.set(true);
  }

  /** After the modal is presented, jump the wheel to the current value
   *  without animating (the user has not touched anything yet). */
  protected onPresented(): void {
    const el = this.wheelEl?.nativeElement;
    if (!el) return;
    const idx = Math.max(0, this.options.indexOf(this.value() ?? 0));
    el.scrollTop = idx * RestPickerComponent.ITEM_HEIGHT;
  }

  protected onScroll(): void {
    const el = this.wheelEl?.nativeElement;
    if (!el) return;
    const idx = Math.round(el.scrollTop / RestPickerComponent.ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(this.options.length - 1, idx));
    const val = this.options[clamped];
    if (val !== this.draft()) this.draft.set(val);
  }

  protected commit(): void {
    const s = this.draft();
    this.valueChange.emit(s === 0 ? null : s);
    this.isOpen.set(false);
  }

  protected format(s: number): string {
    return formatRestSeconds(s);
  }
}
