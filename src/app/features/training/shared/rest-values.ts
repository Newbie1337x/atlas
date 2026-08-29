/**
 * Pre-set rest durations offered by the rest picker. Fine-grained in the
 * short range where users actually differ (5s steps 0→60s, 15s 60s→5min)
 * and coarse in the long tail (30s 5→10min). Anything longer than 10 min
 * is not worth a step — user can leave rest APAGADO and count in the head.
 */
export const REST_OPTIONS: readonly number[] = (() => {
  const out: number[] = [];
  for (let s = 0;   s <= 60;  s += 5)  out.push(s);
  for (let s = 75;  s <= 300; s += 15) out.push(s);
  for (let s = 330; s <= 600; s += 30) out.push(s);
  return out;
})();

/**
 * "0"     → "Apagado"
 * "45"    → "45s"
 * "60"    → "1min"
 * "90"    → "1min 30s"
 * "180"   → "3min"
 */
export function formatRestSeconds(s: number | null | undefined): string {
  if (s == null || s === 0) return 'Apagado';
  if (s < 60) return `${s}s`;
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return sec === 0 ? `${min}min` : `${min}min ${sec}s`;
}
