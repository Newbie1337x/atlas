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
}

interface SelectSheetConfig {
  header: string;
  options: SelectSheetOption[];
  /** Value marked with a ✓ when the sheet renders. Pass '' for no default. */
  value: string;
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
      positionStrategy: this.overlay.position()
          .global().bottom('0').centerHorizontally(),
    });
    const ref = overlayRef.attach(new ComponentPortal(SelectSheetComponent, vcr));
    ref.setInput('header', config.header);
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
    }
    .grabber {
      align-self: center;
      width: 36px; height: 4px;
      background: var(--ion-color-step-300, rgba(255, 255, 255, 0.25));
      border-radius: 2px;
      margin: 8px 0 4px;
    }
    .sheet-header {
      padding: 12px 16px;
      font-size: 1rem;
      font-weight: 600;
      text-align: center;
      border-bottom: 1px solid var(--ion-color-step-150, rgba(255, 255, 255, 0.08));
    }
    .opt {
      display: flex;
      align-items: center;
      padding: 14px 20px;
      font-size: 1rem;
      border-bottom: 1px solid var(--ion-color-step-100, rgba(255, 255, 255, 0.04));
      cursor: pointer;
    }
    .opt:last-child { border-bottom: 0; }
    .opt:active { background: var(--ion-color-step-100, rgba(255, 255, 255, 0.06)); }
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
      <div class="sheet-header">{{ header }}</div>
      @for (opt of options; track opt.value) {
        <div class="opt" (click)="picked.emit(opt.value)">
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
  @Output() readonly picked = new EventEmitter<string>();

  constructor() {
    addIcons({ checkmark });
  }
}
