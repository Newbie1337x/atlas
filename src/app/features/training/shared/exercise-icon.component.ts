import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { barbellOutline } from 'ionicons/icons';

/**
 * Placeholder visual for an exercise. The seeded catalog does not ship
 * with demo images (Gym Visual license is paid — see docs/dev-seed
 * note). Until we license real media (or generate it), every place that
 * would show a thumbnail renders this tinted circle with a barbell
 * icon plus, optionally, the first-letter initial of the exercise name
 * so cards do not all look identical.
 *
 * When demo_media_url starts being populated, this component can accept
 * a src input and render an <img> instead — consumers do not need to
 * change.
 */
@Component({
  selector: 'app-training-exercise-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon],
  styles: [`
    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      position: relative;
      background: var(--ion-color-step-100, #eef2f7);
      color: var(--ion-color-primary, #3b82f6);
      border-radius: 50%;
      flex-shrink: 0;
      font-weight: 600;
    }
    .badge.small  { width: 32px; height: 32px; font-size: 12px; }
    .badge.medium { width: 44px; height: 44px; font-size: 14px; }
    .badge.large  { width: 64px; height: 64px; font-size: 20px; }
    .initial {
      position: absolute;
      right: -2px; bottom: -2px;
      width: 18px; height: 18px;
      border-radius: 50%;
      background: var(--ion-color-primary, #3b82f6);
      color: var(--ion-color-primary-contrast, #fff);
      font-size: 10px;
      display: flex; align-items: center; justify-content: center;
      line-height: 1;
    }
  `],
  template: `
    <span class="badge" [class]="'badge ' + size()" [attr.aria-label]="ariaLabel()">
      <ion-icon name="barbell-outline" aria-hidden="true" />
      @if (initial(); as ini) {
        <span class="initial" aria-hidden="true">{{ ini }}</span>
      }
    </span>
  `,
})
export class ExerciseIconComponent {
  readonly name = input<string | null>(null);
  readonly size = input<'small' | 'medium' | 'large'>('medium');

  constructor() {
    addIcons({ 'barbell-outline': barbellOutline });
  }

  protected readonly initial = computed(() => {
    const n = this.name();
    if (!n) return null;
    const first = n.trim().charAt(0);
    return first ? first.toUpperCase() : null;
  });

  protected readonly ariaLabel = computed(() => this.name() ?? 'Ejercicio');
}
