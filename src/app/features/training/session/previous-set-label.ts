import { PreviousSet } from '@core/training/workout-prepare.model';

/** Compact Hevy-style ANTERIOR label built from the previous workout's
 *  matching row. Format follows what the row was actually about:
 *  weight×reps, seconds for isometric holds, km for cardio.
 *  Bricks mode divides through brickWeightKg so the label reads in the
 *  same unit the input above it is showing. */
export function formatPreviousLabel(
  p: PreviousSet | null,
  isBricks: boolean,
  brickWeightKg: number,
): string {
  if (!p) return '';
  const parts: string[] = [];
  if (p.weightKg != null) parts.push(isBricks && brickWeightKg > 0
    ? `${p.weightKg / brickWeightKg} l` : `${p.weightKg}kg`);
  if (p.reps != null) parts.push(`× ${p.reps}`);
  else if (p.durationSeconds != null) parts.push(p.durationSeconds < 60
    ? `${p.durationSeconds}s` : formatMmSs(p.durationSeconds));
  if (p.distanceKm != null) parts.push(`${p.distanceKm}km`);
  return parts.join(' ');
}

function formatMmSs(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
