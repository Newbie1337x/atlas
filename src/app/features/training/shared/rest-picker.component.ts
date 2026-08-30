import {
  ChangeDetectionStrategy, Component, ElementRef, TemplateRef, ViewChild, ViewContainerRef,
  computed, effect, inject, input, output, signal,
} from '@angular/core';
import { Overlay, OverlayModule, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { IonItem, IonLabel, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { stopwatchOutline } from 'ionicons/icons';
import { REST_OPTIONS, formatRestSeconds } from './rest-values';

/**
 * Rest-duration picker with a bottom-sheet wheel.
 *
 * Uses CDK Overlay for the sheet: the portal appends to document.body
 * so no transformed ancestor (ion-router-outlet / ion-card use CSS
 * transforms) can clip a position:fixed inside our own template.
 * ion-modal was tried three times and kept getting stuck (`display:none`,
 * `overlay-hidden` stayed, `.present()` hung); ion-picker breaks inside
 * a breakpoint modal on its own. Rolling our own on top of CDK is
 * boring, works, keeps us out of framework quirks.
 *
 * Interaction:
 *   - Tap trigger → sheet slides up from the bottom.
 *   - Backdrop tap / grabber tap → cancel (discard, keep prior value).
 *   - Wheel: CSS scroll-snap. The row snapped to the middle is the
 *     "draft"; it grows + tints on center-hover.
 *   - Listo → emit the draft (0 becomes null) and close.
 *
 * Contract: `value` in (nullable seconds), `valueChange` out. Reusable
 * — session tracker in Slice 4 drops it in for per-set rest overrides.
 */
@Component({
  selector: 'training-rest-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OverlayModule, IonItem, IonLabel, IonIcon],
  styles: [`
    /* --- Bottom sheet (rendered inside a CDK Overlay attached to body) --- */
    .sheet {
      background: var(--ion-background-color, #1c1c1e);
      color: var(--ion-text-color, #fff);
      border-radius: 16px 16px 0 0;
      width: min(100vw, 480px);
      box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);
      animation: slide-up 220ms cubic-bezier(0.32, 0.72, 0, 1);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .grabber {
      align-self: center;
      width: 36px;
      height: 4px;
      background: var(--ion-color-step-300, rgba(255, 255, 255, 0.25));
      border-radius: 2px;
      margin: 8px 0 4px;
      cursor: pointer;
    }
    .sheet-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid var(--ion-color-step-150, rgba(255, 255, 255, 0.08));
    }
    .sheet-title { font-size: 1rem; font-weight: 600; }
    .listo-btn {
      background: none; border: 0; padding: 4px 8px;
      font-size: 1rem; font-weight: 600;
      color: var(--ion-color-primary, #3880ff);
      cursor: pointer;
    }
    /* --- Wheel --- */
    .wheel-shell {
      position: relative;
      height: 264px;                 /* 6 rows × 44px */
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
      padding-block: 110px;          /* (264 - 44) / 2 */
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
      top: 50%; left: 16px; right: 16px;
      height: 44px;
      transform: translateY(-50%);
      border-top: 1px solid var(--ion-color-step-200, rgba(255, 255, 255, 0.12));
      border-bottom: 1px solid var(--ion-color-step-200, rgba(255, 255, 255, 0.12));
      pointer-events: none;
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

    <!-- Rendered inside the CDK Overlay when open() runs. Sits outside
         the component's DOM (attached to document.body) so no transform
         ancestor can clip it. -->
    <ng-template #sheetTpl>
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
    </ng-template>
  `,
})
export class RestPickerComponent {
  readonly value = input<number | null>(null);
  readonly valueChange = output<number | null>();

  private readonly overlay = inject(Overlay);
  private readonly vcr = inject(ViewContainerRef);

  @ViewChild('sheetTpl') private sheetTpl!: TemplateRef<unknown>;
  @ViewChild('wheelEl') private wheelEl?: ElementRef<HTMLDivElement>;

  private static readonly ITEM_HEIGHT = 44;

  private overlayRef: OverlayRef | null = null;

  protected readonly options = REST_OPTIONS;
  /** Value snapped to the center; updated on scroll. */
  protected readonly draft = signal<number>(0);

  protected readonly label = computed(() => formatRestSeconds(this.value()));

  constructor() {
    addIcons({ 'stopwatch-outline': stopwatchOutline });
    // Seed draft from input every time it changes so re-opening starts
    // at the persisted value.
    effect(() => this.draft.set(this.value() ?? 0));
  }

  protected open(): void {
    if (this.overlayRef) return;   // already open
    this.overlayRef = this.overlay.create({
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop',
      scrollStrategy: this.overlay.scrollStrategies.block(),
      positionStrategy: this.overlay.position()
          .global()
          .bottom('0')
          .centerHorizontally(),
    });
    this.overlayRef.attach(new TemplatePortal(this.sheetTpl, this.vcr));
    this.overlayRef.backdropClick().subscribe(() => this.cancel());

    // Position the wheel at the current value after Angular has rendered
    // the template into the overlay.
    requestAnimationFrame(() => requestAnimationFrame(() => this.jumpToCurrent()));
  }

  protected cancel(): void {
    this.dispose();
  }

  protected commit(): void {
    const s = this.draft();
    this.valueChange.emit(s === 0 ? null : s);
    this.dispose();
  }

  private dispose(): void {
    this.overlayRef?.dispose();
    this.overlayRef = null;
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
