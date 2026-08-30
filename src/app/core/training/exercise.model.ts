/**
 * Exercise catalog entry — one row from GET /api/training/exercises.
 *
 * Used by the routine editor's exercise picker; nothing else in the
 * training module needs the full catalog shape today.
 */
import { ExerciseCapabilities } from './routine.model';

export interface CatalogExercise {
  id: number;
  organizationId: number | null;
  name: string;
  exerciseType: string;
  equipmentType: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  demoMediaUrl: string | null;
  isCustom: boolean;
  capabilities: ExerciseCapabilities;
}

/**
 * Per-user, per-exercise weight-input preference.
 *
 * Server-owned (endpoint: /api/training/exercises/{id}/input-preference).
 * The globalProfileId is inferred from the JWT; the frontend never sends it.
 * brickWeightKg defaults to 5.00 in the DB and is only meaningful when
 * inputMode === 'BRICKS' (guarded by the exercise's capabilities.bricks).
 */
export type InputMode = 'KG' | 'BRICKS';

export interface ExerciseInputPreference {
  id: number | null;
  globalProfileId: number | null;
  exerciseId: number;
  inputMode: InputMode;
  brickWeightKg: number;
}

export interface InputPreferenceRequest {
  inputMode: InputMode;
  brickWeightKg: number | null;
}
