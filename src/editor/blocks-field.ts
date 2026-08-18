import { StateField, type Text } from '@codemirror/state';
import { getBlock } from '../blocks/registry';
import { renderBlock } from '../blocks/render';
import type { SlotValue } from '../blocks/protocol';

export interface BlockInstance {
  defId: string;
  slots: Record<string, SlotValue>;
  from: number;
  to: number;
  bodyFrom: number;
  bodyTo: number;
  slotRanges: { key: string; from: number; to: number }[];
}

const HEADER = /^\/\/ @block (\S+) (\{.*\})$/;

function parseBlocks(doc: Text): BlockInstance[] {
  const out: BlockInstance[] = [];
  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const m = HEADER.exec(line.text);
    if (!m) continue;
    const def = getBlock(m[1]);
    if (!def) continue; // unknown block id: leave as plain code
    let slots: Record<string, SlotValue>;
    try {
      slots = JSON.parse(m[2]);
    } catch {
      continue;
    }

    // Locate '// @end' (bounded scan; bail after 50 lines = malformed).
    let endLine = -1;
    for (let j = i + 1; j <= Math.min(doc.lines, i + 50); j++) {
      if (doc.line(j).text === '// @end') {
        endLine = j;
        break;
      }
    }
    if (endLine === -1) continue;

    // Invariant #1: recompute ranges from the render, not from the doc text.
    const r = renderBlock(def, slots);
    out.push({
      defId: def.id,
      slots,
      from: line.from,
      to: doc.line(endLine).to,
      bodyFrom: line.from + r.bodyFrom,
      bodyTo: line.from + r.bodyTo,
      slotRanges: r.slotRanges.map((s) => ({
        key: s.key,
        from: line.from + s.from,
        to: line.from + s.to,
      })),
    });
    i = endLine;
  }
  return out;
}

export const blocksField = StateField.define<BlockInstance[]>({
  create: (state) => parseBlocks(state.doc),
  update: (value, tr) => (tr.docChanged ? parseBlocks(tr.newDoc) : value),
});
