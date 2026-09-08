import {
  ChangeDetectionStrategy, Component, ViewContainerRef,
  computed, effect, inject, input, output, signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonButton, IonIcon, IonTextarea,
  AlertController, ModalController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  addOutline, caretDown, ellipsisVertical,
  repeatOutline, resizeOutline, reorderThreeOutline, swapHorizontalOutline,
  linkOutline, speedometerOutline, trashOutline,
} from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { injectQuery } from '@tanstack/angular-query-experimental';
import {
  ExerciseCapabilities, PERMISSIVE_CAPS, RepsMode, RoutineExercise, RoutineSet,
} from '@core/training/routine.model';
import { PersonalRecord } from '@core/training/personal-record.model';
import { PreviousSet } from '@core/training/workout-prepare.model';
import { isPersonalRecord } from '../session/is-personal-record';
import { InputMode } from '@core/training/exercise.model';
import { TrainingActionsService } from '@core/training/training-actions.service';
import { TrainingApi } from '@core/training/training.api';
import { trainingKeys } from '@core/training/training.keys';
import { RoutineEditFormService } from './routine-edit-form.service';
import { SetEditorComponent } from './set-editor.component';
import { WeightModePickerService } from '../shared/weight-mode-picker.service';
import { ExerciseIconComponent } from '../shared/exercise-icon.component';
import { RestPickerComponent } from '../shared/rest-picker.component';
import { SelectSheetService } from '@shared/ui/select-sheet.service';
import { ReorderModalComponent } from '@shared/ui/reorder-modal.component';
import { ExercisePickerComponent } from './exercise-picker.component';

/**
 * One exercise inside the routine editor. Header shows the name + a single
 * ellipsis (⋮) button that opens an ActionSheet with every per-exercise
 * action: reorder — replace — superset — delete. The old
 * inline drag handle + trash icon were removed because on a phone the
 * small tap targets competed with the tap-to-edit affordance of the card.
 *
 * Delegates every mutation to the form service by index. Never mutates
 * the exercise input directly.
 */
@Component({
  selector: 'app-training-exercise-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonButton, IonIcon, IonTextarea,
    SetEditorComponent, ExerciseIconComponent, RestPickerComponent,
  ],
  styleUrl: './exercise-editor.component.css',
  template: `
    <ion-card [class.superset]="!!supersetLetter()">
      <ion-card-header>
        <!-- Header doubles as long-press target for the actions menu.
             Interactive children (the ⋮ button) still get their own tap
             because we only fire from the div's pointer stream and cancel
             on movement / early release. -->
        <div
          class="header"
          (pointerdown)="onHeaderPointerDown($event)"
          (pointerup)="cancelLongPress()"
          (pointercancel)="cancelLongPress()"
          (pointerleave)="cancelLongPress()"
          (pointermove)="onHeaderPointerMove($event)">
          <app-training-exercise-icon [name]="exercise().exerciseName" size="small" />
          <ion-card-title>
            @if (supersetLetter(); as letter) {
              <span class="superset-badge" [attr.aria-label]="'Superserie ' + letter">{{ letter }}</span>
            }
            {{ (index() + 1) + '. ' + (exercise().exerciseName ?? 'Ejercicio #' + exercise().exerciseId) }}
          </ion-card-title>
          <ion-button fill="clear" size="small" (click)="openMenu()" aria-label="Opciones del ejercicio">
            <ion-icon slot="icon-only" name="ellipsis-vertical" />
          </ion-button>
        </div>
      </ion-card-header>

      <ion-card-content>
        <ion-textarea
          class="notes-input"
          placeholder="Agregar notas de rutina aquí"
          [autoGrow]="true"
          [rows]="1"
          [ngModel]="exercise().notes"
          (ngModelChange)="form.updateExerciseNotes(index(), $event)" />

        <app-training-rest-picker
          [value]="exercise().restSeconds"
          [subtitle]="exerciseName()"
          [sets]="exercise().sets"
          (valueChange)="form.updateExerciseRest(index(), $event)"
          (setRestChange)="form.updateSet(index(), $event.index, { restSecondsAfter: $event.value })" />

        <div class="header-legend" [style.grid-template-columns]="gridTemplate()">
          <span>Serie</span>
          @if (showCheck()) { <span>Anterior</span> }
          @if (caps().weight) {
            @if (caps().bricks) {
              <span class="weight-header" (click)="openWeightModeSheet()">
                {{ weightHeaderLabel() }}
                <ion-icon name="caret-down" aria-hidden="true" />
              </span>
            } @else {
              <span>Kg</span>
            }
          }
          @if (caps().reps) {
            @if (showCheck()) {
              <!-- Session mode: label only, no picker — the reps
                   template lives in the editor, not the tracker. -->
              <span>Reps</span>
            } @else {
              <span class="reps-header" (click)="openRepsOptions()">
                {{ repsMode() === 'RANGE' ? 'Rango de reps' : 'Reps' }}
                <ion-icon name="caret-down" aria-hidden="true" />
              </span>
            }
          }
          @if (caps().duration && !caps().reps) { <span>Tiempo</span> }
          @if (showRpe() && caps().rpe) { <span>RPE</span> }
          @if (showCheck()) { <span></span> }
        </div>

        @for (s of exercise().sets; track $index) {
          <app-training-set-editor
            [set]="s"
            [index]="$index"
            [workingOrdinal]="workingOrdinals()[$index]"
            [exerciseName]="exerciseName()"
            [repsMode]="repsMode()"
            [showRpe]="showRpe()"
            [showCheck]="showCheck()"
            [isPr]="isPr(s)"
            [previousSet]="previousFor($index)"
            [capabilities]="caps()"
            [inputMode]="inputMode()"
            [brickWeightKg]="brickWeight()"
            (patchSet)="form.updateSet(index(), $index, $event)"
            (remove)="form.removeSet(index(), $index)"
            (checkChange)="checkSet.emit($index)" />
        }

        <ion-button expand="block" fill="outline" size="small" (click)="form.addSet(index())">
          <ion-icon slot="start" name="add-outline" />
          Agregar serie
        </ion-button>
      </ion-card-content>
    </ion-card>
  `,
})
export class ExerciseEditorComponent {
  readonly exercise = input.required<RoutineExercise>();
  readonly index = input.required<number>();
  /** Session mode — propagates to every SetEditor to render the check
   *  column. When a set is toggled, checkSet emits the set index so
   *  the SessionPage can mutate + kick its rest timer. */
  readonly showCheck = input<boolean>(false);
  /** Session-only: PRs for THIS exercise (filtered by parent from the
   *  batch fetch). Empty in editor mode. */
  readonly personalRecords = input<readonly PersonalRecord[]>([]);
  /** Session-only: ANTERIOR ghost values for THIS exercise, one row per
   *  set that had history in the user's most recent workout of the
   *  exercise. Keyed by orderIndex for O(1) lookup per SetEditor. */
  readonly previousSets = input<readonly PreviousSet[]>([]);
  readonly checkSet = output<number>();

  /** Previous set by 0-based orderIndex — matches how the current
   *  editor's sets carry their own orderIndex. Falls back to index-in-
   *  array for rows we haven't seen before. */
  protected readonly previousByOrder = computed<ReadonlyMap<number, PreviousSet>>(() => {
    const map = new Map<number, PreviousSet>();
    for (const ps of this.previousSets()) map.set(ps.orderIndex, ps);
    return map;
  });
  protected previousFor(setIndex: number): PreviousSet | null {
    return this.previousByOrder().get(setIndex) ?? null;
  }

  /** Per-set PR flag — client-side preview. Recomputes when the draft
   *  or the PR set changes. */
  protected isPr(set: RoutineSet): boolean {
    return this.showCheck() && isPersonalRecord(set, this.personalRecords());
  }

  protected readonly form = inject(RoutineEditFormService);
  private readonly alerts = inject(AlertController);
  private readonly modal = inject(ModalController);
  private readonly actions = inject(TrainingActionsService);
  private readonly selectSheet = inject(SelectSheetService);
  private readonly vcr = inject(ViewContainerRef);
  private readonly api = inject(TrainingApi);
  private readonly weightPicker = inject(WeightModePickerService);

  /**
   * Per-user KG/BRICKS preference for this exercise. Fetched only on
   * exercises that actually support bricks (MACHINE/CABLE/SMITH). 404 →
   * null (user never set anything → default KG mode). Passed down to
   * every set-editor so the row inputs and column header stay in sync.
   */
  protected readonly prefQuery = injectQuery(() => ({
    queryKey: trainingKeys.inputPreference(this.exercise().exerciseId),
    queryFn: () => firstValueFrom(
      this.api.getInputPreference(this.exercise().exerciseId)),
    enabled: this.caps().bricks,
    staleTime: 5 * 60_000,
  }));

  protected readonly inputMode = computed<InputMode>(
    () => this.prefQuery.data()?.inputMode ?? 'KG');
  protected readonly brickWeight = computed<number>(
    () => Number(this.prefQuery.data()?.brickWeightKg ?? 5));
  protected readonly weightHeaderLabel = computed(() =>
    this.inputMode() === 'BRICKS'
      ? `Ladrillos (${this.brickWeight()}kg)`
      : 'Kg');

  /** Reps mode lives on the domain (persisted per exercise); reading it
   *  as a computed keeps the template reactive to draft mutations. */
  protected readonly repsMode = computed<RepsMode>(() => this.exercise().repsMode);

  /** Server-computed input matrix for this exercise; falls back permissive. */
  protected readonly caps = computed<ExerciseCapabilities>(() =>
    this.exercise().capabilities ?? PERMISSIVE_CAPS);

  /** Letter for the superset badge (A/B/C…). Derived from first-appearance
   *  order of the unique supersetGroupIds in the draft, so groups are
   *  labeled consistently across every exercise editor. Null when this
   *  exercise is not in a group. */
  protected readonly supersetLetter = computed<string | null>(() => {
    const id = this.exercise().supersetGroupId;
    if (!id) return null;
    const seen: string[] = [];
    for (const ex of this.form.draft()?.exercises ?? []) {
      const g = ex.supersetGroupId;
      if (g && !seen.includes(g)) seen.push(g);
    }
    const idx = seen.indexOf(id);
    return idx >= 0 && idx < 26 ? String.fromCharCode(65 + idx) : '★';
  });

  /** Empty-string fallback of the exercise name, used as the subtitle
   *  on every sheet + passed down to set-editor. Avoids sprinkling
   *  `?? ''` four times in the template + methods. */
  protected readonly exerciseName = computed(() =>
    this.exercise().exerciseName ?? '');

  /**
   * The number this row would carry if it were WORKING. Only WARMUP
   * rows sit outside the count (they render "W" and don't advance the
   * ordinal); WORKING, DROP_SET and FAILURE all consume a slot since
   * they're real working effort. So [WORKING, FAILURE, WORKING]
   * renders as [1, F, 3] — the FAILURE row shows "F" via its glyph
   * but still occupies slot 2.
   *
   * For a non-working row the number returned is "what it would take
   * if switched to WORKING" so the dropdown preview shows the right
   * label. Example [W W W]: all three preview WORKING=1.
   */
  protected readonly workingOrdinals = computed<number[]>(() => {
    let n = 0;
    return this.exercise().sets.map(s =>
      s.setType === 'WARMUP' ? n + 1 : ++n);
  });

  /** Show-RPE stays a local UI-only signal — no domain field. Seeded
   *  from data once so exercises that already carry an RPE reveal the
   *  column; from there the user's toggle wins for the session. */
  protected readonly showRpe = signal<boolean>(false);

  /** Grid template mirrors the set-editor row: Serie | [Kg] | [Reps] |
   *  [Tiempo] | [RPE]. Middle columns collapse when caps say the
   *  exercise doesn't support them. Must stay in lock-step with
   *  set-editor's own gridTemplate — same cols in same order. */
  protected readonly gridTemplate = computed(() => {
    const c = this.caps();
    const serie = '48px';
    const anterior = this.showCheck() ? '1.2fr' : '';
    const kg = c.weight ? '1fr' : '';
    const reps = c.reps
      ? (this.repsMode() === 'RANGE' ? '1.4fr' : '1fr')
      : '';
    const duration = (c.duration && !c.reps) ? '1fr' : '';
    const rpe = (this.showRpe() && c.rpe) ? '60px' : '';
    const check = this.showCheck() ? '40px' : '';
    return [serie, anterior, kg, reps, duration, rpe, check]
      .filter(Boolean).join(' ');
  });

  /** Guards the show-RPE inference so a set edit does not fight the
   *  user's manual choice. */
  private rpeInferred = false;

  constructor() {
    addIcons({
      'add-outline': addOutline, 'caret-down': caretDown,
      'ellipsis-vertical': ellipsisVertical,
      'repeat-outline': repeatOutline, 'resize-outline': resizeOutline,
      'reorder-three-outline': reorderThreeOutline,
      'swap-horizontal-outline': swapHorizontalOutline,
      'link-outline': linkOutline, 'speedometer-outline': speedometerOutline,
      'trash-outline': trashOutline,
    });
    effect(() => {
      const ex = this.exercise();
      if (this.rpeInferred) return;
      this.showRpe.set(ex.sets.some(s => s.targetRpe != null));
      this.rpeInferred = true;
    }, { allowSignalWrites: true });
  }

  // ---------- Long-press on header → same ActionSheet ----------

  /** Hold duration before the menu opens, mirrors the reorder modal. */
  private static readonly LONG_PRESS_MS = 500;
  /** Any pointer movement past this cancels the hold — user is scrolling. */
  private static readonly LONG_PRESS_SLOP_PX = 8;

  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private longPressStart: { x: number; y: number } | null = null;

  protected onHeaderPointerDown(ev: PointerEvent): void {
    this.longPressStart = { x: ev.clientX, y: ev.clientY };
    this.longPressTimer = setTimeout(() => {
      this.longPressTimer = null;
      // Hold jumps straight to reorder. The ⋮ button still opens the
      // ActionSheet with rename / replace / superset / delete.
      this.openReorder();
    }, ExerciseEditorComponent.LONG_PRESS_MS);
  }

  protected onHeaderPointerMove(ev: PointerEvent): void {
    if (!this.longPressStart) return;
    const dx = ev.clientX - this.longPressStart.x;
    const dy = ev.clientY - this.longPressStart.y;
    if (dx * dx + dy * dy > ExerciseEditorComponent.LONG_PRESS_SLOP_PX ** 2) {
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

  protected async openMenu(): Promise<void> {
    // Session mode hides "Opciones de repeticiones" — the reps template
    // (single vs range) is a routine-authoring decision, not something
    // the user should be swapping mid-workout. Every other action still
    // works: reorder / replace / superset / delete stay available so a
    // spontaneous mid-session tweak persists via "Actualizar rutina?".
    const options = [
      ...(this.showCheck() ? [] : [
        { label: 'Opciones de repeticiones', value: 'reps',
          leadingIcon: 'repeat-outline' },
      ]),
      { label: this.showRpe() ? 'Ocultar RPE' : 'Mostrar RPE',
        value: 'rpe', leadingIcon: 'speedometer-outline' },
      { label: 'Reordenar ejercicios',     value: 'reorder',
        leadingIcon: 'reorder-three-outline' },
      { label: 'Reemplazar ejercicio',     value: 'replace',
        leadingIcon: 'swap-horizontal-outline' },
      { label: this.supersetLetter() ? 'Quitar de superserie' : 'Agregar a superserie',
        value: 'superset', leadingIcon: 'link-outline' },
      { label: 'Eliminar ejercicio',       value: 'delete',
        leadingIcon: 'trash-outline', destructive: true },
    ];
    const picked = await this.selectSheet.open(this.vcr, {
      header: 'Opciones del ejercicio',
      subtitle: this.exerciseName(),
      value: '',
      options,
    });
    switch (picked) {
      case 'reps':     this.openRepsOptions(); break;
      case 'rpe':      this.toggleRpe(); break;
      case 'reorder':  this.openReorder(); break;
      case 'replace':  this.openReplace(); break;
      case 'superset':
        if (this.supersetLetter()) this.form.removeFromSuperset(this.index());
        else this.openSupersetPicker();
        break;
      case 'delete':   this.confirmDelete(); break;
    }
  }

  protected async openRepsOptions(): Promise<void> {
    const picked = await this.selectSheet.open(this.vcr, {
      header: 'Opciones de repeticiones',
      subtitle: this.exerciseName(),
      value: this.repsMode(),
      options: [
        { label: 'Repeticiones',          value: 'SINGLE',
          leadingIcon: 'repeat-outline' },
        { label: 'Rango de repeticiones', value: 'RANGE',
          leadingIcon: 'resize-outline' },
      ],
    });
    if (picked === 'SINGLE' || picked === 'RANGE') this.setRepsMode(picked);
  }

  /** Delegate to the shared picker — one line here, all sheet/prompt/save
   *  flow lives in WeightModePickerService and is reusable from the
   *  workout runner. */
  protected openWeightModeSheet(): Promise<void> {
    return this.weightPicker.open(
      this.vcr, this.exercise().exerciseId, this.inputMode(), this.brickWeight(),
      this.exerciseName());
  }

  /**
   * Persists the picked mode on the exercise's domain field (server
   * round-trip on save). Does NOT touch the sets — max survives on the
   * record when switching to single; only typing into the single input
   * mirror-writes min===max via set-editor.
   */
  private setRepsMode(mode: RepsMode): void {
    if (this.repsMode() === mode) return;
    this.form.updateExerciseRepsMode(this.index(), mode);
  }

  private toggleRpe(): void {
    this.showRpe.update(v => !v);
  }

  private async openReorder(): Promise<void> {
    // Same pattern as TrainingActionsService.openReorderFolders — hand
    // the shared ReorderModalComponent a plain snapshot arrow so ion-
    // header/content/footer are direct children of ion-modal (Ionic
    // needs that to fill the viewport). Wrapping the shared modal in a
    // second component broke the footer's bottom-anchored layout.
    const draft: RoutineExercise[] = [...(this.form.draft()?.exercises ?? [])];
    const modal = await this.modal.create({
      component: ReorderModalComponent,
      componentProps: {
        title: 'Reordenar ejercicios',
        items: () => draft,
        labelFn: (ex: RoutineExercise) =>
          ex.exerciseName ?? `Ejercicio #${ex.exerciseId}`,
        iconInitialFn: (ex: RoutineExercise) =>
          ex.exerciseName?.trim().charAt(0).toUpperCase() ?? null,
        onMove: (from: number, to: number) => {
          if (from === to) return;
          const [item] = draft.splice(from, 1);
          draft.splice(to, 0, item);
          this.form.moveExercise(from, to);
        },
        onRemove: (index: number) => {
          draft.splice(index, 1);
          this.form.removeExercise(index);
        },
      },
    });
    await modal.present();
  }

  /** Sheet listing every OTHER exercise in the routine — pick one and
   *  both join the same supersetGroupId (see form.addToSuperset for
   *  merge rules). Never opens if this is the only exercise. */
  private async openSupersetPicker(): Promise<void> {
    const all = this.form.draft()?.exercises ?? [];
    const currentIdx = this.index();
    const options = all
      .map((ex, i) => ({ ex, i }))
      .filter(({ i }) => i !== currentIdx)
      .map(({ ex, i }) => ({
        label: ex.exerciseName ?? `Ejercicio #${ex.exerciseId}`,
        value: String(i),
        leadingIcon: 'link-outline',
      }));
    if (!options.length) {
      this.actions.notImplemented('Necesitás otro ejercicio para armar la superserie');
      return;
    }
    const picked = await this.selectSheet.open(this.vcr, {
      header: 'Agregar a superserie',
      subtitle: this.exerciseName(),
      value: '',
      options,
    });
    if (!picked) return;
    this.form.addToSuperset(currentIdx, Number(picked));
  }

  /** Opens the exercise picker (same modal as "Agregar ejercicio") in
   *  replace mode — sets / rest / notes / superset / repsMode stay,
   *  only the exercise identity + capabilities swap. Backend guard
   *  will reject sets that carry fields the new exercise doesn't
   *  allow (weight on bodyweight, etc.) — user sees the invalidation
   *  at Guardar time and can clear those manually. */
  private async openReplace(): Promise<void> {
    const modal = await this.modal.create({ component: ExercisePickerComponent });
    await modal.present();
    const { data } = await modal.onDidDismiss<{
      id: number; name: string; demoMediaUrl: string | null;
      capabilities: ExerciseCapabilities | null;
    }>();
    if (!data) return;
    this.form.replaceExercise(
      this.index(), data.id, data.name, data.demoMediaUrl, data.capabilities);
  }

  private async confirmDelete(): Promise<void> {
    const ex = this.exercise();
    const alert = await this.alerts.create({
      header: 'Eliminar ejercicio',
      message: `¿Quitar "${ex.exerciseName ?? 'este ejercicio'}" de la rutina?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Eliminar', role: 'confirm', cssClass: 'ion-color-danger' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role === 'confirm') this.form.removeExercise(this.index());
  }

}
