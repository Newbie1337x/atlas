import { PersonalRecord } from '@core/training/personal-record.model';
import { RoutineSet } from '@core/training/routine.model';

/**
 * Client-side PR preview during a workout. Returns true when the
 * set's actual values would beat the current record for its exercise
 * on any of the per-set PR types (MAX_WEIGHT, MAX_SET_VOLUME,
 * ESTIMATED_1RM). Session-scope only; the authoritative PR detection
 * still runs server-side at workout complete.
 *
 * MAX_REPS and MAX_SESSION_VOLUME intentionally NOT flagged — reps-only
 * records fire on trivial cases (dropping weight to hit +1 rep isn't
 * always a "PR moment" the user wants), and session volume is a whole-
 * workout aggregate, not a per-set signal.
 */
export function isPersonalRecord(
  set: RoutineSet,
  prs: readonly PersonalRecord[],
): boolean {
  if (!set.completed) return false;
  const reps = set.actualReps ?? set.targetRepsMax ?? set.targetRepsMin;
  const kg = num(set.actualWeightKg ?? set.targetWeightKg);
  if (reps == null || reps <= 0 || kg == null || kg <= 0) return false;

  const setVolume = kg * reps;
  const epley1rm = kg * (1 + reps / 30);
  for (const pr of prs) {
    switch (pr.recordType) {
      case 'MAX_WEIGHT':      if (kg > pr.value)         return true; break;
      case 'MAX_SET_VOLUME':  if (setVolume > pr.value)  return true; break;
      case 'ESTIMATED_1RM':   if (epley1rm > pr.value)   return true; break;
      // MAX_REPS / MAX_SESSION_VOLUME / MAX_DURATION intentionally skipped
    }
  }
  return false;
}

function num(v: number | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
