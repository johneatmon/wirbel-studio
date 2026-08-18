import { BEATS_PER_CYCLE } from '../audio/tempo';

export interface MidiNote {
  cycle: number;
  duration: number;
  midi: number;
  velocity: number;
  channel: number;
}

export interface ParsedMidi {
  ppq: number;
  bpm: number;
  notes: MidiNote[];
}

const HEADER = 'MThd';
const TRACK = 'MTrk';
const DEFAULT_PPQ = 96;

class Reader {
  offset = 0;
  private readonly bytes: Uint8Array;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
  }

  remaining(): number {
    return this.bytes.length - this.offset;
  }

  u8(): number {
    const value = this.bytes[this.offset] ?? 0;
    this.offset += 1;
    return value;
  }

  u16(): number {
    return (this.u8() << 8) | this.u8();
  }

  u32(): number {
    return (this.u8() << 24) | (this.u8() << 16) | (this.u8() << 8) | this.u8();
  }

  ascii(length: number): string {
    const slice = this.bytes.subarray(this.offset, this.offset + length);
    this.offset += length;
    return String.fromCharCode(...slice);
  }

  bytesOf(length: number): Uint8Array {
    const slice = this.bytes.subarray(this.offset, this.offset + length);
    this.offset += length;
    return slice;
  }

  vlq(): number {
    let value = 0;
    for (let i = 0; i < 4; i++) {
      const byte = this.u8();
      value = (value << 7) | (byte & 0x7f);
      if ((byte & 0x80) === 0) break;
    }
    return value;
  }
}

function encodeVlq(value: number): number[] {
  const bytes = [value & 0x7f];
  let rest = value >>> 7;
  while (rest > 0) {
    bytes.unshift((rest & 0x7f) | 0x80);
    rest >>>= 7;
  }
  return bytes;
}

function write16(value: number): number[] {
  return [(value >> 8) & 0xff, value & 0xff];
}

function write32(value: number): number[] {
  return [(value >> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function asciiBytes(text: string): number[] {
  return [...text].map((char) => char.charCodeAt(0));
}

function ticksPerCycle(ppq: number): number {
  return ppq * BEATS_PER_CYCLE;
}

export function parseMidi(bytes: Uint8Array): ParsedMidi {
  const reader = new Reader(bytes);
  if (reader.ascii(4) !== HEADER) throw new Error('Not a standard MIDI file');
  const headerLength = reader.u32();
  const format = reader.u16();
  const trackCount = reader.u16();
  const division = reader.u16();
  reader.offset += Math.max(0, headerLength - 6);
  if (format > 1) throw new Error('Unsupported MIDI format');
  if (division & 0x8000) throw new Error('SMPTE MIDI timing is not supported');
  const ppq = division || DEFAULT_PPQ;
  const tpc = ticksPerCycle(ppq);
  const notes: MidiNote[] = [];
  let bpm = 120;

  for (let track = 0; track < trackCount; track++) {
    if (reader.remaining() < 8) break;
    if (reader.ascii(4) !== TRACK) throw new Error('Malformed MIDI track');
    const length = reader.u32();
    const end = reader.offset + length;
    let tick = 0;
    let running = 0;
    const open = new Map<string, { tick: number; velocity: number }>();

    while (reader.offset < end) {
      tick += reader.vlq();
      let status = reader.u8();
      if (status < 0x80) {
        reader.offset -= 1;
        status = running;
      } else if (status < 0xf0) {
        running = status;
      }

      if (status === 0xff) {
        const type = reader.u8();
        const size = reader.vlq();
        const data = reader.bytesOf(size);
        if (type === 0x51 && data.length >= 3) {
          const micros = (data[0] << 16) | (data[1] << 8) | data[2];
          if (micros > 0) bpm = Math.round(60_000_000 / micros);
        }
        continue;
      }
      if (status === 0xf0 || status === 0xf7) {
        reader.bytesOf(reader.vlq());
        continue;
      }

      const command = status & 0xf0;
      const channel = (status & 0x0f) + 1;
      if (command === 0x90 || command === 0x80) {
        const midi = reader.u8();
        const velocity = reader.u8();
        const key = `${channel}:${midi}`;
        if (command === 0x90 && velocity > 0) {
          open.set(key, { tick, velocity });
        } else {
          const start = open.get(key);
          open.delete(key);
          if (start) {
            notes.push({
              cycle: start.tick / tpc,
              duration: Math.max(1 / tpc, (tick - start.tick) / tpc),
              midi,
              velocity: start.velocity,
              channel,
            });
          }
        }
        continue;
      }
      if (command === 0xc0 || command === 0xd0) reader.u8();
      else {
        reader.u8();
        reader.u8();
      }
    }
  }

  notes.sort((a, b) => a.cycle - b.cycle || a.midi - b.midi);
  return { ppq, bpm, notes };
}

function eventRank(bytes: number[]): number {
  const status = bytes[0] ?? 0;
  if (status === 0xff) return 0;
  if ((status & 0xf0) === 0x80) return 1;
  return 2;
}

export function writeMidi(notes: MidiNote[], bpm: number, ppq = DEFAULT_PPQ): Uint8Array {
  const tpc = ticksPerCycle(ppq);
  const micros = Math.round(60_000_000 / Math.max(20, bpm));
  const events: { tick: number; bytes: number[] }[] = [
    { tick: 0, bytes: [0xff, 0x51, 0x03, (micros >> 16) & 0xff, (micros >> 8) & 0xff, micros & 0xff] },
    { tick: 0, bytes: [0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08] },
  ];

  for (const note of notes) {
    const start = Math.max(0, Math.round(note.cycle * tpc));
    const end = Math.max(start + 1, Math.round((note.cycle + note.duration) * tpc));
    const channel = Math.min(16, Math.max(1, note.channel)) - 1;
    const velocity = Math.min(127, Math.max(1, Math.round(note.velocity)));
    events.push({ tick: start, bytes: [0x90 | channel, note.midi & 0x7f, velocity] });
    events.push({ tick: end, bytes: [0x80 | channel, note.midi & 0x7f, 0] });
  }

  events.sort((a, b) => a.tick - b.tick || eventRank(a.bytes) - eventRank(b.bytes));
  const lastTick = events.at(-1)?.tick ?? 0;
  events.push({ tick: lastTick, bytes: [0xff, 0x2f, 0x00] });

  const track: number[] = [];
  let previous = 0;
  for (const event of events) {
    track.push(...encodeVlq(event.tick - previous), ...event.bytes);
    previous = event.tick;
  }

  const body = [
    ...asciiBytes(HEADER),
    ...write32(6),
    ...write16(0),
    ...write16(1),
    ...write16(ppq),
    ...asciiBytes(TRACK),
    ...write32(track.length),
    ...track,
  ];
  return Uint8Array.from(body);
}
