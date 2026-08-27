/**
 * Mirrors Proteus training DTOs. Field names track:
 *   - RoutineSummaryResponse.java
 *   - RoutineFolderResponse.java
 *   - RoutineResponse.java (detail — for the routine-detail page)
 *
 * Kept intentionally structural (interfaces) — no classes, no runtime logic.
 * If a shape drifts on the backend, tsc catches it at the api-layer boundary.
 */

export type RoutineOwnerType = 'MEMBER' | 'TEMPLATE' | 'COACH';

export interface ExercisePreview {
  exerciseId: number;
  name: string | null;
  iconUrl: string | null;
  supersetGroupId: string | null;
}

/** Card shape for /api/training/routines/me (paged). */
export interface RoutineSummary {
  id: number;
  organizationId: number;
  ownerType: RoutineOwnerType;
  ownerGlobalProfileId: number;
  title: string;
  /** null = loose at top level (rendered under the "Mis rutinas" label). */
  folderId: number | null;
  /** Position within the folder (or top-level loose bucket). */
  displayOrder: number;
  exercisePreviews: ExercisePreview[];
  totalExerciseCount: number;
  totalSetCount: number;
  /** null when the routine has zero exercises. */
  estimatedDurationMinutes: number | null;
}

export interface RoutineFolder {
  id: number;
  organizationId: number | null;
  ownerGlobalProfileId: number;
  name: string;
  displayOrder: number;
  createdAt: string;
  /** Populated by the backend enricher — number of routines currently in the folder. */
  routineCount: number;
}

/** Server-side Page<T> shape from Spring's OffsetPage / Pageable. */
export interface OffsetPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}
