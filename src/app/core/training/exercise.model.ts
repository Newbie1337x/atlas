/**
 * Exercise catalog entry — one row from GET /api/training/exercises.
 *
 * Used by the routine editor's exercise picker; nothing else in the
 * training module needs the full catalog shape today.
 */
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
}
