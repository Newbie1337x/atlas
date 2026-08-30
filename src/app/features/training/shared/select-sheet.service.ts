import {
  ChangeDetectionStrategy, Component, EventEmitter, Injectable, Input,
  Output, ViewContainerRef, inject,
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
 * Uses CDK Overlay for the same reason the rest picker does: portal to
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
      // Position the wrapper 100px BELOW the viewport bottom so the
      // sheet bleeds past Chrome Android's dynamic URL bar / gesture
      // area — otherwise a white strip peeks through under the sheet
      // when the layout viewport is shorter than the visual viewport.
      // The sheet's own padding-bottom compensates so content stays
      // visually inside the safe area.
      positionStrategy: this.overlay.position()
          .global().bottom('-100px').centerHorizontally(),
    });
    const ref = overlayRef.attach(new ComponentPortal(SelectSheetComponent, vcr));
    ref.setInput('header', config.header);
    ref.setInput('subtitle', config.subtitle ?? '');
    ref.setInput('options', config.options);
    ref.setInput('value', config.value);

    return new Promise((resolve) => {
      const done = (v: string | null) => {
        overlayRef.dispose();
        resolve(v);
      };
      ref.instance.picked.subscribe(v => done(v));
      overlayRef.backdropClick().subscribe(() => done(null));
    });
  }
}

@Component({
  selector: 'training-select-sheet',
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
      animation: slide-up 220ms cubic-bezier(0.32, 0.72, 0, 1);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      /* The CDK positionStrategy sits the wrapper 100px below the
         viewport so the sheet's dark background always covers any
         URL-bar / gesture gap Chrome Android leaves under the sheet.
         Compensate with extra bottom padding so the last option
         still ends inside the safe area. */
      padding-bottom: calc(max(env(safe-area-inset-bottom), 20px) + 100px);
    }
    .grabber {
      align-self: center;
      width: 36px; height: 4px;
      background: var(--ion-color-step-300, rgba(255, 255, 255, 0.25));
      border-radius: 2px;
      margin: 8px 0 4px;
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
    <div class="sheet" role="dialog" [attr.aria-label]="header">
      <div class="grabber"></div>
      <div class="sheet-header">
        <span class="sheet-title">{{ header }}</span>
        @if (subtitle) {
          <span class="sheet-subtitle">{{ subtitle }}</span>
        }
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

  constructor() {
    addIcons({ checkmark });
  }
}
