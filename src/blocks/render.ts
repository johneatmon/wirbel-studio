import type { BlockDef, SlotValue } from './protocol';

export interface Rendered {
  /** Full region text, including the `// @block ... {…}` and `// @end` sentinels. */
  text: string;
  /** Region-relative slot value ranges. */
  slotRanges: { key: string; from: number; to: number }[];
  /** Region-relative body bounds (between the sentinels). */
  bodyFrom: number;
  bodyTo: number;
}

/**
 * Deterministic: same (def, slots) always produces the same text and the
 * same offsets. Offsets are computed from this render, never parsed back out
 * of the document — that's what makes the block region's ranges trustworthy
 * even if the surrounding doc has been edited elsewhere.
 */
export function renderBlock(def: BlockDef, slots: Record<string, SlotValue>): Rendered {
  const header = `// @block ${def.id} ${JSON.stringify(slots)}\n`;
  // `$: ` makes each block its own auto-numbered stack slot (real Strudel
  // syntax, not our own convention) — without it, only the document's LAST
  // top-level expression would ever actually play, silently dropping every
  // other block whenever more than one is present.
  let text = header + '$: ';
  const slotRanges: Rendered['slotRanges'] = [];
  const bodyFrom = text.length;
  for (const seg of def.body(slots)) {
    if (typeof seg === 'string') {
      text += seg;
      continue;
    }
    slotRanges.push({ key: seg.slot, from: text.length, to: text.length + seg.text.length });
    text += seg.text;
  }
  const bodyTo = text.length;
  text += '\n// @end';
  return { text, slotRanges, bodyFrom, bodyTo };
}
