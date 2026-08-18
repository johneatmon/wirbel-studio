import { midiFromValue, midiToNoteName } from './pitch';
import type { MidiNote } from './midi-file';

export const STEPS_PER_CYCLE = 16;
export const DRUM_CHANNEL = 10;
export const PITCH_CHANNEL = 1;

/** GM percussion → Dirt-style sample names used by the default session clips. */
export const GM_DRUM_TO_SAMPLE: Record<number, string> = {
  35: 'bd',
  36: 'bd',
  37: 'rim',
  38: 'sd',
  39: 'cp',
  40: 'sd',
  41: 'lt',
  42: 'hh',
  43: 'lt',
  44: 'hh',
  45: 'mt',
  46: 'oh',
  47: 'mt',
  48: 'ht',
  49: 'crash',
  50: 'ht',
  51: 'ride',
  54: 'tamb',
  56: 'cow',
  57: 'crash',
  59: 'ride',
};

export const SAMPLE_TO_GM: Record<string, number> = {
  bd: 36,
  kick: 36,
  sd: 38,
  snare: 38,
  hh: 42,
  hc: 42,
  ch: 42,
  oh: 46,
  ho: 46,
  cp: 39,
  clap: 39,
  rim: 37,
  rs: 37,
  lt: 41,
  mt: 45,
  ht: 50,
  crash: 49,
  cr: 49,
  ride: 51,
  rd: 51,
  tamb: 54,
  cow: 56,
  cb: 56,
};

export interface ImportedClip {
  laneId: string;
  name: string;
  code: string;
}

export interface HapLike {
  hasOnset(): boolean;
  whole?: { begin: number; end: number };
  part: { begin: number; end: number };
  value: Record<string, unknown>;
}

export function notesToMiniNotation(
  notes: MidiNote[],
  tokenFor: (note: MidiNote) => string | null,
): string | null {
  const buckets = new Map<number, string[]>();
  let lastStep = 0;
  for (const note of notes) {
    const token = tokenFor(note);
    if (!token) continue;
    const step = Math.max(0, Math.round(note.cycle * STEPS_PER_CYCLE));
    lastStep = Math.max(lastStep, step);
    const bucket = buckets.get(step) ?? [];
    if (!bucket.includes(token)) bucket.push(token);
    buckets.set(step, bucket);
  }
  if (!buckets.size) return null;
  const steps = Math.max(
    STEPS_PER_CYCLE,
    Math.ceil((lastStep + 1) / STEPS_PER_CYCLE) * STEPS_PER_CYCLE,
  );
  const tokens: string[] = [];
  for (let step = 0; step < steps; step++) {
    const names = buckets.get(step);
    if (!names?.length) tokens.push('~');
    else if (names.length === 1) tokens.push(names[0]);
    else tokens.push(`[${names.join(',')}]`);
  }
  return tokens.join(' ');
}

export function midiNotesToParts(notes: MidiNote[]): {
  parts: ImportedClip[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const parts: ImportedClip[] = [];
  const drums = notes.filter((note) => note.channel === DRUM_CHANNEL);
  const pitched = notes.filter((note) => note.channel !== DRUM_CHANNEL);

  const drumMini = notesToMiniNotation(drums, (note) => {
    const sample = GM_DRUM_TO_SAMPLE[note.midi];
    if (!sample) {
      warnings.push(`Unmapped GM drum ${note.midi}`);
      return null;
    }
    return sample;
  });
  if (drumMini) {
    parts.push({
      laneId: 'drums',
      name: 'Imported drums',
      code: `s("${drumMini}").bank("RolandTR909").gain(0.55)`,
    });
  }

  const pitchedMini = notesToMiniNotation(pitched, (note) => midiToNoteName(note.midi));
  if (pitchedMini) {
    const mean = pitched.reduce((sum, note) => sum + note.midi, 0) / pitched.length;
    const bass = mean < 48;
    parts.push({
      laneId: bass ? 'bass' : 'melody',
      name: bass ? 'Imported bass' : 'Imported melody',
      code: bass
        ? `note("${pitchedMini}")\n  .s("sawtooth").lpf(650).gain(0.4)`
        : `note("${pitchedMini}")\n  .s("triangle").gain(0.28)`,
    });
  }

  return { parts, warnings };
}

export function hapsToMidiNotes(haps: HapLike[]): { notes: MidiNote[]; warnings: string[] } {
  const warnings: string[] = [];
  const notes: MidiNote[] = [];
  for (const hap of haps) {
    if (!hap.hasOnset()) continue;
    const begin = hap.whole?.begin ?? hap.part.begin;
    const end = hap.whole?.end ?? hap.part.end;
    if (begin < 0) continue;
    const sound =
      typeof hap.value.s === 'string'
        ? hap.value.s
        : typeof hap.value.sound === 'string'
          ? hap.value.sound
          : null;
    const gm = sound ? SAMPLE_TO_GM[sound] : undefined;
    const midi = gm ?? midiFromValue(hap.value);
    if (midi == null) {
      if (sound) warnings.push(`Unmapped sample "${sound}"`);
      continue;
    }
    const gain =
      typeof hap.value.gain === 'number' && Number.isFinite(hap.value.gain) ? hap.value.gain : 0.8;
    notes.push({
      cycle: begin,
      duration: Math.max(1 / 64, end - begin),
      midi,
      velocity: Math.min(127, Math.max(1, Math.round(gain * 127))),
      channel: gm != null ? DRUM_CHANNEL : PITCH_CHANNEL,
    });
  }
  return { notes, warnings };
}
