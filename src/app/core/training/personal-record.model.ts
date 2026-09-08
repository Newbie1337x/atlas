/** Mirrors backend PersonalRecordType. */
export type PersonalRecordType =
  | 'MAX_WEIGHT'
  | 'MAX_REPS'
  | 'MAX_SET_VOLUME'
  | 'MAX_SESSION_VOLUME'
  | 'ESTIMATED_1RM'
  | 'MAX_DURATION';

/** Row of the personal_records table — one per (profile, exercise, type). */
export interface PersonalRecord {
  id: number;
  exerciseId: number;
  recordType: PersonalRecordType;
  /** Semantics depend on `recordType`:
   *  - MAX_WEIGHT: heaviest kg lifted on a single set
   *  - MAX_REPS: most reps in a single set
   *  - MAX_SET_VOLUME: kg × reps of the best set
   *  - MAX_SESSION_VOLUME: total kg × reps across a session
   *  - ESTIMATED_1RM: Epley formula (kg × (1 + reps/30))
   *  - MAX_DURATION: longest hold in seconds
   */
  value: number;
  achievedInWorkoutSetId: string | null;
  achievedAt: string;
  bodyweightSnapshotKg: number | null;
}
