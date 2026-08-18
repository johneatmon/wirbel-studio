import type { Hap, Pattern } from '@strudel/core';
import { hueFor, laneIndexFor } from './palette';

const LOOKBEHIND = 0.5; // cycles
const LOOKAHEAD = 1.5; // cycles
const WINDOW_CYCLES = LOOKBEHIND + LOOKAHEAD; // total cycles mapped across canvas width
const HIT_WINDOW = 0.06; // cycles either side of onset counted as "hitting now"
const LANES = 6;

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
    // A pathological pattern (deep .sometimesBy chains, fine subdivisions)
    // shouldn't be able to crash the frame loop — degrade to no haps.
    cachedHaps = [];
  }
  return cachedHaps;
}

function laneKeyFor(hap: Hap): string {
  const v = hap.value;
  return String(v.s ?? v.note ?? v.n ?? Object.keys(v).sort().join(','));
}

export function drawHapLane(
  ctx: CanvasRenderingContext2D,
  pattern: Pattern | null,
  now: number,
  width: number,
  height: number,
): void {
  const haps = queryWindow(pattern, now);
  const nowX = width * (LOOKBEHIND / WINDOW_CYCLES);
  const laneHeight = height / LANES;

  for (const hap of haps) {
    const onset = Number(hap.whole?.begin ?? hap.part.begin);
    const timeUntilOnset = onset - now;
    const x = nowX + (timeUntilOnset / WINDOW_CYCLES) * width;
    if (x < -40 || x > width + 40) continue;

    const key = laneKeyFor(hap);
    const lane = laneIndexFor(key, LANES);
    const y = lane * laneHeight + laneHeight / 2;
    const hue = hueFor(key);
    const gain = typeof hap.value.gain === 'number' ? hap.value.gain : 1;
    const opacity = Math.min(1, Math.max(0.25, gain));

    const hitProximity = Math.max(0, 1 - Math.abs(timeUntilOnset) / HIT_WINDOW);
    const radius = 5 + hitProximity * 7;
    const lightness = 55 + hitProximity * 30;

    ctx.beginPath();
    ctx.fillStyle = `hsla(${hue}, 70%, ${lightness}%, ${opacity})`;
    if (hitProximity > 0.01) {
      ctx.shadowColor = `hsla(${hue}, 90%, 65%, ${hitProximity})`;
      ctx.shadowBlur = 12 * hitProximity;
    } else {
      ctx.shadowBlur = 0;
    }
    ctx.roundRect(x - radius, y - radius, radius * 2, radius * 2, radius);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  // Now-line
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(nowX, 0);
  ctx.lineTo(nowX, height);
  ctx.stroke();
}
