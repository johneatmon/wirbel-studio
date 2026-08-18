import type { Hap, Pattern } from '@strudel/core';
import { STUDIO_LANE_TAG_PREFIX } from '../session/model';
import { midiFromValue } from '../interchange/pitch';
import { hueFor } from './palette';

const LOOKBEHIND = 0.5; // cycles
const LOOKAHEAD = 1.5; // cycles
const WINDOW_CYCLES = LOOKBEHIND + LOOKAHEAD;
const HIT_WINDOW = 0.06;
const MIDI_LOW = 24;
const MIDI_HIGH = 96;

export interface HapLaneRow {
  id: string;
  name: string;
}

// §7 perf budget: queryArc is memoized per frame, snapped to a 1/32-cycle
// grid, so scrubbing/idle frames within the same slice reuse the last query
// instead of re-walking the pattern.
const QUANTUM = 1 / 32;
let cachedPattern: Pattern | null = null;
let cachedWindowStart: number | null = null;
let cachedHaps: Hap[] = [];

function queryWindow(pattern: Pattern | null, now: number): Hap[] {
  if (!pattern) return [];
  const windowStart = Math.floor((now - LOOKBEHIND) / QUANTUM) * QUANTUM;
  if (pattern === cachedPattern && windowStart === cachedWindowStart) return cachedHaps;
  cachedPattern = pattern;
  cachedWindowStart = windowStart;
  try {
    cachedHaps = pattern.queryArc(now - LOOKBEHIND, now + LOOKAHEAD).filter((h) => h.hasOnset());
  } catch {
    cachedHaps = [];
  }
  return cachedHaps;
}

export function studioLaneIdFromHap(hap: Hap): string | null {
  const tags = hap.context?.tags;
  if (!Array.isArray(tags)) return null;
  const tagged = tags.find(
    (tag) => typeof tag === 'string' && tag.startsWith(STUDIO_LANE_TAG_PREFIX),
  );
  return tagged ? tagged.slice(STUDIO_LANE_TAG_PREFIX.length) : null;
}

export function soundKeyFor(hap: Hap): string {
  const value = hap.value;
  return String(value.s ?? value.note ?? value.n ?? 'event');
}

export { midiFromValue };

export function hapLaneRows(lanes: HapLaneRow[], haps: Hap[]): HapLaneRow[] {
  const rows = lanes.length ? [...lanes] : [{ id: 'code', name: 'Code' }];
  if (haps.some((hap) => !studioLaneIdFromHap(hap)) && !rows.some((row) => row.id === 'code')) {
    rows.push({ id: 'code', name: 'Code' });
  }
  return rows;
}

function pitchY(value: Record<string, unknown>, laneTop: number, laneHeight: number): number {
  const midi = midiFromValue(value);
  if (midi === null) return laneTop + laneHeight / 2;
  const t = Math.min(1, Math.max(0, (midi - MIDI_LOW) / (MIDI_HIGH - MIDI_LOW)));
  return laneTop + laneHeight * (0.9 - t * 0.8);
}

export function drawHapLane(
  ctx: CanvasRenderingContext2D,
  pattern: Pattern | null,
  now: number,
  width: number,
  height: number,
  lanes: HapLaneRow[] = [],
): void {
  const haps = queryWindow(pattern, now);
  const rows = hapLaneRows(lanes, haps);
  const nowX = width * (LOOKBEHIND / WINDOW_CYCLES);
  const laneHeight = height / Math.max(1, rows.length);
  const rowIndex = new Map(rows.map((row, index) => [row.id, index]));

  ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
  for (let index = 0; index < rows.length; index++) {
    const top = index * laneHeight;
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(0, top, width, 1);
    ctx.fillStyle = 'rgba(163,163,163,0.55)';
    ctx.fillText(rows[index].name, 6, top + 12);
  }

  for (const hap of haps) {
    const onset = Number(hap.whole?.begin ?? hap.part.begin);
    const end = Number(hap.whole?.end ?? hap.part.end);
    const timeUntilOnset = onset - now;
    const x = nowX + (timeUntilOnset / WINDOW_CYCLES) * width;
    const durationWidth = Math.max(8, ((end - onset) / WINDOW_CYCLES) * width);
    if (x + durationWidth < -40 || x > width + 40) continue;

    const laneId = studioLaneIdFromHap(hap) ?? 'code';
    const index = rowIndex.get(laneId) ?? rowIndex.get('code') ?? 0;
    const top = index * laneHeight;
    const y = pitchY(hap.value, top, laneHeight);
    const hue = hueFor(soundKeyFor(hap));
    const gain = typeof hap.value.gain === 'number' ? hap.value.gain : 1;
    const opacity = Math.min(1, Math.max(0.25, gain));
    const hitProximity = Math.max(0, 1 - Math.abs(timeUntilOnset) / HIT_WINDOW);
    const rectHeight = 6 + hitProximity * 4;
    const lightness = 55 + hitProximity * 30;

    ctx.beginPath();
    ctx.fillStyle = `hsla(${hue}, 70%, ${lightness}%, ${opacity})`;
    if (hitProximity > 0.01) {
      ctx.shadowColor = `hsla(${hue}, 90%, 65%, ${hitProximity})`;
      ctx.shadowBlur = 12 * hitProximity;
    } else {
      ctx.shadowBlur = 0;
    }
    ctx.roundRect(x, y - rectHeight / 2, durationWidth, rectHeight, 3);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(nowX, 0);
  ctx.lineTo(nowX, height);
  ctx.stroke();
}
