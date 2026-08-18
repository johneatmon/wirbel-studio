import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { blocksField } from './blocks-field';
import { blockEdit, enforceLocks } from './enforce-locks';
import { renderBlock } from '../blocks/render';
import { acidBass } from '../blocks/defs/acid-bass';

const SLOTS = { note: 'c2 c3', cutoff: 900, res: 10 };
const BLOCK_TEXT = renderBlock(acidBass, SLOTS).text;
const LEADING_CODE = 's("hh*8")';
const TRAILING_CODE = 's("bd*4")';
const DOC = `${LEADING_CODE}\n\n${BLOCK_TEXT}\n\n${TRAILING_CODE}`;

function makeState() {
  return EditorState.create({ doc: DOC, extensions: [blocksField, enforceLocks] });
}

function block(state: EditorState) {
  const b = state.field(blocksField)[0];
  if (!b) throw new Error('expected a parsed block');
  return b;
}

describe('blocksField', () => {
  it('parses the block region with correctly-computed ranges', () => {
    const state = makeState();
    const b = block(state);
    expect(b.defId).toBe('acid-bass');
    expect(state.sliceDoc(b.from, b.to)).toBe(BLOCK_TEXT);
    expect(state.sliceDoc(0, b.from)).toBe(`${LEADING_CODE}\n\n`);
    expect(state.sliceDoc(b.to)).toBe(`\n\n${TRAILING_CODE}`);
  });
});

describe('enforceLocks', () => {
  it('drops an edit fully inside the body (unannotated)', () => {
    const state = makeState();
    const b = block(state);
    const midpoint = Math.floor((b.bodyFrom + b.bodyTo) / 2);
    const tr = state.update({ changes: { from: midpoint, to: midpoint + 1, insert: 'X' } });
    expect(tr.state.doc.toString()).toBe(DOC); // dropped: unchanged
  });

  it('drops an edit that straddles the start boundary (partial overlap)', () => {
    const state = makeState();
    const b = block(state);
    const tr = state.update({ changes: { from: b.from - 2, to: b.from + 2, insert: 'XXXX' } });
    expect(tr.state.doc.toString()).toBe(DOC);
  });

  it('drops an edit that straddles the end boundary (partial overlap)', () => {
    const state = makeState();
    const b = block(state);
    const tr = state.update({ changes: { from: b.to - 2, to: b.to + 2, insert: 'XXXX' } });
    expect(tr.state.doc.toString()).toBe(DOC);
  });

  it('allows an exact whole-region replace, unannotated', () => {
    const state = makeState();
    const b = block(state);
    const tr = state.update({ changes: { from: b.from, to: b.to, insert: '// deleted' } });
    expect(tr.state.doc.toString()).not.toBe(DOC);
    expect(tr.state.doc.toString()).toContain('// deleted');
    expect(tr.state.doc.toString()).not.toContain('@block');
  });

  it('allows an edit fully outside the block region', () => {
    const state = makeState();
    const b = block(state);
    const tr = state.update({ changes: { from: b.to + 2, to: b.to + 2, insert: 'y' } });
    expect(tr.state.doc.toString()).not.toBe(DOC);
  });

  it('drops a zero-width insert exactly at the start boundary (would prepend onto the header line)', () => {
    const state = makeState();
    const b = block(state);
    const tr = state.update({ changes: { from: b.from, to: b.from, insert: 'Z' } });
    expect(tr.state.doc.toString()).toBe(DOC);
  });

  it('drops a zero-width insert exactly at the end boundary (would append onto the `// @end` line)', () => {
    const state = makeState();
    const b = block(state);
    const tr = state.update({ changes: { from: b.to, to: b.to, insert: 'Z' } });
    expect(tr.state.doc.toString()).toBe(DOC);
  });

  it('allows a partial-looking edit when annotated with blockEdit (programmatic commands bypass the check)', () => {
    const state = makeState();
    const b = block(state);
    const midpoint = Math.floor((b.bodyFrom + b.bodyTo) / 2);
    const tr = state.update({
      changes: { from: midpoint, to: midpoint + 1, insert: 'X' },
      annotations: [blockEdit.of('slot')],
    });
    expect(tr.state.doc.toString()).not.toBe(DOC);
  });

  it('survives 200 randomized adversarial transactions without ever landing a partial-overlap edit', () => {
    let state = makeState();
    let seed = 42;
    const rand = () => {
      // deterministic LCG so failures are reproducible
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = 0; i < 200; i++) {
      const b = block(state);
      const len = state.doc.length;
      const from = Math.floor(rand() * len);
      const to = Math.min(len, from + Math.floor(rand() * 8));
      const insert = rand() < 0.5 ? '' : 'Z'.repeat(Math.floor(rand() * 4));
      const touches = from <= b.to && to >= b.from;
      const coversWhole = from <= b.from && to >= b.to;
      const shouldBeIllegal = touches && !coversWhole;

      const before = state.doc.toString();
      const tr = state.update({ changes: { from, to, insert } });
      const changed = tr.state.doc.toString() !== before;

      if (shouldBeIllegal) {
        expect(changed, `iteration ${i}: from=${from} to=${to} should have been dropped`).toBe(
          false,
        );
      }
      state = tr.state;
    }
  });
});
