import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AlertController } from '@ionic/angular';
import { injectQueryClient } from '@tanstack/angular-query-experimental';
import { TrainingApi } from './training.api';
import { trainingKeys } from './training.keys';
import { RoutineFolder, RoutineSummary } from './training.model';

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

  async confirmDeleteRoutine(routine: RoutineSummary): Promise<void> {
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
