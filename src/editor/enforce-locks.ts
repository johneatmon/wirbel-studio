import { EditorState, Annotation } from '@codemirror/state';
import { blocksField } from './blocks-field';

export const blockEdit = Annotation.define<'slot' | 'insert' | 'eject' | 'delete' | 'repair'>();

/**
 * The whole security model in one transactionFilter: any edit that partially
 * overlaps a block region (touches it without covering it exactly) is
 * dropped. Whole-region replace/delete is allowed — that's what makes
 * selecting a block and hitting backspace behave like deleting one atom, and
 * it's exactly what blockAtomicRanges makes the selection do anyway.
 * Programmatic edits (setSlot/insertBlock/ejectBlock/repair) carry a
 * `blockEdit` annotation that bypasses this check entirely.
 *
 * `touches` uses <=/>= (not strict) deliberately: block.from/block.to are
 * exact line boundaries (the header and `// @end` lines own their lines), so
 * a zero-width insert sitting *exactly* at either edge would still land on
 * the sentinel line and corrupt its regex match — e.g. typing at block.from
 * prepends onto `// @block …`, breaking parseBlocks' HEADER match. A fuzz
 * test (see enforce-locks.test.ts) caught this with strict </> before it
 * shipped.
 */
export const enforceLocks = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged || tr.annotation(blockEdit)) return tr;
  const blocks = tr.startState.field(blocksField);
  let illegal = false;
  tr.changes.iterChangedRanges((fromA, toA) => {
    for (const b of blocks) {
      const touches = fromA <= b.to && toA >= b.from;
      const coversWhole = fromA <= b.from && toA >= b.to;
      if (touches && !coversWhole) illegal = true;
    }
  });
  return illegal ? [] : tr;
});
