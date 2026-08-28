import { RoutineFolder } from '@core/training/folder.model';
import { RoutineSummary } from '@core/training/routine.model';

/**
 * Sorted view of the user's routines, grouped for rendering:
 *   - one bucket per folder, in the folder's displayOrder
 *   - a final "loose" bucket for routineS with folderId=null,
 *     rendered under the frontend-only label "Mis rutinas".
 *
 * Kept as a pure function so it's trivially testable and stays out of
 * the page's change-detection path. `folderId: null` in the returned
 * bucket is the marker for the loose group.
 */
export interface RoutineBucket {
  folder: RoutineFolder | null;
  routines: RoutineSummary[];
}

export function groupRoutinesByFolder(
  folders: readonly RoutineFolder[],
  routines: readonly RoutineSummary[],
): RoutineBucket[] {
  const byFolder = new Map<number, RoutineSummary[]>();
  const loose: RoutineSummary[] = [];

  for (const r of routines) {
    if (r.folderId == null) {
      loose.push(r);
    } else {
      const bucket = byFolder.get(r.folderId);
      if (bucket) bucket.push(r);
      else byFolder.set(r.folderId, [r]);
    }
  }

  const byOrder = (a: { displayOrder: number }, b: { displayOrder: number }) =>
    a.displayOrder - b.displayOrder;

  const buckets: RoutineBucket[] = [];
  const sortedFolders = [...folders].sort(byOrder);
  for (const f of sortedFolders) {
    const routinesInFolder = (byFolder.get(f.id) ?? []).sort(byOrder);
    buckets.push({ folder: f, routines: routinesInFolder });
  }
  // Loose bucket goes last; only render it when non-empty (the page decides).
  loose.sort(byOrder);
  buckets.push({ folder: null, routines: loose });

  return buckets;
}
