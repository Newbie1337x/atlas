import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonIcon, IonInput } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { checkmarkOutline } from 'ionicons/icons';
import { WorkoutSet } from '@core/training/workout.model';

/**
 * One set row in the tracker. Layout:
 *   [Serie] [Anterior]? [Kg] [Reps] [ ✓ ]
 *
 * "Anterior" (previous session's actual) is a Slice B feature — Slice A
 * shows the routine target as the placeholder in the actual input so
 * the user has a visible reference for what they're chasing.
 *
 * Checking off the row triggers `checkChange` on the parent, which
 * mutates the set via the session form service (autofills empty
 * actuals from targets on the way in — see toggleSetCompleted).
 */
@Component({
  selector: 'app-training-session-set-row',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IonInput, IonIcon],
  styles: [`
    :host {
      display: grid;
      gap: 6px;
      align-items: center;
      padding: 6px 0;
      grid-template-columns: 32px 1fr 1fr 40px;
    }
    :host.completed {
      background: var(--ion-color-success-tint, #e6f9ec);
    }
    .serie {
      text-align: center;
      font-weight: 600;
      font-size: 0.9rem;
      color: var(--ion-color-primary, #3880ff);
    }
    ion-input {
      --padding-start: 6px;
      --padding-end: 6px;
      --background: var(--ion-color-step-50, #f6f6f6);
      border-radius: 6px;
      font-size: 0.95rem;
      text-align: center;
    }
    .check-btn {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      border: 1px solid var(--ion-color-step-300, #ccc);
      background: transparent;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: var(--ion-color-medium, #888);
    }
    .check-btn.on {
      background: var(--ion-color-success, #2dd36f);
      border-color: var(--ion-color-success, #2dd36f);
      color: #fff;
    }
  `],
  template: `
    <span class="serie">{{ set().orderIndex + 1 }}</span>

    <ion-input
      type="number"
      inputmode="decimal"
      [placeholder]="targetWeight()"
      aria-label="Kilos"
      [ngModel]="set().weightKg"
      (ngModelChange)="patchWeight($event)" />

    <ion-input
      type="number"
      inputmode="numeric"
      [placeholder]="targetReps()"
      aria-label="Repeticiones"
      [ngModel]="set().reps"
      (ngModelChange)="patchReps($event)" />

    <button
      type="button"
      class="check-btn"
      [class.on]="set().completed"
      [attr.aria-pressed]="set().completed"
      (click)="checkChange.emit()">
      <ion-icon name="checkmark-outline" aria-hidden="true" />
    </button>
  `,
})
export class SessionSetRowComponent {
  readonly set = input.required<WorkoutSet>();
  readonly checkChange = output<void>();
  readonly patchSet = output<Partial<WorkoutSet>>();

  constructor() {
    addIcons({ 'checkmark-outline': checkmarkOutline });
  }

  protected readonly targetWeight = computed(() => {
    const t = this.set().targetWeightKg;
    return t == null ? 'kg' : String(t);
  });
  protected readonly targetReps = computed(() => {
    const t = this.set().targetReps;
    return t == null ? 'reps' : String(t);
  });

  protected patchReps(value: number | null): void {
    this.patchSet.emit({ reps: value });
  }
  protected patchWeight(value: number | null): void {
    this.patchSet.emit({ weightKg: value });
  }
}
