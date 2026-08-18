import { EditorView, Decoration, WidgetType } from '@codemirror/view';
import { RangeSetBuilder, type EditorState, type Range } from '@codemirror/state';
import { blocksField, type BlockInstance } from './blocks-field';
import { registry } from '../blocks/registry';
import { ejectBlock } from './block-commands';
import { SlotChipWidget } from './slot-chips';

class BlockHeaderWidget extends WidgetType {
  block: BlockInstance;

  constructor(block: BlockInstance) {
    super();
    this.block = block;
  }

  eq(other: BlockHeaderWidget): boolean {
    return (
      other.block.defId === this.block.defId &&
      JSON.stringify(other.block.slots) === JSON.stringify(this.block.slots)
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const def = registry.get(this.block.defId);
    const bar = document.createElement('div');
    bar.className =
      'flex items-center justify-between gap-2 rounded-t bg-neutral-800 px-2 py-1 text-xs select-none';

    const label = document.createElement('span');
    label.className = 'font-medium text-neutral-300';
    label.textContent = def ? `${def.name} · ${def.category}` : this.block.defId;
    bar.appendChild(label);

    const eject = document.createElement('button');
    eject.type = 'button';
    eject.textContent = 'eject';
    eject.className =
      'rounded px-1.5 py-0.5 text-neutral-500 hover:bg-neutral-700 hover:text-neutral-200';
    eject.onclick = (e) => {
      e.preventDefault();
      ejectBlock(view, this.block);
    };
    bar.appendChild(eject);

    return bar;
  }

  ignoreEvent(): boolean {
    // let clicks on the eject button through instead of CM6 swallowing them
    return false;
  }
}

// Header widget, body line styling, and slot chips all interleave in
// position order within a block's body — a single RangeSetBuilder requires
// strictly ascending add() calls, which per-concern loops can't guarantee.
// Decoration.set's sort flag sidesteps that entirely.
function buildDecorations(state: EditorState) {
  const decos: Range<Decoration>[] = [];
  for (const block of state.field(blocksField)) {
    const def = registry.get(block.defId);
    const headerLine = state.doc.lineAt(block.from);
    decos.push(
      Decoration.replace({ widget: new BlockHeaderWidget(block), inclusive: false }).range(
        headerLine.from,
        headerLine.to,
      ),
    );
    for (let n = headerLine.number + 1; ; n++) {
      const line = state.doc.line(n);
      if (line.from >= block.to) break;
      decos.push(
        Decoration.line({ class: 'bg-neutral-900/60 border-l-2 border-emerald-800/40 pl-2' }).range(
          line.from,
        ),
      );
      if (line.to >= block.to) break;
    }
    if (def) {
      for (const range of block.slotRanges) {
        const spec = def.slots.find((s) => s.key === range.key);
        if (!spec) continue;
        decos.push(
          Decoration.replace({ widget: new SlotChipWidget(block, spec), inclusive: false }).range(
            range.from,
            range.to,
          ),
        );
      }
    }
  }
  return Decoration.set(decos, true);
}

export const blockDecorations = EditorView.decorations.compute([blocksField], buildDecorations);

/** Cursor treats each whole region as one atom; arrow keys hop over it,
 * backspace at its edge selects/deletes the whole thing. */
export const blockAtomicRanges = EditorView.atomicRanges.of((view) => {
  const builder = new RangeSetBuilder<Decoration>();
  for (const block of view.state.field(blocksField)) {
    builder.add(block.from, block.to, Decoration.mark({}));
  }
  return builder.finish();
});
