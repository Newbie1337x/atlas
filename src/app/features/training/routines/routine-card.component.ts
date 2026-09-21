import {
  ChangeDetectionStrategy, Component, ViewContainerRef,
  computed, inject, input,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonItem, IonLabel, IonNote, IonButton, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  ellipsisVertical, shareSocialOutline, copyOutline,
  createOutline, trashOutline, playCircleOutline,
} from 'ionicons/icons';
import { RoutineSummary } from '@core/training/routine.model';
import { TrainingActionsService } from '@core/training/training-actions.service';
import { SelectSheetService } from '@shared/ui/select-sheet.service';

/**
 * One routine row in the training list. Tap the row → opens detail;
 * "Empezar" button starts a session from this routine (session page
 * consumes `?routineId=...`).
 *
 * Skinless: preview names shown as "ejA · ejB · …" so the merchant can
 * see the composition without opening the routine. Design pass replaces
 * this with icons + a proper card layout.
 */
@Component({
  selector: 'app-training-routine-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IonItem, IonLabel, IonNote, IonButton, IonIcon],
  styles: [`
    /* ion-item[routerLink] renders a real <a href> internally — on
       Android Chrome, a long-press on a link fires the browser's native
       "Abrir en pestaña nueva / Copiar enlace" context menu, which wins
       the gesture before cdkDrag's press-and-hold ever gets a chance to
       start. touch-callout + user-select (+ the (contextmenu) handler
       below) suppress that popup specifically.
       Deliberately NOT setting touch-action: none here — that property
       is read by the browser's compositor at touch-start, before any JS
       runs, so it blocks native scrolling on this element unconditionally
       and fights cdkDragStartDelay, whose whole point is to let a quick
       touch-and-scroll pass through as normal scrolling and only take
       over once the finger has actually held still past the delay. That
       combination (touch-action:none + start delay) is what made cards
       feel "stuck" under a scrolling finger. */
    :host {
      display: block;
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      user-select: none;
      -webkit-user-drag: none;
    }
  `],
  template: `
    <ion-item
      [routerLink]="['/training/routines', routine().id]"
      button [detail]="false"
      (contextmenu)="$event.preventDefault()">
      <ion-label>
        <h3>{{ routine().title }}</h3>
        <p>
          {{ routine().totalExerciseCount }} ej ·
          {{ routine().totalSetCount }} sets
          @if (routine().estimatedDurationMinutes; as m) {
            · ~{{ m }} min
          }
        </p>
        @if (previewText(); as p) {
          <ion-note>{{ p }}</ion-note>
        }
      </ion-label>
      <ion-button
        slot="end"
        size="small"
        [routerLink]="['/training/session', routine().id]"
        (click)="$event.stopPropagation()">
        Empezar
      </ion-button>
      <ion-button
        slot="end"
        fill="clear"
        size="small"
        (click)="openMenu(); $event.stopPropagation(); $event.preventDefault()"
        aria-label="Opciones de la rutina">
        <ion-icon slot="icon-only" name="ellipsis-vertical" />
      </ion-button>
    </ion-item>
  `,
})
export class RoutineCardComponent {
  readonly routine = input.required<RoutineSummary>();

  private readonly actions = inject(TrainingActionsService);
  private readonly sheets = inject(SelectSheetService);
  private readonly router = inject(Router);
  private readonly vcr = inject(ViewContainerRef);

  constructor() {
    addIcons({
      'ellipsis-vertical': ellipsisVertical,
      'share-social-outline': shareSocialOutline,
      'copy-outline': copyOutline,
      'create-outline': createOutline,
      'trash-outline': trashOutline,
      'play-circle-outline': playCircleOutline,
    });
  }

  protected readonly previewText = computed(() => {
    const previews = this.routine().exercisePreviews;
    if (previews.length === 0) return null;
    const names = previews.map(p => p.name).filter((n): n is string => !!n);
    return names.length ? names.join(' · ') : null;
  });

  protected async openMenu(): Promise<void> {
    const r = this.routine();
    const picked = await this.sheets.open(this.vcr, {
      header: 'Opciones de la rutina',
      subtitle: r.title,
      value: '',
      options: [
        { label: 'Empezar rutina',   value: 'start',
          leadingIcon: 'play-circle-outline' },
        { label: 'Compartir rutina', value: 'share',
          leadingIcon: 'share-social-outline' },
        { label: 'Duplicar rutina',  value: 'duplicate',
          leadingIcon: 'copy-outline' },
        { label: 'Editar rutina',    value: 'edit',
          leadingIcon: 'create-outline' },
        { label: 'Borrar rutina',    value: 'delete',
          leadingIcon: 'trash-outline', destructive: true },
      ],
    });
    switch (picked) {
      case 'start':     this.router.navigate(['/training/session', r.id]); break;
      case 'share':     this.actions.notImplemented('Compartir'); break;
      case 'duplicate': this.actions.confirmCloneRoutine(r); break;
      case 'edit':      this.router.navigate(['/training/routines', r.id, 'edit']); break;
      case 'delete':    this.actions.confirmDeleteRoutine(r); break;
    }
  }
}
