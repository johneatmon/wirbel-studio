import { describe, expect, it } from 'vitest';
import { normalizeGhostSuggestion, normalizeRiffSuggestion, formatRiffInsert } from './ghost-client';

describe('normalizeGhostSuggestion', () => {
  it('removes markdown fences and limits output to two lines', () => {
    expect(
      normalizeGhostSuggestion('```js\n.lpf(900)\n.gain(0.3)\n.room(0.2)\n```', 'note("c3")'),
    ).toBe('.lpf(900)\n.gain(0.3)');
  });

  it('removes an echoed current line', () => {
    expect(normalizeGhostSuggestion('note("c3").s("triangle")', 'note("c3")')).toBe(
      '.s("triangle")',
    );
  });

  it('keeps leading newlines and indentation used by chain continuations', () => {
    expect(normalizeGhostSuggestion('\n  .lpf(1200)', 'note("c3")')).toBe('\n  .lpf(1200)');
  });
});

describe('normalizeRiffSuggestion', () => {
  it('strips fences, $: prefixes, and extra lines', () => {
    expect(normalizeRiffSuggestion('```js\n$: s("hh*8").gain(0.2)\n```')).toBe(
      's("hh*8").gain(0.2)',
    );
  });

  it('prefixes accepted riffs with $:', () => {
    expect(formatRiffInsert('s("hh*8")\n  .gain(0.2)')).toBe('$: s("hh*8")\n  .gain(0.2)');
  });
});
