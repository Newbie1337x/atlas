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

/**
 * Payload for POST/PUT of a routine folder. Both fields optional on PUT
 * (null = leave as-is). On POST the backend requires a non-blank name.
 */
export interface RoutineFolderRequest {
  name?: string;
  displayOrder?: number;
}

/**
 * Minimal shape for creating a routine from the training list. Full editing
 * (exercises + sets) uses the same DTO on PUT — with the exercises array
 * populated — but that's the routine-editor page, not this slice.
 */
export interface CreateRoutineRequest {
  title: string;
  folderId?: number | null;
  displayOrder?: number;
  notes?: string;
  exercises?: never[];
}

/** Mirrors Proteus's shared OffsetPage<T> (NOT Spring's Page<T>). */
export interface OffsetPage<T> {
  items: T[];
  offset: number;
  size: number;
  totalCount: number;
  hasMore: boolean;
}
