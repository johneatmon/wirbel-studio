// @strudel/* packages ship no type declarations. This shim covers only the
// surface this app actually calls — narrower than `any` everywhere else.
declare module '@strudel/core' {
  export class Pattern {
    queryArc(begin: number, end: number): Hap[];
    /** Standard control, chainable like .gain()/.lpf() — tags triggered voices
     * so superdough connects their output into the analyser keyed `id`. */
    analyze(id: string): Pattern;
  }
  export class Hap {
    whole: { begin: number; end: number } | undefined;
    part: { begin: number; end: number };
    value: Record<string, unknown>;
    context?: { tags?: string[] };
    hasOnset(): boolean;
  }
}

declare module '@strudel/web' {
  import type { Pattern } from '@strudel/core';

  export interface ReplState {
    code: string;
    activeCode: string;
    pattern: Pattern | undefined;
    evalError: Error | undefined;
    schedulerError: Error | undefined;
    pending: boolean;
    started: boolean;
  }

  export interface Cyclist {
    now(): number;
    start(): void;
    stop(): void;
    pause(): void;
    setPattern(pattern: Pattern, autostart?: boolean): Promise<void>;
    cps: number;
  }

  export interface StrudelRepl {
    scheduler: Cyclist;
    evaluate(code: string, autostart?: boolean): Promise<Pattern | undefined>;
    stop(): void;
    state: ReplState;
  }

  export interface InitStrudelOptions {
    prebake?: () => Promise<void>;
    onUpdateState?: (state: ReplState) => void;
    onEvalError?: (error: Error) => void;
  }

  export function initStrudel(options?: InitStrudelOptions): Promise<StrudelRepl>;
  export function samples(source: string): Promise<void>;
  export function getAudioContext(): AudioContext;
  /** Low-level one-shot trigger — the same primitive the scheduler calls per-hap.
   * Bypasses the pattern/scheduler entirely, so it's safe for preview sounds
   * without disturbing whatever's currently playing. `time` must be a future
   * AudioContext timestamp (not relative). */
  export function superdough(
    value: Record<string, unknown>,
    time: number,
    duration: number,
  ): Promise<void>;
  /** Nanostores-style atom: `.value` is the live `{ soundName: definition }`
   * registry, updated in place as samples()/registerSound() load more. */
  export const soundMap: { value: Record<string, unknown> };
  /** Reads whatever .analyze(id) last tapped. Returns undefined (not an empty
   * array) until the analyser has actually been created — i.e. before any
   * triggered voice has ever carried that id. */
  export function getAnalyzerData(kind: 'time' | 'frequency', id: string): Float32Array | undefined;
  export function getAnalyserById(id: string, fftSize?: number, smoothing?: number): AnalyserNode;
}

declare module '@strudel/soundfonts' {
  export function registerSoundfonts(): void;
}
