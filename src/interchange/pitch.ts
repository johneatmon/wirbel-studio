const NOTE_PC: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const NOTE_NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];

export function midiFromValue(value: Record<string, unknown>): number | null {
  if (typeof value.note === 'number' && Number.isFinite(value.note)) return value.note;
  if (typeof value.note === 'string') {
    const match = /^([a-gA-G])([#b]?)(-?\d+)$/.exec(value.note.trim());
    if (!match) return null;
    const pc = NOTE_PC[match[1].toLowerCase()] + (match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0);
    return (Number(match[3]) + 1) * 12 + pc;
  }
  return null;
}

export function midiToNoteName(midi: number): string {
  const n = Math.round(midi);
  const pc = ((n % 12) + 12) % 12;
  const octave = Math.floor(n / 12) - 1;
  return `${NOTE_NAMES[pc]}${octave}`;
}
