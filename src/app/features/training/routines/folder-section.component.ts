import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { IonList, IonListHeader, IonLabel, IonNote, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chevronDown, chevronForward } from 'ionicons/icons';
import { RoutineSummary } from '@core/training/training.model';
import { RoutineCardComponent } from './routine-card.component';

/**
 * One folder + the routines it holds. The "loose" bucket (folderId=null)
 * uses the frontend-only label "Mis rutinas" and never renders when empty —
 * that decision lives in the parent page.
 *
 * Collapsible via signal — click the header to toggle. State is
 * per-component instance and does NOT persist across navigations yet;
 * localStorage-backed remembering lands with the mutations slice when we
 * have folder ids to key by (loose bucket keys on 'loose').
 *
 * No rename / delete controls yet — those land with the mutations slice.
 */
@Component({
  selector: 'training-folder-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonList, IonListHeader, IonLabel, IonNote, IonIcon, RoutineCardComponent],
  styles: [`
    .folder-header {
      cursor: pointer;
      user-select: none;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .folder-header:hover {
      opacity: 0.75;
    }
    .count-badge {
      font-size: 0.85em;
      color: var(--ion-color-medium, #666);
      font-weight: normal;
    }
  `],
  template: `
    <ion-list>
      <ion-list-header class="folder-header" (click)="toggle()" role="button" [attr.aria-expanded]="!collapsed()">
        <ion-icon [name]="collapsed() ? 'chevron-forward' : 'chevron-down'" aria-hidden="true" />
        <ion-label>
          <h2>
            {{ label() }}
            <span class="count-badge">({{ routines().length }})</span>
          </h2>
        </ion-label>
      </ion-list-header>

      @if (!collapsed()) {
        @if (routines().length === 0) {
          <ion-note class="ion-padding-start">Carpeta vacía</ion-note>
        } @else {
          @for (r of routines(); track r.id) {
            <training-routine-card [routine]="r" />
          }
        }
      }
    </ion-list>
  `,
})
export class FolderSectionComponent {
  readonly label = input.required<string>();
  readonly routines = input.required<readonly RoutineSummary[]>();

  protected readonly collapsed = signal(false);

  constructor() {
    addIcons({ 'chevron-down': chevronDown, 'chevron-forward': chevronForward });
  }

  protected toggle(): void {
    this.collapsed.update(c => !c);
  }
}
