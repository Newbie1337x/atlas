import {
  ChangeDetectionStrategy, Component, ElementRef, ViewChild,
  computed, effect, input, output, signal,
} from '@angular/core';
import { IonItem, IonLabel, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { stopwatchOutline } from 'ionicons/icons';
import { REST_OPTIONS, formatRestSeconds } from './rest-values';

/**
 * Rest-duration picker. Trigger row + a custom bottom-sheet overlay
 * (own div + backdrop, no ion-modal). Two IonModal iterations died to
 * layout quirks in Ionic 9 — the overlay is fully controlled: fixed
 * 50vh sheet at the bottom, no vertical drag expansion, backdrop
 * closes, Listo commits.
 *
 * Wheel is CSS scroll-snap. 5s uniform grain. Real touch scroll
 * physics via native overflow-y:scroll + scroll-snap. The row snapped
 * to the middle is the "draft"; grows + tints on center-hover.
 *
 * Contract: `value` in (nullable seconds), `valueChange` out — 0
 * comes out as null. Reusable — the session tracker in Slice 4 drops
 * it in for per-set rest overrides.
 */
@Component({
  selector: 'training-rest-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonItem, IonLabel, IonIcon],
  styles: [`
    /* --- Overlay + sheet --- */
    .backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 1000;
      animation: fade-in 180ms ease-out;
    }
    .sheet {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      height: 50vh;
      max-height: 440px;
      z-index: 1001;
      background: var(--ion-background-color, #1c1c1e);
      border-radius: 16px 16px 0 0;
      display: flex;
      flex-direction: column;
      box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);
      animation: slide-up 220ms cubic-bezier(0.32, 0.72, 0, 1);
    }
    .grabber {
      align-self: center;
      width: 36px;
      height: 4px;
      background: var(--ion-color-step-300, rgba(255, 255, 255, 0.25));
      border-radius: 2px;
      margin: 8px 0 4px;
    }
    .sheet-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid var(--ion-color-step-150, rgba(255, 255, 255, 0.08));
    }
    .sheet-title {
      font-size: 1rem;
      font-weight: 600;
      color: var(--ion-text-color, #fff);
    }
    .listo-btn {
      background: none;
      border: 0;
      padding: 4px 8px;
      font-size: 1rem;
      font-weight: 600;
      color: var(--ion-color-primary, #3880ff);
      cursor: pointer;
    }
    /* --- Wheel --- */
    .wheel-shell {
      position: relative;
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .wheel {
      position: relative;
      width: 100%;
      height: 100%;
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
      /* Padding so first / last items can center in the highlight strip.
         Computed from the sheet's inner-half minus one item-half. */
      padding-block: calc(50% - 22px);
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
    .wheel-highlight {
      position: absolute;
      top: 50%;
      left: 16px;
      right: 16px;
      height: 44px;
      transform: translateY(-50%);
      border-top: 1px solid var(--ion-color-step-200, rgba(255, 255, 255, 0.12));
      border-bottom: 1px solid var(--ion-color-step-200, rgba(255, 255, 255, 0.12));
      pointer-events: none;
    }
    @keyframes fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes slide-up {
      from { transform: translateY(100%); }
      to   { transform: translateY(0); }
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

    @if (isOpen()) {
      <div class="backdrop" (click)="cancel()" aria-hidden="true"></div>
      <div class="sheet" role="dialog" aria-label="Elegir descanso">
        <div class="grabber" (click)="cancel()"></div>
        <div class="sheet-header">
          <span class="sheet-title">Descanso</span>
          <button type="button" class="listo-btn" (click)="commit()">Listo</button>
        </div>
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
      </div>
    }
  `,
})
export class RestPickerComponent {
  readonly value = input<number | null>(null);
  readonly valueChange = output<number | null>();

  @ViewChild('wheelEl') private wheelEl?: ElementRef<HTMLDivElement>;

  private static readonly ITEM_HEIGHT = 44;

  protected readonly isOpen = signal(false);
  protected readonly options = REST_OPTIONS;
  /** Value under the highlight strip — updated on scroll. */
  protected readonly draft = signal<number>(0);

  protected readonly label = computed(() => formatRestSeconds(this.value()));

  constructor() {
    addIcons({ 'stopwatch-outline': stopwatchOutline });
    // Seed the draft from the input whenever it changes so re-opening
    // starts at the persisted value.
    effect(() => this.draft.set(this.value() ?? 0));
  }

  protected open(): void {
    this.isOpen.set(true);
    // Wait for the sheet to mount before positioning the wheel.
    queueMicrotask(() => this.jumpToCurrent());
  }

  protected cancel(): void {
    // Backdrop / grabber tap — discard draft, keep prior value.
    this.isOpen.set(false);
  }

  protected commit(): void {
    const s = this.draft();
    this.valueChange.emit(s === 0 ? null : s);
    this.isOpen.set(false);
  }

  private jumpToCurrent(): void {
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

  protected format(s: number): string {
    return formatRestSeconds(s);
  }
}
