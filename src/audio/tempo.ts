/** Display convention only — Strudel has no native "beat" unit, cps is cycles/sec. */
export const BEATS_PER_CYCLE = 4;

export function tempoToCps(bpm: number): number {
  return bpm / (60 * BEATS_PER_CYCLE);
}
