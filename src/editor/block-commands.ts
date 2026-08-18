import type { EditorView } from '@codemirror/view';
import type { BlockInstance } from './blocks-field';
import { blockEdit } from './enforce-locks';
import { registry } from '../blocks/registry';
import { renderBlock } from '../blocks/render';
import type { SlotValue } from '../blocks/protocol';

export function setSlot(
  view: EditorView,
  block: BlockInstance,
  key: string,
  value: SlotValue,
): void {
  const def = registry.get(block.defId);
  if (!def) return;
  const next = { ...block.slots, [key]: value };
  const { text } = renderBlock(def, next);
  view.dispatch({
    changes: { from: block.from, to: block.to, insert: text },
    annotations: [blockEdit.of('slot')],
    userEvent: 'input.slot',
  });
}

export function insertBlock(view: EditorView, defId: string, pos?: number): void {
  const def = registry.get(defId);
  if (!def) return;
  const slots = Object.fromEntries(def.slots.map((s) => [s.key, s.default])) as Record<
    string,
    SlotValue
  >;
  const { text } = renderBlock(def, slots);
  const at = pos ?? view.state.doc.length;
  const lead = at > 0 && view.state.sliceDoc(at - 1, at) !== '\n' ? '\n\n' : '';
  view.dispatch({
    changes: { from: at, insert: `${lead}${text}\n` },
    annotations: [blockEdit.of('insert')],
    userEvent: 'input.block',
  });
}

export function ejectBlock(view: EditorView, block: BlockInstance): void {
  const body = view.state.sliceDoc(block.bodyFrom, block.bodyTo);
  view.dispatch({
    changes: { from: block.from, to: block.to, insert: body },
    annotations: [blockEdit.of('eject')],
    userEvent: 'delete.eject',
    selection: { anchor: block.from },
  });
}
