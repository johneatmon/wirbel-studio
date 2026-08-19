import { BEATS_PER_CYCLE, getRepl, tickPendingEval } from './engine';
import { useClockStore } from '../store/clock-store';

let rafId: number | null = null;
let prevCycleNow = 0;

/** Every visual layer draws off this one rAF instead of running its own loop.
 * Listeners fire every frame, even before the engine is ready (cycleNow stays
 * 0 until then). */
const frameListeners = new Set<(cycleNow: number) => void>();
export function onFrame(listener: (cycleNow: number) => void): () => void {
  frameListeners.add(listener);
  return () => frameListeners.delete(listener);
}

function frame() {
  const repl = getRepl();
  let cycleNow = prevCycleNow;
  if (repl) {
    cycleNow = repl.scheduler.now();
    tickPendingEval(cycleNow, prevCycleNow);
    prevCycleNow = cycleNow;

    const cycle = Math.floor(cycleNow);
    const phase = cycleNow - cycle;
    const beat = Math.floor(phase * BEATS_PER_CYCLE);
    const playing = repl.state.started;
    const cps = repl.scheduler.cps;

    const root = document.documentElement;
    root.style.setProperty('--phase', String(phase));
    root.style.setProperty('--beat', String(beat));

    useClockStore.setState({ cycle, phase, beat, cps, playing });
  }
  frameListeners.forEach((listener) => listener(cycleNow));
  rafId = requestAnimationFrame(frame);
}

/** Idempotent — safe to call once the engine is ready; only one loop ever runs. */
export function startClockLoop(): void {
  if (rafId !== null) return;
  rafId = requestAnimationFrame(frame);
}

export function stopClockLoop(): void {
  if (rafId !== null) cancelAnimationFrame(rafId);
  rafId = null;
}
