import { describe, expect, it } from 'vitest';
import { BEATS_PER_CYCLE, tempoToCps } from './tempo';

describe('tempoToCps', () => {
  it('converts BPM to cycles per second using beats per cycle', () => {
    expect(tempoToCps(120)).toBe(120 / (60 * BEATS_PER_CYCLE));
    expect(tempoToCps(60)).toBe(0.25);
  });
});
