/**
 * Folder-side models for the TRAINING module. Routines that live in
 * folders (or in the frontend-only "Mis rutinas" loose bucket) reference
 * them by id — see ./routine.model.ts.
 *
 *   - RoutineFolderResponse.java → RoutineFolder
 *   - RoutineFolderRequest.java  → RoutineFolderRequest
 */

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
 * (null = leave as-is). POST requires a non-blank name (backend guard).
 */
export interface RoutineFolderRequest {
  name?: string;
  displayOrder?: number;
}
