import { Injectable, ViewContainerRef, inject } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { injectQueryClient } from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';
import { InputMode } from '@core/training/exercise.model';
import { TrainingApi } from '@core/training/training.api';
import { trainingKeys } from '@core/training/training.keys';
import { SelectSheetService } from './select-sheet.service';

/**
 * Opens the KG vs BRICKS picker for one exercise and, when needed, an
 * alert prompt to set the brick weight (default 5 kg). Persists via
 * PUT /api/training/exercises/{id}/input-preference/me and invalidates
 * the matching TanStack Query key so every consumer refreshes.
 *
 * Extracted from ExerciseEditorComponent so the same intent can be
 * reached from the workout runner (or any other set-authoring surface)
 * without duplicating the sheet + prompt + save dance.
 *
 * The service does NOT read the current preference — the caller passes
 * currentMode + currentWeight so the sheet renders the correct check-mark
 * and label ("Ladrillos (X kg c/u)") without a redundant fetch. The
 * caller's own injectQuery observing trainingKeys.inputPreference(id)
 * picks up the new value via the invalidation.
 */
@Injectable({ providedIn: 'root' })
export class WeightModePickerService {
  private readonly api = inject(TrainingApi);
  private readonly queryClient = injectQueryClient();
  private readonly sheets = inject(SelectSheetService);
  private readonly alerts = inject(AlertController);

  /**
   * Opens the mode sheet. When the user picks BRICKS for the first time
   * (currentMode !== 'BRICKS'), a follow-up prompt asks for the brick
   * weight so we don't silently commit them to the DB default. Picking
   * "Cambiar peso del ladrillo…" (only visible while bricks is active)
   * jumps straight to the prompt.
   */
  async open(
    vcr: ViewContainerRef,
    exerciseId: number,
    currentMode: InputMode,
    currentWeight: number,
  ): Promise<void> {
    const options = [
      { label: 'Kilos', value: 'KG' },
      { label: `Ladrillos (${currentWeight} kg c/u)`, value: 'BRICKS' },
    ];
    if (currentMode === 'BRICKS') {
      options.push({ label: 'Cambiar peso del ladrillo…', value: 'edit-weight' });
    }
    const picked = await this.sheets.open(vcr, {
      header: 'Contar el peso como',
      value: currentMode,
      options,
    });
    if (picked === null) return;
    if (picked === 'edit-weight') {
      await this.promptBrickWeight(exerciseId, currentWeight);
      return;
    }
    if (picked === currentMode) return;
    if (picked === 'BRICKS') {
      await this.save(exerciseId, 'BRICKS', currentWeight);
      await this.promptBrickWeight(exerciseId, currentWeight);
    } else {
      await this.save(exerciseId, picked as InputMode, currentWeight);
    }
  }

  private async promptBrickWeight(exerciseId: number, current: number): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Peso del ladrillo',
      inputs: [{
        name: 'kg', type: 'number', min: 0.25,
        attributes: { step: '0.25' },
        value: current, placeholder: 'kg',
      }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Guardar', role: 'confirm' },
      ],
    });
    await alert.present();
    const { role, data } = await alert.onDidDismiss<{ values: { kg: string } }>();
    if (role !== 'confirm') return;
    const kg = Number(data?.values?.kg);
    if (!Number.isFinite(kg) || kg <= 0) return;
    await this.save(exerciseId, 'BRICKS', kg);
  }

  private async save(exerciseId: number, inputMode: InputMode, brickWeightKg: number): Promise<void> {
    await firstValueFrom(this.api.putInputPreference(exerciseId, {
      inputMode, brickWeightKg,
    }));
    await this.queryClient.invalidateQueries({
      queryKey: trainingKeys.inputPreference(exerciseId),
    });
  }
}
