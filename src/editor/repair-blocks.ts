import type { EditorView } from '@codemirror/view';
import { blocksField } from './blocks-field';
import { blockEdit } from './enforce-locks';
import { getBlock } from '../blocks/registry';
import { renderBlock } from '../blocks/render';

/**
 * Invariant #2: the header JSON is the canonical slot state. If a region's
 * text doesn't match what render(def, slots) produces — e.g. it was hand-
 * edited outside the app, or pasted in from somewhere else — replace the
 * whole region with the canonical render. Call once after the doc loads;
 * enforceLocks keeps the invariant holding after that.
 */
export function repairBlocks(view: EditorView): void {
  const blocks = view.state.field(blocksField);
  const changes: { from: number; to: number; insert: string }[] = [];
  for (const block of blocks) {
    const def = getBlock(block.defId);
    if (!def) continue;
    const rendered = renderBlock(def, block.slots);
    const actual = view.state.sliceDoc(block.from, block.to);
    if (actual !== rendered.text) {
      changes.push({ from: block.from, to: block.to, insert: rendered.text });
    }
  }
  if (changes.length) {
    view.dispatch({ changes, annotations: [blockEdit.of('repair')] });
  }
}
