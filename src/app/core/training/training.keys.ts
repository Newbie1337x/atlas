/**
 * Query key factory for the TRAINING module.
 *
 * All keys start with 'training' so `invalidateQueries(['training'])` after
 * a folder/routine mutation clears everything at once. Sub-keys let pages
 * consume just what they need.
 *
 * Slice examples (paste into invalidateQueries):
 *   trainingKeys.all              → the whole subtree
 *   trainingKeys.folders()        → folder list
 *   trainingKeys.myRoutines()     → routine list
 *   trainingKeys.myRoutinesPage(0) → one specific page
 */
export const trainingKeys = {
  all: ['training'] as const,
  folders: () => [...trainingKeys.all, 'folders'] as const,
  myRoutines: () => [...trainingKeys.all, 'routines', 'me'] as const,
  myRoutinesPage: (offset: number, size: number) =>
    [...trainingKeys.myRoutines(), { offset, size }] as const,
  routineDetail: (id: number) => [...trainingKeys.all, 'routine', id] as const,
  /** Exercise catalog — long stale time; the list barely changes. */
  exerciseCatalog: () => [...trainingKeys.all, 'exercises'] as const,
  /** Per-exercise KG/BRICKS preference for the current user. */
  inputPreference: (exerciseId: number) =>
    [...trainingKeys.all, 'input-preference', exerciseId] as const,
};
