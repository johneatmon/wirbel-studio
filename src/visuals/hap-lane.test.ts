import { describe, expect, it } from 'vitest';
import type { Hap } from '@strudel/core';
import { hapLaneRows, midiFromValue, soundKeyFor, studioLaneIdFromHap } from './hap-lane';

function hap(value: Record<string, unknown>, tags?: string[]): Hap {
  return {
    value,
    context: tags ? { tags } : undefined,
    part: { begin: 0, end: 0.25 },
    hasOnset: () => true,
  } as Hap;
}

describe('hap lane identity', () => {
  it('reads studio lane tags from hap context', () => {
    expect(studioLaneIdFromHap(hap({ s: 'bd' }, ['studio-lane:drums']))).toBe('drums');
    expect(studioLaneIdFromHap(hap({ s: 'bd' }))).toBeNull();
  });

  it('keeps session rows and appends a code row for untagged haps', () => {
    const rows = hapLaneRows(
      [
        { id: 'drums', name: 'Drums' },
        { id: 'bass', name: 'Bass' },
      ],
      [hap({ s: 'bd' }, ['studio-lane:drums']), hap({ note: 'c4' })],
    );
    expect(rows.map((row) => row.id)).toEqual(['drums', 'bass', 'code']);
  });

  it('maps note names to MIDI and uses sound names for hue keys', () => {
    expect(midiFromValue({ note: 'c4' })).toBe(60);
    expect(midiFromValue({ note: 'a#3' })).toBe(58);
    expect(soundKeyFor(hap({ s: 'bd', note: 'c4' }))).toBe('bd');
  });
});
