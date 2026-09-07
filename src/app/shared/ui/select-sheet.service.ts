import {
  ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Injectable,
  Input, Output, ViewChild, ViewContainerRef, inject,
} from '@angular/core';
import { Overlay, OverlayModule } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { checkmark } from 'ionicons/icons';

export interface SelectSheetOption {
  label: string;
  value: string;
  /** Short glyph (letter/number/emoji) rendered as a colored chip
   *  before the label — mirrors Hevy's set-type picker. Optional. */
  leading?: string;
  /** Ionicon name — takes precedence over `leading` when both are set.
   *  The consumer is responsible for calling addIcons({...}) for the
   *  icon at least once in the app lifetime. */
  leadingIcon?: string;
  /** CSS color for the leading chip / icon. Defaults to text color. */
  leadingColor?: string;
  /** Renders the row in a destructive color (red). Use for actions
   *  like "Eliminar" that don't just pick a value. */
  destructive?: boolean;
}

interface SelectSheetConfig {
  header: string;
  options: SelectSheetOption[];
  /** Value marked with a ✓ when the sheet renders. Pass '' for no default. */
  value: string;
  /** Small grey line under the header — usually the exercise name so
   *  the merchant knows which item they're editing. Optional. */
  subtitle?: string;
}

/**
 * Bottom-sheet single-select (same look as RestPicker's sheet). Used
 * from imperative code — an ActionSheet handler, a menu callback, etc.
 * Returns the picked value via Promise or `null` on backdrop dismiss.
 *
 * App-wide primitive: any feature imports it from @shared/ui — same
 * bottom-sheet look everywhere. Uses CDK Overlay so the portal to
 * document.body escapes transformed ancestors (ion-router-outlet,
 * ion-card) that would otherwise clip a position:fixed sheet.
 *
 * The service + component live in the same file because the component
 * is an implementation detail of the service — no other consumer
 * should import it directly.
 */
@Injectable({ providedIn: 'root' })
export class SelectSheetService {
  private readonly overlay = inject(Overlay);

  open(vcr: ViewContainerRef, config: SelectSheetConfig): Promise<string | null> {
    const overlayRef = this.overlay.create({
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop',
      scrollStrategy: this.overlay.scrollStrategies.block(),
      positionStrategy: this.overlay.position()
          .global().bottom('0').centerHorizontally(),
    });
    const ref = overlayRef.attach(new ComponentPortal(SelectSheetComponent, vcr));
    ref.setInput('header', config.header);
    ref.setInput('subtitle', config.subtitle ?? '');
    ref.setInput('options', config.options);
    ref.setInput('value', config.value);

    return new Promise((resolve) => {
      // Consume the system back gesture: push a history entry so the
      // next back pop closes the sheet instead of navigating the page.
      let historyOwned = true;
      history.pushState({ sheet: 'select' }, '');
      const popHandler = () => {
        historyOwned = false;
        done(null);
      };
      window.addEventListener('popstate', popHandler);

      let closing = false;
      const done = async (v: string | null) => {
        if (closing) return;   // guard against double-fire
        closing = true;
        window.removeEventListener('popstate', popHandler);
        // Detach the CDK backdrop AND kill the overlay pane's pointer
        // events immediately — otherwise the still-present pane
        // (.cdk-overlay-pane has pointer-events: auto by default)
        // eats the tap during the 220ms close animation.
        overlayRef.detachBackdrop();
        overlayRef.overlayElement.style.pointerEvents = 'none';
        // Pop our history entry synchronously so back-stack stays clean.
        if (historyOwned) {
          historyOwned = false;
          history.back();
        }
        await ref.instance.animateClose();
        overlayRef.dispose();
        resolve(v);
      };
      ref.instance.picked.subscribe(v => done(v));
      ref.instance.dismissed.subscribe(() => done(null));
      overlayRef.backdropClick().subscribe(() => done(null));
      // KNOWN BUG (parked): rapid tap on the next ⋮ opener immediately
      // after drag-closing sometimes requires two taps — the first
      // seems to be eaten by something in the CDK stack. Not caused by
      // the history integration (persisted with it removed), not
      // caused by animateClose alone (persisted with dispose-only).
      // Needs deeper investigation. See memory:
      // gym-sheet-double-tap-after-drag-close
    });
  }
}

@Component({
  selector: 'app-select-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OverlayModule, IonIcon],
  styles: [`
    :host { display: block; }
    .sheet {
      background: var(--ion-background-color, #1c1c1e);
      color: var(--ion-text-color, #fff);
      border-radius: 16px 16px 0 0;
      width: min(100vw, 480px);
      box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);
      animation: slide-up 260ms cubic-bezier(0.32, 0.72, 0, 1);
      /* Set by the component when dismissing (backdrop / pick / back
         gesture) OR when a drag past threshold releases — same
         translateY(100%) target, same cubic curve, matched duration. */
      transition: transform 220ms cubic-bezier(0.32, 0.72, 0, 1);
      will-change: transform;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      /* Safe-area for iOS notch / gesture bar. The white-seam issue in
         routine-edit is parked for later — likely tied to the shell's
         bottom nav stacking context, not this padding. */
      padding-bottom: max(env(safe-area-inset-bottom), 20px);
    }
    /* Drag surface — the entire header area (grabber + title + subtitle,
       ending at the first divider). Gives a fat, natural target for
       the swipe-down-to-close gesture. touch-action: none prevents
       Chrome Android from stealing the drag for pull-to-refresh. */
    .drag-zone {
      touch-action: none;
      cursor: grab;
    }
    .drag-zone:active { cursor: grabbing; }
    .grabber {
      display: block;
      align-self: center;
      width: 36px; height: 4px;
      margin: 8px auto 4px;
      background: var(--ion-color-step-300, rgba(255, 255, 255, 0.25));
      border-radius: 2px;
    }
    .sheet-header {
      padding: 18px 20px 16px;
      text-align: center;
      border-bottom: 1px solid var(--ion-color-step-150, rgba(255, 255, 255, 0.08));
    }
    .sheet-title { font-size: 1rem; font-weight: 600; }
    .sheet-subtitle {
      display: block;
      margin-top: 2px;
      font-size: 0.8em;
      color: var(--ion-color-medium, #888);
    }
    .opt {
      display: flex;
      align-items: center;
      padding: 18px 24px;
      font-size: 1rem;
      border-bottom: 1px solid var(--ion-color-step-100, rgba(255, 255, 255, 0.04));
      cursor: pointer;
    }
    .opt:active { background: var(--ion-color-step-100, rgba(255, 255, 255, 0.06)); }
    .opt.destructive { color: var(--ion-color-danger, #eb445a); }
    .opt-leading {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px; height: 24px;
      margin-right: 12px;
      font-weight: 700;
      font-size: 0.95em;
    }
    .opt-leading-ic { font-size: 1.15rem; }
    .opt-label { flex: 1; }
    .opt-check { color: var(--ion-color-primary, #3880ff); font-size: 1.2em; }
    @keyframes slide-up {
      from { transform: translateY(100%); }
      to   { transform: translateY(0); }
    }
  `],
  template: `
    <div #sheetEl class="sheet" role="dialog" [attr.aria-label]="header">
      <!-- Everything above the first divider is one big drag surface. -->
      <div class="drag-zone" (pointerdown)="onGrabberDown($event)">
        <span class="grabber" aria-hidden="true"></span>
        <div class="sheet-header">
          <span class="sheet-title">{{ header }}</span>
          @if (subtitle) {
            <span class="sheet-subtitle">{{ subtitle }}</span>
          }
        </div>
      </div>
      @for (opt of options; track opt.value) {
        <div
          class="opt"
          [class.destructive]="opt.destructive"
          (click)="picked.emit(opt.value)">
          @if (opt.leadingIcon) {
            <ion-icon
              class="opt-leading opt-leading-ic"
              [name]="opt.leadingIcon"
              [style.color]="opt.leadingColor || null"
              aria-hidden="true" />
          } @else if (opt.leading) {
            <span class="opt-leading" [style.color]="opt.leadingColor || null">
              {{ opt.leading }}
            </span>
          }
          <span class="opt-label">{{ opt.label }}</span>
          @if (opt.value === value) {
            <ion-icon class="opt-check" name="checkmark" aria-hidden="true" />
          }
        </div>
      }
    </div>
  `,
})
export class SelectSheetComponent {
  @Input({ required: true }) header!: string;
  @Input({ required: true }) options!: SelectSheetOption[];
  @Input({ required: true }) value!: string;
  @Input() subtitle = '';
  @Output() readonly picked = new EventEmitter<string>();
  /** Emitted when the user drags the sheet past the dismiss threshold.
   *  Service treats it the same as a backdrop click (returns null). */
  @Output() readonly dismissed = new EventEmitter<void>();

  @ViewChild('sheetEl', { static: true }) private sheetEl!: ElementRef<HTMLElement>;

  /** ~30% down = dismiss. Below that spring back. */
  private static readonly DISMISS_PX = 120;
  private dragStartY = 0;
  private dragging = false;

  /**
   * Play the slide-down animation (transform → translateY(100%)) and
   * resolve when the transition ends. Service awaits this before
   * disposing the overlay so close feels as smooth as open.
   */
  animateClose(): Promise<void> {
    const el = this.sheetEl.nativeElement;
    // Kill the open animation so our transition can take over.
    el.style.animation = 'none';
    return new Promise(resolve => {
      const done = () => {
        el.removeEventListener('transitionend', done);
        resolve();
      };
      el.addEventListener('transitionend', done);
      // requestAnimationFrame so the browser has committed the current
      // frame before we mutate the transform — otherwise the transition
      // may be skipped when we set it in the same tick as animation:none.
      requestAnimationFrame(() => {
        el.style.transform = 'translateY(100%)';
      });
      // Safety net if transitionend never fires (browser edge cases).
      setTimeout(done, 400);
    });
  }

  protected onGrabberDown(ev: PointerEvent): void {
    this.dragStartY = ev.clientY;
    this.dragging = true;
    const el = this.sheetEl.nativeElement;
    // Disable both transition + animation while the finger is down so
    // the sheet follows 1:1 with the pointer.
    el.style.animation = 'none';
    el.style.transition = 'none';
    window.addEventListener('pointermove', this.onMove, { passive: true });
    window.addEventListener('pointerup',   this.onUp,   { once: true });
    window.addEventListener('pointercancel', this.onUp, { once: true });
  }

  private readonly onMove = (ev: PointerEvent) => {
    if (!this.dragging) return;
    const dy = Math.max(0, ev.clientY - this.dragStartY);
    this.sheetEl.nativeElement.style.transform = `translateY(${dy}px)`;
  };

  private readonly onUp = (ev: PointerEvent) => {
    this.dragging = false;
    window.removeEventListener('pointermove', this.onMove);
    const el = this.sheetEl.nativeElement;
    // Restore transition so either the spring-back or the dismissal
    // slide animates smoothly from the current dragged position.
    el.style.transition = '';
    const dy = Math.max(0, ev.clientY - this.dragStartY);
    if (dy > SelectSheetComponent.DISMISS_PX) {
      // Past threshold → continue as a close (service handles it).
      this.dismissed.emit();
    } else {
      // Spring back to rest.
      el.style.transform = 'translateY(0)';
    }
  };

  constructor() {
    addIcons({ checkmark });
  }
}
