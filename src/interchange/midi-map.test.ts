import { describe, expect, it } from 'vitest';
import { midiFromValue, midiToNoteName } from './pitch';
import { parseMidi, writeMidi, type MidiNote } from './midi-file';
import {
  DRUM_CHANNEL,
  hapsToMidiNotes,
  midiNotesToParts,
  notesToMiniNotation,
  SAMPLE_TO_GM,
} from './midi-map';

function hap(
  value: Record<string, unknown>,
  begin = 0,
  end = 0.25,
): {
  value: Record<string, unknown>;
  part: { begin: number; end: number };
  whole: { begin: number; end: number };
  hasOnset: () => boolean;
} {
  return {
    value,
    part: { begin, end },
    whole: { begin, end },
    hasOnset: () => true,
  };
}

describe('pitch names', () => {
  it('maps note names to MIDI and back', () => {
    expect(midiFromValue({ note: 'c4' })).toBe(60);
    expect(midiFromValue({ note: 'a#3' })).toBe(58);
    expect(midiFromValue({ note: 64 })).toBe(64);
    expect(midiToNoteName(60)).toBe('c4');
    expect(midiToNoteName(58)).toBe('a#3');
  });
});

describe('MIDI to clip mini-notation', () => {
  it('quantizes to 16ths and writes chords', () => {
    const notes: MidiNote[] = [
      { cycle: 0, duration: 0.2, midi: 60, velocity: 100, channel: 1 },
      { cycle: 0.01, duration: 0.2, midi: 64, velocity: 100, channel: 1 },
      { cycle: 0.25, duration: 0.2, midi: 67, velocity: 100, channel: 1 },
    ];
    const mini = notesToMiniNotation(notes, (note) => midiToNoteName(note.midi));
    expect(mini?.startsWith('[c4,e4] ~ ~ ~ g4')).toBe(true);
    const { parts } = midiNotesToParts(notes);
    expect(parts).toHaveLength(1);
    expect(parts[0].laneId).toBe('melody');
    expect(parts[0].code).toContain('note("');
    expect(parts[0].code).toContain('[c4,e4]');
  });

  it('routes channel-10 notes to drums and low pitches to bass', () => {
    const { parts, warnings } = midiNotesToParts([
      { cycle: 0, duration: 0.1, midi: 36, velocity: 100, channel: DRUM_CHANNEL },
      { cycle: 0.5, duration: 0.1, midi: 38, velocity: 100, channel: DRUM_CHANNEL },
      { cycle: 0, duration: 0.25, midi: 36, velocity: 100, channel: 1 },
      { cycle: 0.25, duration: 0.25, midi: 38, velocity: 100, channel: 1 },
      { cycle: 0, duration: 0.1, midi: 81, velocity: 100, channel: DRUM_CHANNEL },
    ]);
    expect(parts.map((part) => part.laneId).sort()).toEqual(['bass', 'drums']);
    expect(parts.find((part) => part.laneId === 'drums')?.code).toContain('bd');
    expect(parts.find((part) => part.laneId === 'drums')?.code).toContain('sd');
    expect(parts.find((part) => part.laneId === 'bass')?.code).toContain('c2');
    expect(warnings).toContain('Unmapped GM drum 81');
  });
});

describe('haps to MIDI', () => {
  it('maps drum samples to channel 10 and reports unmapped sounds', () => {
    const { notes, warnings } = hapsToMidiNotes([
      hap({ s: 'bd', gain: 1 }, 0, 0.25),
      hap({ note: 'c4', s: 'triangle', gain: 0.5 }, 0.25, 0.5),
      hap({ s: 'glitch' }, 0.5, 0.75),
    ]);
    expect(notes[0]).toMatchObject({ midi: SAMPLE_TO_GM.bd, channel: DRUM_CHANNEL, cycle: 0 });
    expect(notes[1]).toMatchObject({ midi: 60, channel: 1, cycle: 0.25, velocity: 64 });
    expect(warnings).toEqual(['Unmapped sample "glitch"']);
    const parsed = parseMidi(writeMidi(notes, 120));
    expect(parsed.notes.map((note) => note.midi)).toEqual([36, 60]);
  });
});
