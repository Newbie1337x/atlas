import { Injectable, ViewContainerRef, inject } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { injectQueryClient } from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';
import { InputMode } from '@core/training/exercise.model';
import { TrainingApi } from '@core/training/training.api';
import { trainingKeys } from '@core/training/training.keys';
import { SelectSheetService } from '@shared/ui/select-sheet.service';

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
   * Opens the mode sheet. Two rows: Kilos or Ladrillos. When bricks is
   * already the active mode, tapping the Ladrillos row opens the weight
   * prompt instead (dual-purpose row — the label hints at that). First
   * switch to BRICKS accepts the current weight silently (default 5 kg
   * from the DB) — no prompt, the user changes it later if needed.
   */
  async open(
    vcr: ViewContainerRef,
    exerciseId: number,
    currentMode: InputMode,
    currentWeight: number,
    exerciseName = '',
  ): Promise<void> {
    const bricksLabel = currentMode === 'BRICKS'
      ? `Ladrillos (${currentWeight} kg — cambiar peso)`
      : `Ladrillos (${currentWeight} kg c/u)`;
    const picked = await this.sheets.open(vcr, {
      header: 'Contar el peso como',
      subtitle: exerciseName,
      value: currentMode,
      options: [
        { label: 'Kilos', value: 'KG' },
        { label: bricksLabel, value: 'BRICKS' },
      ],
    });
    if (picked === null) return;
    if (picked === 'BRICKS' && currentMode === 'BRICKS') {
      // Same row tapped while already in bricks → edit the weight.
      await this.promptBrickWeight(exerciseId, currentWeight);
      return;
    }
    if (picked === currentMode) return;
    // Fresh switch — save silently. Default weight comes from the DB (5 kg).
    await this.save(exerciseId, picked as InputMode, currentWeight);
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
