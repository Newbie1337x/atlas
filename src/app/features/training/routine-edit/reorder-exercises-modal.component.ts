import { ChangeDetectionStrategy, Component, ViewChild, TemplateRef, computed, input } from '@angular/core';
import { RoutineEditFormService } from './routine-edit-form.service';
import { RoutineExercise } from '@core/training/routine.model';
import { ReorderModalComponent } from '@shared/ui/reorder-modal.component';
import { ExerciseIconComponent } from '../shared/exercise-icon.component';

/**
 * Thin wrapper around the shared ReorderModalComponent — feeds it the
 * routine-edit form service's exercise list + move/remove operations
 * and passes an <app-training-exercise-icon> template for the row icons.
 *
 * The RoutineEditFormService is scoped to the parent page and can't be
 * reached via inject() here (ModalController doesn't inherit injectors),
 * so it arrives via `@Input() form`.
 */
@Component({
  selector: 'app-training-reorder-exercises-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReorderModalComponent, ExerciseIconComponent],
  template: `
    <ng-template #icon let-ex>
      <app-training-exercise-icon [name]="ex.exerciseName" size="small" />
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
  /** Signal input (not classic @Input) so the computed below can read it
   *  reactively. Classic @Input on this component was undefined at the
   *  moment `computed(...)` ran its factory for the first time — if the
   *  first evaluation happened before ModalController's componentProps
   *  assignment, the computed captured zero dependencies (short-circuit
   *  on `undefined?.draft()`) and never re-ran, so the modal opened
   *  with a snapshot missing whichever exercise landed last. Signal
   *  inputs are set via ComponentRef.setInput, which Ionic 8 wires
   *  through for componentProps, and their read registers a dep the
   *  computed can invalidate on. */
  readonly form = input.required<RoutineEditFormService>();

  @ViewChild('icon', { static: true }) protected iconTpl!: TemplateRef<{ $implicit: RoutineExercise }>;

  protected readonly itemsFn = computed<readonly RoutineExercise[]>(
    () => this.form().draft()?.exercises ?? []);
  protected readonly labelFn = (ex: RoutineExercise): string =>
    ex.exerciseName ?? `Ejercicio #${ex.exerciseId}`;
  protected readonly moveFn = (from: number, to: number): void =>
    this.form().moveExercise(from, to);
  protected readonly removeFn = (index: number): void =>
    this.form().removeExercise(index);
}
