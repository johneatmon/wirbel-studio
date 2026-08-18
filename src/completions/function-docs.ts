import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import docsJson from './strudel-docs.json';
import { isInsideString } from './syntax-utils';

interface DocEntry {
  name: string;
  aliases: string[];
  memberOf: string | null;
  summary: string;
  examples: string[];
}

const entries = docsJson as DocEntry[];

function buildInfo(entry: DocEntry): () => HTMLElement {
  return () => {
    const el = document.createElement('div');
    el.className = 'max-w-sm space-y-1.5 p-2 text-xs';

    const summary = document.createElement('div');
    summary.className = 'text-neutral-300';
    summary.textContent = entry.summary;
    el.appendChild(summary);

    for (const example of entry.examples.slice(0, 2)) {
      const pre = document.createElement('pre');
      pre.className = 'overflow-x-auto rounded bg-neutral-900 p-1.5 font-mono text-emerald-300';
      pre.textContent = example;
      el.appendChild(pre);
    }

    return el;
  };
}

const completions: Completion[] = [];
const seenLabels = new Set<string>();
for (const entry of entries) {
  const info = buildInfo(entry);
  for (const alias of entry.aliases) {
    if (seenLabels.has(alias)) continue;
    seenLabels.add(alias);
    completions.push({
      label: alias,
      type: 'function',
      detail: entry.memberOf ? `${entry.memberOf}.${alias}` : undefined,
      info,
    });
  }
}

/** Doc-JSON completions (DESIGN.md §6 Tier 1, item 1) — every documented
 * Strudel function/method, vendored at build time via
 * scripts/extract-strudel-docs.mjs. Suppressed inside string literals, where
 * context-aware completions (function-docs' sibling, context-strings.ts) take
 * over instead. */
export function functionDocCompletions(context: CompletionContext): CompletionResult | null {
  if (isInsideString(context)) return null;
  const word = context.matchBefore(/\w+/);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  return { from: word.from, options: completions, validFor: /^\w*$/ };
}
