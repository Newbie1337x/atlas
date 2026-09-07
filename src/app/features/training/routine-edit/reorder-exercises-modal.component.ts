import { ChangeDetectionStrategy, Component, Input, OnInit, ViewChild, TemplateRef, computed, signal } from '@angular/core';
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
export class ReorderExercisesModalComponent implements OnInit {
  /** Assigned by ModalController.componentProps as a plain property write.
   *  Signal inputs would be cleaner but Ionic's overlay controller does
   *  not route componentProps through ComponentRef.setInput, so the
   *  signal never receives the value and reads throw. Classic @Input +
   *  ngOnInit mirror is the reliable path. */
  @Input({ required: true }) form!: RoutineEditFormService;

  /** Mirror of the form input, seeded in ngOnInit so any `computed()`
   *  that depends on the service becomes reactive once the input lands.
   *  Reading `this.form` directly inside a class-field `computed(...)`
   *  observed `undefined` before ModalController assigned it, captured
   *  zero deps, and never re-ran — the modal opened with a stale/empty
   *  list forever. */
  private readonly formSignal = signal<RoutineEditFormService | null>(null);

  @ViewChild('icon', { static: true }) protected iconTpl!: TemplateRef<{ $implicit: RoutineExercise }>;

  protected readonly itemsFn = computed<readonly RoutineExercise[]>(
    () => this.formSignal()?.draft()?.exercises ?? []);
  protected readonly labelFn = (ex: RoutineExercise): string =>
    ex.exerciseName ?? `Ejercicio #${ex.exerciseId}`;
  protected readonly moveFn = (from: number, to: number): void =>
    this.form.moveExercise(from, to);
  protected readonly removeFn = (index: number): void =>
    this.form.removeExercise(index);

  ngOnInit(): void {
    this.formSignal.set(this.form);
  }
}
