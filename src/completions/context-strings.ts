import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { ScaleType } from '@tonaljs/tonal';
import { loadedSampleNames } from '../audio/engine';
import { enclosingCallName, isInsideString } from './syntax-utils';

// Bank names aren't cleanly queryable from the loaded sample registry (dirt-
// samples' bank grouping isn't exposed as a simple list anywhere we found) —
// this is a documented simplification, not a discovered API.
const KNOWN_BANKS = [
  'RolandTR909',
  'RolandTR808',
  'RolandTR707',
  'RolandTR606',
  'AkaiLinn',
  'AkaiXR10',
  'BossDR55',
  'BossDR110',
  'KorgKR55',
  'KorgM1',
  'RhythmAce',
];

const SAMPLE_CALLS = new Set(['s', 'sound']);
const SCALE_CALLS = new Set(['scale']);
const BANK_CALLS = new Set(['bank']);

function toCompletions(names: string[], type: string): Completion[] {
  return names.map((name) => ({ label: name, type, apply: name }));
}

/** Sample names inside s("…")/sound("…"), scale names inside scale("…"),
 * bank names inside bank("…") — DESIGN.md §6 Tier 1, item 2. Sample names are
 * read live off the sound registry (whatever samples() actually loaded), not
 * a static guess. */
export function contextStringCompletions(context: CompletionContext): CompletionResult | null {
  if (!isInsideString(context)) return null;
  const call = enclosingCallName(context);
  if (!call) return null;

  let options: Completion[] | null = null;
  if (SAMPLE_CALLS.has(call)) options = toCompletions(loadedSampleNames(), 'constant');
  else if (SCALE_CALLS.has(call)) options = toCompletions(ScaleType.names(), 'keyword');
  else if (BANK_CALLS.has(call)) options = toCompletions(KNOWN_BANKS, 'constant');
  if (!options) return null;

  const word = context.matchBefore(/[\w#]*/);
  const from = word ? word.from : context.pos;
  return { from, options, validFor: /^[\w#]*$/ };
}
