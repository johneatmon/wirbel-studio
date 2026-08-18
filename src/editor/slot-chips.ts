import { EditorView, WidgetType } from '@codemirror/view';
import { blocksField, type BlockInstance } from './blocks-field';
import { setSlot } from './block-commands';
import { evaluateCode, onApply, previewSound } from '../audio/engine';
import { useAppStore } from '../store/app-store';
import type { SlotSpec, SlotValue } from '../blocks/protocol';

const chipKeyFor = (block: BlockInstance, key: string) => `${block.from}:${key}`;

/** Only the chip currently being dragged bypasses eq()'s value comparison —
 * see SlotChipWidget.eq for why. */
let draggingChipKey: string | null = null;

/** block.from is stable across a drag on the same block: setSlot always
 * replaces starting exactly at that position, so only block.to can shift. */
function resolveLatestBlock(view: EditorView, block: BlockInstance): BlockInstance {
  return view.state.field(blocksField).find((b) => b.from === block.from) ?? block;
}

function commit(view: EditorView, block: BlockInstance, key: string, value: SlotValue): void {
  const latest = resolveLatestBlock(view, block);
  setSlot(view, latest, key, value);
  const quantize = useAppStore.getState().quantize;
  evaluateCode(view.state.doc.toString(), quantize).catch(() => {});
}

function decimalsForStep(step: number): number {
  const s = String(step);
  const i = s.indexOf('.');
  return i === -1 ? 0 : s.length - i - 1;
}

function formatNumber(spec: Extract<SlotSpec, { kind: 'number' }>, value: number): string {
  return value.toFixed(decimalsForStep(spec.step)) + (spec.unit ?? '');
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

const DRAG_PIXELS_PER_RANGE = 200;

function applyNumberDelta(
  spec: Extract<SlotSpec, { kind: 'number' }>,
  base: number,
  deltaPx: number,
  multiplier: number,
): number {
  const raw =
    spec.scale === 'log'
      ? (() => {
          const logMin = Math.log(spec.min);
          const logMax = Math.log(spec.max);
          const t = (Math.log(base) - logMin) / (logMax - logMin);
          const nextT = clamp(t + (deltaPx * multiplier) / DRAG_PIXELS_PER_RANGE, 0, 1);
          return Math.exp(logMin + nextT * (logMax - logMin));
        })()
      : (() => {
          const t = (base - spec.min) / (spec.max - spec.min);
          const nextT = clamp(t + (deltaPx * multiplier) / DRAG_PIXELS_PER_RANGE, 0, 1);
          return spec.min + nextT * (spec.max - spec.min);
        })();
  const stepped = Math.round(raw / spec.step) * spec.step;
  return clamp(Number(stepped.toFixed(6)), spec.min, spec.max);
}

function eventMultiplier(e: { shiftKey: boolean; altKey: boolean }): number {
  return e.shiftKey ? 0.1 : e.altKey ? 10 : 1;
}

const CHIP_CLASS =
  'inline-flex items-center gap-1 rounded bg-neutral-800 px-1.5 py-0.5 text-emerald-300 hover:bg-neutral-700';

function makePendingRing(): HTMLSpanElement {
  const ring = document.createElement('span');
  ring.className = 'inline-block h-1.5 w-1.5 rounded-full';
  ring.style.background = 'conic-gradient(#34d399 calc(var(--phase, 0) * 1turn), transparent 0)';
  ring.style.opacity = '0';
  ring.style.transition = 'opacity 120ms ease-out';
  return ring;
}

/** Popovers are appended to document.body (not the chip) so they escape the
 * editor's overflow:auto scroll container instead of being clipped. */
function positionPopover(popover: HTMLElement, anchor: HTMLElement): void {
  const rect = anchor.getBoundingClientRect();
  popover.style.position = 'fixed';
  popover.style.left = `${rect.left}px`;
  popover.style.top = `${rect.bottom + 4}px`;
  popover.style.zIndex = '50';
}

function closeOnOutsideClick(popover: HTMLElement, onClose: () => void): () => void {
  const handler = (e: PointerEvent) => {
    if (!popover.contains(e.target as Node)) onClose();
  };
  // deferred so the click that opened the popover doesn't immediately close it
  const timer = window.setTimeout(() => document.addEventListener('pointerdown', handler, true), 0);
  return () => {
    window.clearTimeout(timer);
    document.removeEventListener('pointerdown', handler, true);
  };
}

function renderNumberChip(
  view: EditorView,
  block: BlockInstance,
  spec: Extract<SlotSpec, { kind: 'number' }>,
): { el: HTMLElement; destroy: () => void } {
  const chip = document.createElement('span');
  chip.className = CHIP_CLASS + ' cursor-ew-resize font-mono';
  chip.title = `${spec.label} — drag to scrub, wheel to nudge, shift=fine, alt=coarse, dblclick to type`;

  const ring = makePendingRing();
  const valueEl = document.createElement('span');
  let value = block.slots[spec.key] as number;
  valueEl.textContent = formatNumber(spec, value);
  chip.append(ring, valueEl);

  const setPending = (p: boolean) => {
    ring.style.opacity = p ? '1' : '0';
  };
  const unsubApply = onApply(() => setPending(false));

  let dragStartX = 0;
  let dragStartValue = value;
  let lastDispatch = 0;
  const key = chipKeyFor(block, spec.key);

  const doCommit = () => {
    commit(view, block, spec.key, value);
    setPending(true);
  };

  const onPointerDown = (e: PointerEvent) => {
    e.preventDefault();
    chip.setPointerCapture(e.pointerId);
    draggingChipKey = key;
    dragStartX = e.clientX;
    dragStartValue = value;
    document.body.style.cursor = 'ew-resize';
  };
  const onPointerMove = (e: PointerEvent) => {
    if (draggingChipKey !== key) return;
    const dx = e.clientX - dragStartX;
    const next = applyNumberDelta(spec, dragStartValue, dx, eventMultiplier(e));
    if (next === value) return;
    value = next;
    valueEl.textContent = formatNumber(spec, value);
    const now = performance.now();
    if (now - lastDispatch >= 33) {
      lastDispatch = now;
      doCommit();
    }
  };
  const endDrag = () => {
    if (draggingChipKey !== key) return;
    draggingChipKey = null;
    document.body.style.cursor = '';
    doCommit(); // ensure the final value lands even if the throttle skipped it
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const dir = e.deltaY < 0 ? 1 : -1;
    value = clamp(value + dir * spec.step * eventMultiplier(e), spec.min, spec.max);
    valueEl.textContent = formatNumber(spec, value);
    doCommit();
  };

  let inputCleanup: (() => void) | null = null;
  const onDblClick = () => {
    inputCleanup?.();
    const input = document.createElement('input');
    input.type = 'number';
    input.min = String(spec.min);
    input.max = String(spec.max);
    input.step = String(spec.step);
    input.value = String(value);
    input.className = 'w-16 rounded bg-neutral-900 px-1 text-emerald-200 outline-none';
    const commitInput = () => {
      const parsed = clamp(Number(input.value), spec.min, spec.max);
      if (Number.isFinite(parsed)) {
        value = parsed;
        commit(view, block, spec.key, value);
      }
      input.replaceWith(valueEl);
      inputCleanup = null;
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commitInput();
      if (e.key === 'Escape') {
        input.replaceWith(valueEl);
        inputCleanup = null;
      }
    });
    input.addEventListener('blur', commitInput);
    valueEl.replaceWith(input);
    input.focus();
    input.select();
    inputCleanup = () => input.replaceWith(valueEl);
  };

  chip.addEventListener('pointerdown', onPointerDown);
  chip.addEventListener('pointermove', onPointerMove);
  chip.addEventListener('pointerup', endDrag);
  chip.addEventListener('pointercancel', endDrag);
  chip.addEventListener('wheel', onWheel, { passive: false });
  chip.addEventListener('dblclick', onDblClick);

  return {
    el: chip,
    destroy: () => {
      unsubApply();
      inputCleanup?.();
    },
  };
}

function renderEnumChip(
  view: EditorView,
  block: BlockInstance,
  spec: Extract<SlotSpec, { kind: 'enum' }>,
): { el: HTMLElement; destroy: () => void } {
  const chip = document.createElement('span');
  chip.className = CHIP_CLASS + ' cursor-pointer';
  let value = block.slots[spec.key] as string;
  const valueEl = document.createElement('span');
  valueEl.textContent = value;
  chip.appendChild(valueEl);

  const previewable = spec.key === 'bank' || spec.key === 'wave';
  let closePopover: (() => void) | null = null;

  const openPopover = () => {
    if (closePopover) {
      closePopover();
      return;
    }
    const popover = document.createElement('div');
    popover.className =
      'flex flex-col rounded border border-neutral-700 bg-neutral-800 py-1 text-xs shadow-lg';
    positionPopover(popover, chip);

    for (const option of spec.options) {
      const row = document.createElement('div');
      row.className =
        'flex cursor-pointer items-center justify-between gap-3 px-2 py-1 hover:bg-neutral-700';
      const label = document.createElement('span');
      label.textContent = option;
      label.className = option === value ? 'text-emerald-300' : 'text-neutral-300';
      row.appendChild(label);
      row.addEventListener('click', () => {
        value = option;
        valueEl.textContent = value;
        commit(view, block, spec.key, value);
        closePopover?.();
      });
      if (previewable) {
        const preview = document.createElement('button');
        preview.type = 'button';
        preview.textContent = '▸';
        preview.className = 'px-1 text-neutral-500 hover:text-emerald-400';
        preview.addEventListener('click', (e) => {
          e.stopPropagation();
          previewSound(spec.key === 'bank' ? { s: 'bd', bank: option } : { s: option, note: 'c4' });
        });
        row.appendChild(preview);
      }
      popover.appendChild(row);
    }

    document.body.appendChild(popover);
    const removeOutsideListener = closeOnOutsideClick(popover, () => closePopover?.());
    closePopover = () => {
      removeOutsideListener();
      popover.remove();
      closePopover = null;
    };
  };

  chip.addEventListener('click', openPopover);

  return { el: chip, destroy: () => closePopover?.() };
}

function renderMiniChip(
  view: EditorView,
  block: BlockInstance,
  spec: Extract<SlotSpec, { kind: 'mini' }>,
): { el: HTMLElement; destroy: () => void } {
  const chip = document.createElement('span');
  chip.className = CHIP_CLASS + ' cursor-pointer font-mono';
  let value = block.slots[spec.key] as string;
  const valueEl = document.createElement('span');
  valueEl.textContent = value;
  chip.appendChild(valueEl);

  let closePopover: (() => void) | null = null;

  const openPopover = () => {
    if (closePopover) return;
    const popover = document.createElement('div');
    popover.className = 'rounded border border-neutral-700 bg-neutral-800 p-1 shadow-lg';
    positionPopover(popover, chip);

    const input = document.createElement('input');
    input.type = 'text';
    input.value = value;
    input.className =
      'w-56 rounded bg-neutral-900 px-1.5 py-0.5 font-mono text-xs text-emerald-200 outline-none';
    const commitInput = () => {
      value = input.value;
      valueEl.textContent = value;
      commit(view, block, spec.key, value);
      closePopover?.();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commitInput();
      if (e.key === 'Escape') closePopover?.();
    });
    input.addEventListener('blur', commitInput);
    popover.appendChild(input);

    document.body.appendChild(popover);
    input.focus();
    input.select();
    const removeOutsideListener = closeOnOutsideClick(popover, () => closePopover?.());
    closePopover = () => {
      removeOutsideListener();
      popover.remove();
      closePopover = null;
    };
  };

  chip.addEventListener('click', openPopover);

  return { el: chip, destroy: () => closePopover?.() };
}

export class SlotChipWidget extends WidgetType {
  block: BlockInstance;
  spec: SlotSpec;
  private destroyFn: (() => void) | null = null;

  constructor(block: BlockInstance, spec: SlotSpec) {
    super();
    this.block = block;
    this.spec = spec;
  }

  eq(other: SlotChipWidget): boolean {
    const key = chipKeyFor(this.block, this.spec.key);
    // The chip actively being dragged must keep its DOM node (and therefore
    // its live setPointerCapture) across every throttled setSlot dispatch —
    // otherwise each mid-drag rebuild would cancel the drag.
    if (draggingChipKey === key) return true;
    return (
      other.block.defId === this.block.defId &&
      other.spec.key === this.spec.key &&
      JSON.stringify(other.block.slots) === JSON.stringify(this.block.slots)
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const result =
      this.spec.kind === 'number'
        ? renderNumberChip(view, this.block, this.spec)
        : this.spec.kind === 'enum'
          ? renderEnumChip(view, this.block, this.spec)
          : renderMiniChip(view, this.block, this.spec);
    this.destroyFn = result.destroy;
    return result.el;
  }

  destroy(): void {
    this.destroyFn?.();
  }

  ignoreEvent(): boolean {
    return false;
  }
}
