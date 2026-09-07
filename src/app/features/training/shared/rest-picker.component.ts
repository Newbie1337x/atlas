import {
  ChangeDetectionStrategy, Component, ElementRef, TemplateRef, ViewChild, ViewContainerRef,
  computed, effect, inject, input, output, signal,
} from '@angular/core';
import { Overlay, OverlayModule, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { IonItem, IonLabel, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { stopwatchOutline } from 'ionicons/icons';
import { RoutineSet } from '@core/training/routine.model';
import { REST_OPTIONS, formatRestSeconds } from './rest-values';

/**
 * Rest-duration picker with a bottom-sheet wheel.
 *
 * Two open modes on the SAME sheet:
 *   - Tap on the row       → simple picker editing the exercise-wide default
 *                            (existing behavior, novices never see anything else).
 *   - Long-press on the row → same sheet with a tab strip [Global] [S1] [S2] …
 *                            above the wheel; each set tab edits its own
 *                            `restSecondsAfter` override + shows a "Usar el
 *                            global" pill that re-nulls the override.
 *
 * When any set has an override (restSecondsAfter != null) the row shows a
 * tiny dot next to the label so the user knows there's something custom
 * underneath without opening anything.
 *
 * The sheet lives in a CDK Overlay so the portal escapes any transformed
 * ancestor. Wheel is CSS scroll-snap; the row centered under the highlight
 * bar is the draft; Listo emits, backdrop tap cancels.
 */
@Component({
  selector: 'app-training-rest-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OverlayModule, IonItem, IonLabel, IonIcon],
  styleUrl: './rest-picker.component.css',
  template: `
    <ion-item
      button [detail]="false"
      (click)="onRowClick()"
      (pointerdown)="onRowPointerDown($event)"
      (pointerup)="cancelLongPress()"
      (pointercancel)="cancelLongPress()"
      (pointerleave)="cancelLongPress()"
      (pointermove)="onRowPointerMove($event)">
      <ion-icon slot="start" name="stopwatch-outline" aria-hidden="true" />
      <ion-label>
        <h3>
          Descanso
          @if (hasOverrides()) {
            <span class="override-dot" aria-label="Algún set tiene descanso personalizado"></span>
          }
        </h3>
        <p>{{ label() }}</p>
      </ion-label>
    </ion-item>

    <ng-template #sheetTpl>
      <div class="sheet" role="dialog" aria-label="Elegir descanso">
        <div class="grabber" (click)="cancel()"></div>
        <div class="sheet-header">
          <span class="sheet-title">Descanso</span>
          @if (subtitle()) {
            <span class="sheet-subtitle">{{ subtitle() }}</span>
          }
          <button type="button" class="listo-btn" (click)="commit()">Listo</button>
        </div>

        @if (expandedOpen()) {
          <div class="tabs" role="tablist">
            <button
              type="button" role="tab" class="tab"
              [class.active]="activeTab() === -1"
              (click)="switchTab(-1)">Global</button>
            @for (s of sets() ?? []; track $index) {
              <button
                type="button" role="tab" class="tab"
                [class.active]="activeTab() === $index"
                (click)="switchTab($index)">
                S{{ $index + 1 }}
                @if (s.restSecondsAfter != null) {
                  <span class="tab-dot" aria-hidden="true"></span>
                }
              </button>
            }
          </div>
        }

        <div class="wheel-shell">
          <!-- Base layer: scrollable, uniform grey items. -->
          <div #wheelEl class="wheel" (scroll)="onScroll()">
            <div class="wheel-inner">
              @for (opt of options; track opt) {
                <div class="wheel-item">{{ format(opt) }}</div>
              }
            </div>
          </div>
          <!-- Lens layer: fixed 44px window at the exact center, contains
               the same list styled big+white. Its inner is translated in
               sync with the base scroll (native style write in onScroll,
               no CD lag) so whatever passes under the window looks big
               without any per-item state. Highlight border draws on top. -->
          <div class="wheel-lens" aria-hidden="true">
            <div #lensInnerEl class="wheel-inner wheel-inner-lens">
              @for (opt of options; track opt) {
                <div class="wheel-item wheel-item-lens">{{ format(opt) }}</div>
              }
            </div>
          </div>
          <div class="wheel-highlight" aria-hidden="true"></div>
        </div>

        @if (expandedOpen() && activeTab() !== -1) {
          <div class="use-global-row">
            <button type="button" class="use-global-pill" (click)="useGlobal()">
              Usar el global ({{ label() }})
            </button>
          </div>
        }
      </div>
    </ng-template>
  `,
})
export class RestPickerComponent {
  readonly value = input<number | null>(null);
  /** Rendered as a grey line under the "Descanso" title — usually the
   *  exercise name so the merchant sees which item they're editing. */
  readonly subtitle = input<string>('');
  /** When present, long-press on the row opens the expanded sheet with a
   *  per-set tab strip. Tap keeps editing the global (existing UX). */
  readonly sets = input<RoutineSet[] | null>(null);
  readonly valueChange = output<number | null>();
  /** Emitted when a specific set's override is committed from a per-set tab. */
  readonly setRestChange = output<{ index: number; value: number | null }>();

  private readonly overlay = inject(Overlay);
  private readonly vcr = inject(ViewContainerRef);

  @ViewChild('sheetTpl') private sheetTpl!: TemplateRef<unknown>;
  @ViewChild('wheelEl') private wheelEl?: ElementRef<HTMLDivElement>;
  @ViewChild('lensInnerEl') private lensInnerEl?: ElementRef<HTMLDivElement>;

  private static readonly ITEM_HEIGHT = 44;
  private static readonly LONG_PRESS_MS = 500;
  private static readonly LONG_PRESS_SLOP_PX = 8;

  private overlayRef: OverlayRef | null = null;

  protected readonly options = REST_OPTIONS;
  /** Value snapped to the center; updated on scroll. */
  protected readonly draft = signal<number>(0);
  /** -1 = global tab (or simple mode). 0..n-1 = per-set tab. */
  protected readonly activeTab = signal<number>(-1);
  /** True when the sheet was opened via long-press (expanded UI on). */
  protected readonly expandedOpen = signal<boolean>(false);

  protected readonly label = computed(() => formatRestSeconds(this.value()));
  protected readonly hasOverrides = computed(() =>
    (this.sets() ?? []).some(s => s.restSecondsAfter != null));

  constructor() {
    addIcons({ 'stopwatch-outline': stopwatchOutline });
    // Seed draft from input every time it changes so re-opening the simple
    // picker starts at the persisted global value.
    effect(() => this.draft.set(this.value() ?? 0));
  }

  /** Set to true while we own a pushed history entry — Android's back
   *  gesture / browser back pops it and closes the sheet instead of
   *  navigating the page. Cleared when we pop it ourselves in dispose. */
  private historyPushed = false;
  private readonly popHandler = () => {
    this.historyPushed = false;
    window.removeEventListener('popstate', this.popHandler);
    this.dispose();
  };

  // ---------- Long-press vs tap disambiguation ----------

  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private longPressStart: { x: number; y: number } | null = null;
  private longPressFired = false;

  protected onRowPointerDown(ev: PointerEvent): void {
    this.longPressFired = false;
    this.longPressStart = { x: ev.clientX, y: ev.clientY };
    // Long-press only lights up when there are sets to edit — otherwise
    // it's a no-op (parents that don't pass `sets` get the old UX).
    if (!this.sets()?.length) return;
    this.longPressTimer = setTimeout(() => {
      this.longPressTimer = null;
      this.longPressFired = true;
      this.open(true);
    }, RestPickerComponent.LONG_PRESS_MS);
  }

  protected onRowPointerMove(ev: PointerEvent): void {
    if (!this.longPressStart) return;
    const dx = ev.clientX - this.longPressStart.x;
    const dy = ev.clientY - this.longPressStart.y;
    if (dx * dx + dy * dy > RestPickerComponent.LONG_PRESS_SLOP_PX ** 2) {
      this.cancelLongPress();
    }
  }

  protected cancelLongPress(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    this.longPressStart = null;
  }

  /** Tap handler — falls through to `open(false)` only if long-press did
   *  not fire, so a hold that already opened the expanded sheet does not
   *  re-open the simple one on release. */
  protected onRowClick(): void {
    if (this.longPressFired) {
      this.longPressFired = false;
      return;
    }
    this.open(false);
  }

  // ---------- Sheet open / commit ----------

  protected open(expanded: boolean): void {
    if (this.overlayRef) return;   // already open
    this.expandedOpen.set(expanded);
    this.activeTab.set(-1);
    this.draft.set(this.value() ?? 0);

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

    history.pushState({ sheet: 'rest' }, '');
    this.historyPushed = true;
    window.addEventListener('popstate', this.popHandler);

    requestAnimationFrame(() => requestAnimationFrame(() => this.jumpToCurrent()));
  }

  protected cancel(): void {
    this.dispose();
  }

  /** Switch the active tab in expanded mode. Global tab shows the exercise
   *  default; per-set tabs seed from that set's override (or the global if
   *  null, since that's what applies today). */
  protected switchTab(idx: number): void {
    this.activeTab.set(idx);
    const seed = idx === -1
      ? (this.value() ?? 0)
      : (this.sets()?.[idx]?.restSecondsAfter ?? this.value() ?? 0);
    this.draft.set(seed);
    requestAnimationFrame(() => this.jumpToCurrent());
  }

  /** Per-set tab shortcut: null out the override and close. */
  protected useGlobal(): void {
    const idx = this.activeTab();
    if (idx === -1) return;
    this.setRestChange.emit({ index: idx, value: null });
    this.dispose();
  }

  protected commit(): void {
    const s = this.draft();
    const idx = this.activeTab();
    if (idx === -1) {
      this.valueChange.emit(s === 0 ? null : s);
    } else {
      // Sticky: even if the value equals the global at commit time, we
      // persist it as a number so future global edits do not cascade.
      // User un-hooks explicitly via the "Usar el global" pill.
      this.setRestChange.emit({ index: idx, value: s === 0 ? null : s });
    }
    this.dispose();
  }

  private dispose(): void {
    this.overlayRef?.dispose();
    this.overlayRef = null;
    this.expandedOpen.set(false);
    this.activeTab.set(-1);
    if (this.historyPushed) {
      this.historyPushed = false;
      window.removeEventListener('popstate', this.popHandler);
      history.back();
    }
  }

  private jumpToCurrent(): void {
    const el = this.wheelEl?.nativeElement;
    if (!el) return;
    const idx = Math.max(0, this.options.indexOf(this.draft()));
    const top = idx * RestPickerComponent.ITEM_HEIGHT;
    el.scrollTop = top;
    // Programmatic scroll may not fire a scroll event on some engines;
    // sync the lens directly so the initial paint is correct.
    const lens = this.lensInnerEl?.nativeElement;
    if (lens) lens.style.transform = `translateY(${-top}px)`;
  }

  private snapTimer: ReturnType<typeof setTimeout> | null = null;

  protected onScroll(): void {
    const el = this.wheelEl?.nativeElement;
    if (!el) return;
    // Mirror scroll into the lens layer via a direct DOM write — signal-
    // based binding introduces a CD-frame delay that visibly shimmers on
    // fast flings; the native write happens in the same event loop tick
    // as the browser's own scroll paint.
    const lens = this.lensInnerEl?.nativeElement;
    if (lens) lens.style.transform = `translateY(${-el.scrollTop}px)`;

    const idx = Math.round(el.scrollTop / RestPickerComponent.ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(this.options.length - 1, idx));
    const val = this.options[clamped];
    if (val !== this.draft()) this.draft.set(val);

    // Debounced snap-to-nearest after inertia settles. 120ms is enough that
    // rapid flings keep flowing but a released finger snaps cleanly.
    if (this.snapTimer) clearTimeout(this.snapTimer);
    this.snapTimer = setTimeout(() => {
      this.snapTimer = null;
      const target = clamped * RestPickerComponent.ITEM_HEIGHT;
      if (Math.abs(el.scrollTop - target) > 0.5) {
        el.scrollTo({ top: target, behavior: 'smooth' });
      }
    }, 120);
  }

  protected format(s: number): string {
    return formatRestSeconds(s);
  }
}
