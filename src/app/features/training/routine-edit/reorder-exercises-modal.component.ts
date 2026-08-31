import { ChangeDetectionStrategy, Component, Input, ViewChild, TemplateRef } from '@angular/core';
import { RoutineEditFormService } from './routine-edit-form.service';
import { RoutineExercise } from '@core/training/routine.model';
import { ReorderModalComponent } from '@shared/ui/reorder-modal.component';
import { ExerciseIconComponent } from '../shared/exercise-icon.component';

/**
 * Thin wrapper around the shared ReorderModalComponent — feeds it the
 * routine-edit form service's exercise list + move/remove operations
 * and passes an <training-exercise-icon> template for the row icons.
 *
 * The RoutineEditFormService is scoped to the parent page and can't be
 * reached via inject() here (ModalController doesn't inherit injectors),
 * so it arrives via `@Input() form`.
 */
@Component({
  selector: 'training-reorder-exercises-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReorderModalComponent, ExerciseIconComponent],
  template: `
    <ng-template #icon let-ex>
      <training-exercise-icon [name]="ex.exerciseName" size="small" />
    </ng-template>

    <app-reorder-modal
      title="Reordenar"
      [items]="itemsFn"
      [labelFn]="labelFn"
      [onMove]="moveFn"
      [onRemove]="removeFn"
      [iconTemplate]="iconTpl" />
  `,
})
export class ReorderExercisesModalComponent {
  @Input({ required: true }) form!: RoutineEditFormService;

  @ViewChild('icon', { static: true }) protected iconTpl!: TemplateRef<{ $implicit: RoutineExercise }>;

  /** Arrow properties so they're bound to `this` — safe to pass as callbacks. */
  protected readonly itemsFn = (): readonly RoutineExercise[] =>
    this.form.draft()?.exercises ?? [];
  protected readonly labelFn = (ex: RoutineExercise): string =>
    ex.exerciseName ?? `Ejercicio #${ex.exerciseId}`;
  protected readonly moveFn = (from: number, to: number): void =>
    this.form.moveExercise(from, to);
  protected readonly removeFn = (index: number): void =>
    this.form.removeExercise(index);
}
