import { describe, expect, it } from 'vitest';
import { renderBlock } from './render';
import { acidBass } from './defs/acid-bass';

describe('renderBlock', () => {
  it('is deterministic for the same (def, slots)', () => {
    const slots = { note: 'c2 c3', cutoff: 900, res: 10 };
    const a = renderBlock(acidBass, slots);
    const b = renderBlock(acidBass, slots);
    expect(a.text).toBe(b.text);
  });

  it('wraps the header/footer sentinels around the body', () => {
    const slots = { note: 'c2 c3', cutoff: 900, res: 10 };
    const { text } = renderBlock(acidBass, slots);
    expect(text.startsWith(`// @block acid-bass ${JSON.stringify(slots)}\n`)).toBe(true);
    expect(text.endsWith('\n// @end')).toBe(true);
  });

  it('prefixes the body with `$: ` so multiple blocks auto-stack instead of the last one winning', () => {
    const slots = { note: 'c2 c3', cutoff: 900, res: 10 };
    const { text, bodyFrom } = renderBlock(acidBass, slots);
    expect(text.slice(bodyFrom - 3, bodyFrom)).toBe('$: ');
  });

  it('computes slot ranges that slice out exactly the rendered slot text', () => {
    const slots = { note: 'c2 c3', cutoff: 900, res: 10 };
    const { text, slotRanges } = renderBlock(acidBass, slots);
    const byKey = Object.fromEntries(slotRanges.map((r) => [r.key, r]));
    expect(text.slice(byKey.note.from, byKey.note.to)).toBe(JSON.stringify(slots.note));
    expect(text.slice(byKey.cutoff.from, byKey.cutoff.to)).toBe(String(slots.cutoff));
    expect(text.slice(byKey.res.from, byKey.res.to)).toBe(String(slots.res));
  });

  it('bodyFrom/bodyTo bound exactly the region between the sentinels', () => {
    const slots = { note: 'c2 c3', cutoff: 900, res: 10 };
    const { text, bodyFrom, bodyTo } = renderBlock(acidBass, slots);
    const header = `// @block acid-bass ${JSON.stringify(slots)}\n$: `;
    expect(bodyFrom).toBe(header.length);
    expect(text.slice(bodyTo)).toBe('\n// @end');
  });
});
