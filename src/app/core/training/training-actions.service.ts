import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AlertController, ModalController, ToastController } from '@ionic/angular';
import { injectQueryClient } from '@tanstack/angular-query-experimental';
import { TrainingApi } from './training.api';
import { trainingKeys } from './training.keys';
import { RoutineFolder } from './folder.model';
import { RoutineDetail, UpdateRoutineRequest } from './routine.model';
import { ReorderModalComponent } from '@shared/ui/reorder-modal.component';

/** Minimum shape for actions that only need identity — accepts summary or detail. */
type RoutineRef = { id: number; title: string };

/**
 * Orchestrates every user-initiated mutation on training routines +
 * folders. Owns three concerns so pages + cards don't:
 *   1. UX affordance — prompts / confirms via IonAlert (native mobile
 *      pattern, no bespoke dialog component per action).
 *   2. HTTP call via {@link TrainingApi}.
 *   3. Cache invalidation on success — every method invalidates
 *      trainingKeys.all so the folders list + routines list refetch in
 *      lockstep and the sidebar count matches the visible cards.
 *
 * Pages just call `actions.promptCreateFolder()`. No mutation state, no
 * queryClient wiring, no alert markup leaks into components.
 *
 * Not using injectMutation — these are fire-once actions, not repeated
 * reactive writes, so a plain awaited firstValueFrom + invalidate is
 * simpler than tracking pending/error signals we never render.
 */
@Injectable({ providedIn: 'root' })
export class TrainingActionsService {
  private readonly api = inject(TrainingApi);
  private readonly queryClient = injectQueryClient();
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);
  private readonly modal = inject(ModalController);

  // ---------- Folders ----------

  async promptCreateFolder(): Promise<void> {
    const name = await this.promptText({
      header: 'Nueva carpeta',
      placeholder: 'Nombre (ej. Semanal)',
    });
    if (!name) return;
    await firstValueFrom(this.api.createFolder({ name }));
    await this.invalidate();
  }

  async promptRenameFolder(folder: RoutineFolder): Promise<void> {
    const name = await this.promptText({
      header: 'Renombrar carpeta',
      value: folder.name,
      placeholder: 'Nombre',
    });
    if (!name || name === folder.name) return;
    await firstValueFrom(this.api.updateFolder(folder.id, { name }));
    await this.invalidate();
  }

  /**
   * Opens the shared ReorderModal populated with the current folder
   * list. Drag reorders the local `draft` array in-place; on close we
   * PUT each folder whose position differs from its previous
   * displayOrder. Batches happen in parallel and cache invalidates
   * once at the end.
   *
   * Backend has no dedicated batch-reorder endpoint; we send N PUTs.
   * With <20 folders in practice this is fine — moving one item
   * usually only shifts a handful, and unmoved items are skipped.
   */
  async openReorderFolders(folders: readonly RoutineFolder[]): Promise<void> {
    const draft: RoutineFolder[] = [...folders];
    const m = await this.modal.create({
      component: ReorderModalComponent,
      componentProps: {
        title: 'Reordenar carpetas',
        items: () => draft,
        labelFn: (f: RoutineFolder) => f.name,
        onMove: (from: number, to: number) => {
          const [item] = draft.splice(from, 1);
          draft.splice(to, 0, item);
        },
      },
    });
    await m.present();
    await m.onDidDismiss();
    const puts: Promise<unknown>[] = [];
    draft.forEach((folder, idx) => {
      if (folder.displayOrder !== idx) {
        puts.push(firstValueFrom(
          this.api.updateFolder(folder.id, { displayOrder: idx })));
      }
    });
    if (puts.length) {
      await Promise.all(puts);
      await this.invalidate();
    }
  }

  async confirmDeleteFolder(folder: RoutineFolder): Promise<void> {
    const ok = await this.confirm({
      header: 'Borrar carpeta',
      message: `¿Borrar "${folder.name}"? Las rutinas adentro pasan a "Mis rutinas", no se eliminan.`,
      confirmText: 'Borrar',
      danger: true,
    });
    if (!ok) return;
    await firstValueFrom(this.api.deleteFolder(folder.id));
    await this.invalidate();
  }

  // ---------- Routines ----------

  async promptCreateRoutine(folderId: number | null = null): Promise<void> {
    const title = await this.promptText({
      header: 'Nueva rutina',
      placeholder: 'Nombre (ej. Lunes - Pecho)',
    });
    if (!title) return;
    await firstValueFrom(this.api.createRoutine({ title, folderId }));
    await this.invalidate();
  }

  /** Accepts either shape (summary or detail) — only title + id are used. */
  async confirmDeleteRoutine(routine: RoutineRef): Promise<void> {
    const ok = await this.confirm({
      header: 'Borrar rutina',
      message: `¿Borrar "${routine.title}"? No se puede deshacer.`,
      confirmText: 'Borrar',
      danger: true,
    });
    if (!ok) return;
    await firstValueFrom(this.api.deleteRoutine(routine.id));
    await this.invalidate();
  }

  /**
   * Rename lives on the detail page — we already have the full routine
   * so we can spread it into the PUT without a second fetch. The API
   * enforces title as the only required field; everything else is
   * preserved verbatim.
   */
  async promptRenameRoutine(routine: RoutineDetail): Promise<void> {
    const title = await this.promptText({
      header: 'Renombrar rutina',
      value: routine.title,
      placeholder: 'Nombre',
    });
    if (!title || title === routine.title) return;
    await firstValueFrom(this.api.updateRoutine(routine.id, toUpdateRequest(routine, { title })));
    await this.invalidate();
  }

  async confirmCloneRoutine(routine: RoutineRef): Promise<void> {
    const ok = await this.confirm({
      header: 'Duplicar rutina',
      message: `Se creará una copia editable de "${routine.title}".`,
      confirmText: 'Duplicar',
    });
    if (!ok) return;
    await firstValueFrom(this.api.cloneRoutine(routine.id));
    await this.invalidate();
  }

  /** Placeholder feedback for actions the UI exposes but backend/frontend
   *  do not implement yet (share link, superset UI, exercise replace). */
  async notImplemented(feature: string): Promise<void> {
    const toast = await this.toasts.create({
      message: `${feature}: próximamente`,
      duration: 1500,
      position: 'bottom',
    });
    await toast.present();
  }

  // ---------- Internals ----------

  /** Refetch folders + routines together — a mutation on either affects both
   *  (routine count on folder cards, routine list when a folder is deleted). */
  private invalidate(): Promise<void> {
    return this.queryClient.invalidateQueries({ queryKey: trainingKeys.all });
  }

  private async promptText(opts: {
    header: string;
    placeholder: string;
    value?: string;
  }): Promise<string | null> {
    const alert = await this.alerts.create({
      header: opts.header,
      inputs: [{
        name: 'text', type: 'text', value: opts.value ?? '',
        placeholder: opts.placeholder, attributes: { maxlength: 80 },
      }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Guardar', role: 'confirm' },
      ],
    });
    await alert.present();
    const { data, role } = await alert.onDidDismiss<{ values: { text: string } }>();
    if (role !== 'confirm') return null;
    const trimmed = data?.values?.text?.trim() ?? '';
    return trimmed.length > 0 ? trimmed : null;
  }

  private async confirm(opts: {
    header: string;
    message: string;
    confirmText: string;
    danger?: boolean;
  }): Promise<boolean> {
    const alert = await this.alerts.create({
      header: opts.header,
      message: opts.message,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: opts.confirmText,
          role: 'confirm',
          cssClass: opts.danger ? 'ion-color-danger' : undefined,
        },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role === 'confirm';
  }
}

/**
 * Maps a full RoutineDetail into the narrower PUT payload — strips the
 * enricher-only fields (exerciseName / iconUrl) that the server ignores
 * on write anyway, so nothing ends up mixed with domain data. Optional
 * `overrides` mutate only the top-level fields; exercises stay verbatim
 * (rename / move a routine should not tear down its sets).
 */
export function toUpdateRequest(
  routine: RoutineDetail,
  overrides: Partial<UpdateRoutineRequest> = {},
): UpdateRoutineRequest {
  return {
    title: routine.title,
    notes: routine.notes,
    folderId: routine.folderId,
    displayOrder: routine.displayOrder,
    exercises: routine.exercises.map(ex => ({
      orderIndex: ex.orderIndex,
      exerciseId: ex.exerciseId,
      restSeconds: ex.restSeconds,
      supersetGroupId: ex.supersetGroupId,
      notes: ex.notes,
      repsMode: ex.repsMode,
      sets: ex.sets.map(s => ({
        orderIndex: s.orderIndex,
        setType: s.setType,
        targetRepsMin: s.targetRepsMin,
        targetRepsMax: s.targetRepsMax,
        targetWeightKg: s.targetWeightKg,
        targetDurationSeconds: s.targetDurationSeconds,
        targetDistanceKm: s.targetDistanceKm,
        targetRpe: s.targetRpe,
      })),
    })),
    ...overrides,
  };
}
