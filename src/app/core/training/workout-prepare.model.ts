import { RoutineDetail, SetType } from './routine.model';
import { PersonalRecord } from './personal-record.model';

/**
 * Response of GET /api/training/workouts/prepare?routineId=X. Consolidates
 * routine detail, current PRs and ANTERIOR ghost values in one round-trip
 * so the session tracker doesn't fan out multiple GETs at start-up.
 */
export interface WorkoutPrepare {
  routine: RoutineDetail;
  personalRecords: PersonalRecord[];
  previousSets: PreviousSet[];
}

/** One completed set from the user's most recent workout of the given
 *  exercise. Client keys by (exerciseId, orderIndex) to pick the row
 *  that lines up with each current set slot. */
export interface PreviousSet {
  exerciseId: number;
  orderIndex: number;
  setType: SetType;
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
  distanceKm: number | null;
  achievedAt: string;
}
