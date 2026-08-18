import {
  getAnalyzerData,
  getAudioContext,
  initStrudel,
  samples,
  soundMap,
  superdough,
  type StrudelRepl,
} from '@strudel/web';
import type { Pattern } from '@strudel/core';
import { BEATS_PER_CYCLE, tempoToCps } from './tempo';

export { BEATS_PER_CYCLE, tempoToCps };

export interface EngineState {
  started: boolean;
  pattern: Pattern | null;
  error: Error | null;
}

export type QuantizeBoundary = 'immediate' | 'beat' | 'cycle';

let repl: StrudelRepl | null = null;
let initPromise: Promise<StrudelRepl> | null = null;

interface PendingEval {
  code: string;
  boundary: 'beat' | 'cycle';
  resolve: () => void;
  reject: (reason: unknown) => void;
}

let pendingEval: PendingEval | null = null;
const applyListeners = new Set<() => void>();

/** Fires synchronously right before an eval is dispatched to the repl — this is
 * the moment the UI should sync to, not when the returned promise resolves. */
export function onApply(listener: () => void): () => void {
  applyListeners.add(listener);
  return () => applyListeners.delete(listener);
}

/** Boots the engine once; safe to call repeatedly (e.g. React StrictMode). */
export function initEngine(onState: (state: EngineState) => void): Promise<StrudelRepl> {
  if (initPromise) return initPromise;
  initPromise = initStrudel({
    prebake: async () => {
      // @strudel/soundfonts pulls in a *separate* @strudel/core /
      // @strudel/webaudio instance than the one bundled inside @strudel/web,
      // so registerSoundfonts() would register into a registry this engine
      // never reads from — sounds would silently never trigger. Revisit once
      // we resolve that (either drop @strudel/web's bundle for granular
      // packages, or find a shared-instance wiring) before relying on GM
      // instruments.
      await samples('github:tidalcycles/dirt-samples');
    },
    onUpdateState: (state) => {
      onState({
        started: state.started,
        pattern: state.pattern ?? null,
        error: state.evalError ?? state.schedulerError ?? null,
      });
    },
  }).then((r) => (repl = r));
  return initPromise;
}

/** §11 open question #3, resolved: superdough's master chain can't be tapped
 * directly (no exposed getter), but `.analyze(id)` is a normal chainable
 * control — every voice that carries it gets connected into the analyser
 * keyed `id` (confirmed by reading superdough's trigger function, and
 * empirically: a live non-zero waveform read back mid-playback). Tag the
 * evaluated pattern with it here and swap it into the scheduler directly
 * (bypassing repl's own state tracking, so EngineState.pattern stays the
 * clean, un-instrumented pattern) — this makes every played pattern
 * automatically scope-able with no user-visible `.analyze()` call needed.
 */
const SCOPE_ANALYSER_ID = 'scope';

function dispatchEval(code: string): Promise<void> {
  if (!repl) return Promise.reject(new Error('Engine not initialized'));
  applyListeners.forEach((listener) => listener());
  return repl.evaluate(code).then(() => {
    if (repl?.state.pattern) {
      const analyzed = repl.state.pattern.analyze(SCOPE_ANALYSER_ID);
      void repl.scheduler.setPattern(analyzed, false);
    }
  });
}

/**
 * Evaluates `code`. With boundary 'immediate' (the default — e.g. ⌘⏎ per the
 * keybinding table) it applies right away. With 'beat' or 'cycle' it's held
 * until the clock loop (see audio/clock.ts) detects that boundary crossing,
 * UNLESS nothing is playing yet, in which case there's no boundary to wait
 * for and it applies immediately.
 *
 * Cyclist exposes no "run this at the next boundary" API (confirmed by
 * reading its source) — §11 open question #2's answer is: derive it from
 * now() + cps, polled every rAF frame in the clock loop.
 */
export function evaluateCode(
  code: string,
  boundary: QuantizeBoundary = 'immediate',
): Promise<void> {
  if (!repl) return Promise.reject(new Error('Engine not initialized'));
  if (boundary === 'immediate' || !repl.state.started) {
    pendingEval = null;
    return dispatchEval(code);
  }
  return new Promise((resolve, reject) => {
    pendingEval = { code, boundary, resolve, reject };
  });
}

/** Called every rAF frame by the clock loop with the current/previous cycle-time. */
export function tickPendingEval(cycleNow: number, prevCycleNow: number): void {
  if (!pendingEval) return;
  const unit = pendingEval.boundary === 'cycle' ? 1 : 1 / BEATS_PER_CYCLE;
  const crossed = Math.floor(cycleNow / unit) !== Math.floor(prevCycleNow / unit);
  if (!crossed) return;
  const { code, resolve, reject } = pendingEval;
  pendingEval = null;
  dispatchEval(code).then(resolve, reject);
}

export function cancelPendingEval(): void {
  pendingEval = null;
}

export function stopEngine(): void {
  cancelPendingEval();
  repl?.stop();
}

export function setCps(cps: number): void {
  if (repl) repl.scheduler.cps = cps;
}

/** Transpile and build a pattern without disturbing playback. */
export async function tryEvaluateExpression(
  code: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!repl) return { ok: false, error: 'Engine not initialized' };
  try {
    await repl.evaluate(code, false);
    const err = repl.state.evalError;
    if (err) return { ok: false, error: err.message };
    return { ok: true };
  } catch (reason) {
    return { ok: false, error: reason instanceof Error ? reason.message : String(reason) };
  }
}

/** Compile `code` to a queryable pattern without starting the scheduler. */
export async function loadPattern(code: string): Promise<Pattern | null> {
  if (!repl) return null;
  try {
    const pattern = await repl.evaluate(code, false);
    if (repl.state.evalError) return null;
    return pattern ?? repl.state.pattern ?? null;
  } catch {
    return null;
  }
}

export function getRepl(): StrudelRepl | null {
  return repl;
}

export function now(): number {
  return repl?.scheduler.now() ?? 0;
}

export function currentPattern(): Pattern | null {
  return repl?.state.pattern ?? null;
}

/**
 * Fire-and-forget one-shot preview (e.g. a slot chip's bank/wave popover).
 * Uses superdough directly — the same low-level trigger the scheduler calls
 * per-hap — instead of routing through evaluate/setPattern, so it never
 * disturbs whatever pattern is currently playing.
 */
export function previewSound(value: Record<string, unknown>): void {
  if (!repl) return;
  const ctx = getAudioContext();
  void superdough(value, ctx.currentTime + 0.03, 0.3);
}

/** Names currently registered via samples()/registerSound() — reflects what's
 * actually loaded right now, not a static guess. */
export function loadedSampleNames(): string[] {
  return Object.keys(soundMap.value);
}

const EMPTY_WAVEFORM = new Float32Array(0);

/** Live time-domain waveform for the scope layer. The underlying analyser is
 * only created lazily, the first time a triggered voice actually carries the
 * `analyze` id — until then (or before anything has ever played)
 * getAnalyzerData returns undefined, not an empty array. */
export function scopeWaveform(): Float32Array {
  return getAnalyzerData('time', SCOPE_ANALYSER_ID) ?? EMPTY_WAVEFORM;
}
