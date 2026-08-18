import { describe, expect, it } from 'vitest';
import { parseMidi, writeMidi, type MidiNote } from './midi-file';

function note(partial: Partial<MidiNote> & Pick<MidiNote, 'midi'>): MidiNote {
  return {
    cycle: 0,
    duration: 0.25,
    velocity: 100,
    channel: 1,
    ...partial,
  };
}

describe('standard MIDI files', () => {
  it('round-trips notes, tempo, and drum channel', () => {
    const notes = [
      note({ midi: 60, cycle: 0, duration: 0.25, velocity: 90, channel: 1 }),
      note({ midi: 64, cycle: 0, duration: 0.25, velocity: 90, channel: 1 }),
      note({ midi: 36, cycle: 0.5, duration: 0.125, velocity: 110, channel: 10 }),
    ];
    const parsed = parseMidi(writeMidi(notes, 128));
    expect(parsed.bpm).toBe(128);
    expect(parsed.notes).toHaveLength(3);
    expect(parsed.notes[0]).toMatchObject({ midi: 60, cycle: 0, channel: 1, velocity: 90 });
    expect(parsed.notes[1]).toMatchObject({ midi: 64, cycle: 0, channel: 1 });
    expect(parsed.notes[2]).toMatchObject({ midi: 36, cycle: 0.5, channel: 10, velocity: 110 });
    expect(parsed.notes[2].duration).toBeCloseTo(0.125);
  });

  it('parses running status and note-off as velocity-zero note-on', () => {
    // Format 0, one note: C4 on, running-status off.
    const bytes = Uint8Array.from([
      0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00, 0x01, 0x00, 0x60,
      0x4d, 0x54, 0x72, 0x6b, 0x00, 0x00, 0x00, 0x0b,
      0x00, 0x90, 0x3c, 0x40, 0x60, 0x3c, 0x00, 0x00, 0xff, 0x2f, 0x00,
    ]);
    const parsed = parseMidi(bytes);
    expect(parsed.ppq).toBe(96);
    expect(parsed.notes).toHaveLength(1);
    expect(parsed.notes[0].midi).toBe(60);
    expect(parsed.notes[0].cycle).toBe(0);
    expect(parsed.notes[0].duration).toBeCloseTo(0.25);
  });
});
