import {
  ChangeDetectionStrategy, Component, ElementRef, ViewChild,
  computed, effect, input, output, signal,
} from '@angular/core';
import {
  IonItem, IonLabel, IonIcon,
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { stopwatchOutline } from 'ionicons/icons';
import { REST_OPTIONS, formatRestSeconds } from './rest-values';

/**
 * Rest-duration picker: trigger row + bottom-sheet with a CSS scroll-snap
 * wheel.
 *
 * Uses ion-modal for the sheet because ion-modal automatically portals
 * itself to document.body — a custom `position: fixed` div was getting
 * clipped by a transformed ancestor (ion-router-outlet / ion-card use
 * transforms, which create a containing block for `position: fixed`
 * descendants). ion-picker was skipped this time — it does not render
 * inside a breakpoint modal in Ionic 9; a plain CSS wheel behaves
 * identically without fighting the framework.
 *
 * Contract: `value` in (nullable seconds), `valueChange` out (0 emitted
 * as null). Reusable — the session tracker in Slice 4 drops it in for
 * per-set rest overrides.
 */
@Component({
  selector: 'training-rest-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonItem, IonLabel, IonIcon,
    IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent,
  ],
  styles: [`
    /* Sheet sizing. ion-modal supports --height on the shadow host. */
    ion-modal {
      --height: auto;
      --border-radius: 16px 16px 0 0;
    }
    /* Wheel geometry — 6 rows × 44px so we get 3 above + selected + 2 below. */
    .wheel-shell {
      position: relative;
      height: 264px;
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
      /* (264 wheel - 44 item) / 2 = 110px so first/last items can center. */
      padding-block: 110px;
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
  `],
  template: `
    <ion-item button [detail]="false" (click)="isOpen.set(true)">
      <ion-icon slot="start" name="stopwatch-outline" aria-hidden="true" />
      <ion-label>
        <h3>Descanso</h3>
        <p>{{ label() }}</p>
      </ion-label>
    </ion-item>

    <ion-modal
      [isOpen]="isOpen()"
      [initialBreakpoint]="0.55"
      [breakpoints]="[0, 0.55]"
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
        <ion-content class="ion-no-padding">
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
        </ion-content>
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
  /** Value snapped to the center — updated on scroll. */
  protected readonly draft = signal<number>(0);

  protected readonly label = computed(() => formatRestSeconds(this.value()));

  constructor() {
    addIcons({ 'stopwatch-outline': stopwatchOutline });
    // Seed draft from input every time it changes so re-opening starts
    // at the persisted value.
    effect(() => this.draft.set(this.value() ?? 0));
  }

  protected onPresented(): void {
    // ion-modal has fully mounted the ng-template by the time this fires.
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
