# Strudel Studio — Design Document

**Status:** Draft v2 · **Owner:** John / Nachtwerk · **Type:** Personal / portfolio build
**One-liner:** A session-oriented music production environment built on Strudel, where musicians launch composable clips, capture jams into arrangements, and progressively move from curated blocks to live code.

---

## 1. Vision & Non-Goals

### What this is

A browser-based Strudel environment where a beginner can make _good-sounding_ music in the first 90 seconds by launching curated clips into musical lanes, changing their parameter slots, and combining them into scenes. The session is playable like an instrument: every launch, stop, scene change, and edit is synchronized to the musical clock. A musician can then open any clip, eject its blocks into plain Strudel, capture a jam into an arrangement, and export the result.

The primary product surface is a **Session workspace**, inspired by clip-launching workflows rather than a left-to-right DAW timeline. The code editor remains fundamental, but it becomes the focused editor for a clip or generated arrangement instead of the only place where the whole song must live.

### Design principles (in priority order)

1. **One clock.** The audio scheduler is the single source of temporal truth. UI animation, evaluation flashes, slot-change application, and visuals all derive from cycle phase — never from `setInterval` or uncoordinated CSS animation. This is the load-bearing polish decision.
2. **Jam first, arrange second.** Starting and stopping clips must be immediate to understand, musically quantized, and recordable into a later arrangement.
3. **Every clip is valid Strudel.** Blocks are annotations over plain code, not a parallel musical format. A session can always be rendered to portable Strudel code.
4. **Progressive disclosure.** Session → clip → blocks → slots → eject → raw code. No cliff between "toy mode" and "real mode."
5. **Deterministic first, reactive second.** Visuals, arrangement capture, and export derive from pattern events and the scheduler clock; audio FFT is garnish.
6. **Local-first, zero backend for v1.** Projects live in IndexedDB and shareable URLs. The only optional backend is completion/proxy infrastructure.

### Non-goals (v1)

- No accounts, sharing backend, collaboration, or monetization.
- No live MIDI/OSC device routing in the first session milestone. Standard MIDI file import/export follows the session and arrangement core.
- No mobile-first design (desktop keyboard-first; must not be _broken_ on tablet).
- Not a Scratch clone — blocks are a scaffold inside a text editor, not a visual programming language.
- Not a full linear DAW in v1: no multitrack waveform editing, third-party plug-ins, or sample warping.

---

## 2. System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        React shell (Vite)                        │
│                                                                  │
│  ┌────────────────────┐   ┌──────────────┐   ┌───────────────┐  │
│  │ Session workspace  │   │ CodeMirror 6 │   │ Visual Canvas │  │
│  │ · lanes / clips    │   │ clip editor  │   │ · hap lane    │  │
│  │ · scenes           │   │ · blocks     │   │ · pianoroll   │  │
│  │ · launch state     │   │ · slots      │   │ · scope/FFT   │  │
│  │ · capture log      │   │ · completion │   └───────┬───────┘  │
│  └─────────┬──────────┘   └──────┬───────┘           │          │
│            │ active clip ids      │ clip source        │          │
│            └──────────────┬───────┘                    │          │
│                           ▼                            │          │
│  ┌────────────────────────────────────────┐          │          │
│  │ Session compiler                       │          │          │
│  │ active clips → valid stack(...) code   │          │          │
│  └─────────┬──────────────────────────────┘          │          │
│            ▼                                         │          │
│  ┌────────────────────────────────────────┐          │          │
│  │ Eval pipeline                         │          │          │
│  │ quantize → repl.evaluate → Pattern     │──────────┘          │
│  └─────────┬──────────────────────────────┘  queryArc(haps)     │
│            ▼                                                    │
│  ┌────────────────────────────────────────┐                     │
│  │ @strudel/web + Cyclist + superdough    │───► AnalyserNode    │
│  └─────────┬──────────────────────────────┘                     │
│            ▼                                                    │
│  ┌────────────────────────────────────────┐                     │
│  │ ClockStore — cycle, phase, cps          │──► UI, capture, rAF │
│  └────────────────────────────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
                     │ (optional, debounced)
                     ▼
        Anthropic API (ghost-text completion)  ← thin proxy or
                                                 direct w/ user key
```

### Stack

| Concern            | Choice                                                                       | Why                                                                              |
| ------------------ | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| App shell          | Vite + React 19 + TypeScript                                                 | Fast HMR matters for an audio app; no SSR needed                                 |
| Editor             | CodeMirror 6 (raw, not `@strudel/codemirror`)                                | Full control over decorations, atomic ranges, transaction filters                |
| Audio/patterns     | `@strudel/web` + `core` + `mini` + `transpiler` + `tonal` + `soundfonts`     | Headless; we own the UI. **Note: project lives at codeberg.org/uzu/strudel now** |
| Visuals            | Canvas 2D for lanes/pianoroll; optional regl (WebGL) layer for shader scenes | Canvas is enough for v1 and easier to keep at 60fps                              |
| State              | Zustand (session/project UI) + CM6 state (active clip source) + IndexedDB    | Session project is canonical; every clip source remains portable Strudel         |
| Styling            | Tailwind v4 + CSS custom properties driven by ClockStore                     | Phase-driven animation via `--phase`, `--beat` vars                              |
| Completion backend | Anthropic Messages API (Haiku-class model) via 20-line proxy                 | Personal use; latency > quality for ghost text                                   |

### Key upstream facts to design around

- Strudel's REPL is CodeMirror-based with a transpilation step for syntax sugar and highlighting; we reuse the transpiler but not their editor chrome.
- The transpiler emits source locations for mini-notation tokens — this is what powers Strudel's "which token is playing right now" highlighting, and we get it for free by evaluating through the same pipeline.
- Patterns are pure and queryable: `pattern.queryArc(begin, end)` returns the haps (events) in that window without playing them. This is the foundation of the deterministic visual system.
- Pin the Strudel version. Upstream moves; breaking changes across minor versions have happened historically.

---

## 3. Session, Clip, and Document Model

### 3.1 Project hierarchy

```ts
interface Project {
  id: string;
  name: string;
  tempo: number;
  launchQuantize: 'immediate' | 'beat' | 'cycle';
  lanes: Lane[];
  scenes: Scene[];
  arrangement: ArrangementEvent[];
}

interface Lane {
  id: string;
  name: string;
  role: 'drums' | 'bass' | 'harmony' | 'melody' | 'texture' | 'fx';
  clips: Clip[];
  gain: number;
  muted: boolean;
}

interface Clip {
  id: string;
  name: string;
  code: string; // valid Strudel expression; may contain locked block annotations
}
```

- A lane is a musical role and mixer channel. At most one clip per lane is active by default.
- Launching another clip in the same lane replaces the old one at the configured boundary.
- A scene selects zero or one clip from every lane and launches the selection atomically.
- Emptying the final active lane stops playback. Muting preserves launch state but removes the lane from the compiled mix.
- The session compiler renders active, unmuted clip expressions into `stack(...)`. The emitted program is ordinary Strudel and is the exact program passed to the eval pipeline.
- Capture records semantic actions (`launch`, `stop`, `mute`, slot change) with scheduler-cycle timestamps. It does not record wall-clock time.

### 3.2 Clip documents

**Decision: blocks are marked regions of real Strudel code, delimited by comment sentinels.** The editor renders decorations _over_ those regions; the code inside them is machine-generated from a template + slot values and is never hand-edited while locked.

```js
// @block acid-bass {"note":"c2","cutoff":800,"res":18}
note('c2 [c2 c3]*2 c2 [~ c2]').s('sawtooth').lpf(800).lpq(18).lpenv(4).lpattack(0.01);
// @end

// free code below — fully editable
$: s('bd*4').bank('RolandTR909');
```

### Why this beats the alternatives

| Approach                                           | Verdict                                                                                                                                                                          |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Comment-delimited regions (chosen)**          | Doc is always valid Strudel (comments are ignored by eval). Copy/paste, undo, URL persistence, and diffing all work with zero extra machinery. Eject = delete two comment lines. |
| B. Opaque placeholder tokens expanded at eval time | Doc is not valid Strudel; every consumer (eval, share, persistence) needs an expansion pass; undo history operates on a lie. Rejected.                                           |
| C. Separate block AST + generated code pane        | Two sources of truth; sync bugs are the whole job. Rejected.                                                                                                                     |

### Invariants

1. The body between `@block` and `@end` is always exactly `render(def, slots)` — byte-for-byte. Slot offsets are therefore _computed, never parsed_.
2. The JSON payload on the `@block` line is the canonical slot state. On load, bodies are re-rendered from it (self-healing if a body was hand-mangled outside the app).
3. A block region is atomic to the cursor and immune to direct edits, with exactly two escape hatches: whole-block deletion, and the eject command.

---

## 4. CM6 Extension Architecture (the deep dive)

Five cooperating extensions, in dependency order:

```
blocksField (StateField<BlockInstance[]>)     ← parses sentinels, computes ranges
   ├── enforceLocks (transactionFilter)       ← rejects illegal edits
   ├── blockDecorations (EditorView.decorations) ← chrome + slot widgets
   ├── blockAtomicRanges (EditorView.atomicRanges) ← cursor skips regions
   └── commands: insertBlock / ejectBlock / setSlot
```

### 4.1 Block definitions & deterministic rendering

The critical trick: a block's body is authored as **segments**, so rendering produces both the text and exact slot ranges in one pass. No regex, no parsing, no drift.

```ts
// blocks/protocol.ts
export type SlotValue = string | number;

export type SlotSpec =
  | {
      kind: 'number';
      key: string;
      label: string;
      min: number;
      max: number;
      step: number;
      default: number;
      scale?: 'linear' | 'log';
      unit?: string;
    }
  | { kind: 'enum'; key: string; label: string; options: readonly string[]; default: string }
  | { kind: 'mini'; key: string; label: string; default: string }; // mini-notation

export type Segment = string | { slot: string; text: string };

export interface BlockDef {
  id: string; // 'acid-bass'
  name: string; // 'Acid Bass'
  category: 'drums' | 'bass' | 'melody' | 'texture' | 'fx' | 'structure';
  description: string; // one-liner for the palette
  slots: SlotSpec[];
  /** Pure. Given slot values, emit body segments. */
  body: (s: Record<string, SlotValue>) => Segment[];
}

export const sl = (slot: string, v: SlotValue): Segment => ({
  slot,
  text: typeof v === 'string' ? JSON.stringify(v) : String(v),
});
```

```ts
// blocks/defs/acid-bass.ts
import type { BlockDef } from '../protocol';
import { sl } from '../protocol';

export const acidBass: BlockDef = {
  id: 'acid-bass',
  name: 'Acid Bass',
  category: 'bass',
  description: '303-style sawtooth line with filter envelope',
  slots: [
    { kind: 'mini', key: 'note', label: 'notes', default: 'c2 [c2 c3]*2 c2 [~ c2]' },
    {
      kind: 'number',
      key: 'cutoff',
      label: 'cutoff',
      min: 100,
      max: 8000,
      step: 1,
      default: 800,
      scale: 'log',
      unit: 'Hz',
    },
    { kind: 'number', key: 'res', label: 'reso', min: 0, max: 40, step: 1, default: 18 },
  ],
  body: (s) => [
    'note(',
    sl('note', s.note),
    ')\n',
    '  .s("sawtooth").lpf(',
    sl('cutoff', s.cutoff),
    ').lpq(',
    sl('res', s.res),
    ')\n',
    '  .lpenv(4).lpattack(0.01)',
  ],
};
```

```ts
// blocks/render.ts
export interface Rendered {
  text: string; // full region incl. sentinels
  slotRanges: { key: string; from: number; to: number }[]; // region-relative
  bodyFrom: number;
  bodyTo: number; // region-relative
}

export function renderBlock(def: BlockDef, slots: Record<string, SlotValue>): Rendered {
  const header = `// @block ${def.id} ${JSON.stringify(slots)}\n`;
  let text = header;
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
```

### 4.2 The state field

The doc is small (live-coding files are a few KB), so a full rescan per doc change is well under a millisecond — don't bother with incremental mapping until profiling says otherwise.

```ts
// editor/blocks-field.ts
import { StateField, Text } from '@codemirror/state';
import { registry } from '../blocks/registry';
import { renderBlock } from '../blocks/render';

export interface BlockInstance {
  defId: string;
  slots: Record<string, SlotValue>;
  from: number;
  to: number; // absolute region bounds (incl. sentinels)
  bodyFrom: number;
  bodyTo: number; // absolute
  slotRanges: { key: string; from: number; to: number }[]; // absolute
}

const HEADER = /^\/\/ @block (\S+) (\{.*\})$/;

function parseBlocks(doc: Text): BlockInstance[] {
  const out: BlockInstance[] = [];
  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const m = HEADER.exec(line.text);
    if (!m) continue;
    const def = registry.get(m[1]);
    if (!def) continue; // unknown block: leave as plain code
    let slots: Record<string, SlotValue>;
    try {
      slots = JSON.parse(m[2]);
    } catch {
      continue;
    }

    // Locate '// @end' (bounded scan; bail after 50 lines = malformed)
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
```

**Self-healing note (Invariant #2):** on document load, run a one-time normalization pass that re-renders every block body from its header JSON and dispatches a repair transaction if the body doesn't match. After that, `enforceLocks` guarantees the invariant holds, so `parseBlocks` can trust the render offsets.

### 4.3 Lock enforcement

A single `transactionFilter` is the whole security model. Programmatic edits (slot changes, insert, eject) carry an annotation that whitelists them.

```ts
// editor/enforce-locks.ts
import { EditorState, Annotation } from '@codemirror/state';
import { blocksField } from './blocks-field';

export const blockEdit = Annotation.define<'slot' | 'insert' | 'eject' | 'delete' | 'repair'>();

export const enforceLocks = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged || tr.annotation(blockEdit)) return tr;
  const blocks = tr.startState.field(blocksField);
  let illegal = false;
  tr.changes.iterChangedRanges((fromA, toA) => {
    for (const b of blocks) {
      const intersects = fromA < b.to && toA > b.from;
      const coversWhole = fromA <= b.from && toA >= b.to;
      if (intersects && !coversWhole) illegal = true; // partial edit → veto
    }
  });
  return illegal ? [] : tr; // returning [] silently drops the transaction
});
```

Whole-region deletion is deliberately allowed so that selecting a block and hitting backspace (or cutting it) behaves like deleting one atom — which is exactly what `atomicRanges` makes the selection do anyway. Undo/redo replays annotated transactions, so history "just works."

### 4.4 Decorations & atomic ranges

Three decoration layers per block: a header widget (replaces the ugly sentinel line with the block's title bar), slot widgets (replace raw values with interactive chips), and a line class on the body for the card background. Slots must be `Decoration.replace` — not `widget` — so the underlying text is hidden and the widget _is_ the value.

```ts
// editor/block-decorations.ts
import { EditorView, Decoration, WidgetType } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { blocksField, BlockInstance } from './blocks-field';
import { SlotChip } from './slot-chip'; // framework-agnostic DOM, or React portal
import { BlockHeader } from './block-header';

function buildDecos(state: EditorState) {
  const b = new RangeSetBuilder<Decoration>();
  for (const block of state.field(blocksField)) {
    const headerLine = state.doc.lineAt(block.from);
    b.add(
      headerLine.from,
      headerLine.to,
      Decoration.replace({ widget: new BlockHeader(block), inclusive: false }),
    );
    for (let l = headerLine.number + 1; ; l++) {
      // body card styling
      const line = state.doc.line(l);
      if (line.from >= block.to) break;
      b.add(line.from, line.from, Decoration.line({ class: 'cm-block-body' }));
      if (line.to >= block.to) break;
    }
    for (const s of block.slotRanges) {
      b.add(
        s.from,
        s.to,
        Decoration.replace({ widget: new SlotChip(block, s.key), inclusive: false }),
      );
    }
  }
  return b.finish();
}

export const blockDecorations = EditorView.decorations.compute([blocksField], buildDecos);

// Cursor treats each whole region as one atom; arrow keys hop over it,
// backspace at its edge selects/deletes the whole thing.
export const blockAtomicRanges = EditorView.atomicRanges.of((view) => {
  const b = new RangeSetBuilder<Decoration>();
  for (const block of view.state.field(blocksField))
    b.add(block.from, block.to, Decoration.mark({}));
  return b.finish();
});
```

### 4.5 Commands: setSlot, insertBlock, ejectBlock

```ts
// editor/block-commands.ts
import { EditorView } from '@codemirror/view';
import { blocksField, BlockInstance } from './blocks-field';
import { blockEdit } from './enforce-locks';
import { registry } from '../blocks/registry';
import { renderBlock } from '../blocks/render';

export function setSlot(view: EditorView, block: BlockInstance, key: string, value: SlotValue) {
  const def = registry.get(block.defId)!;
  const next = { ...block.slots, [key]: value };
  const { text } = renderBlock(def, next);
  view.dispatch({
    changes: { from: block.from, to: block.to, insert: text },
    annotations: [blockEdit.of('slot')],
    // scroll position and selection are preserved automatically since the
    // change is localized; add userEvent for undo grouping:
    userEvent: 'input.slot',
  });
}

export function insertBlock(view: EditorView, defId: string, pos?: number) {
  const def = registry.get(defId)!;
  const slots = Object.fromEntries(def.slots.map((s) => [s.key, s.default]));
  const { text } = renderBlock(def, slots);
  const at = pos ?? view.state.doc.length;
  const lead = at > 0 && view.state.doc.sliceString(at - 1, at) !== '\n' ? '\n\n' : '';
  view.dispatch({
    changes: { from: at, insert: `${lead}${text}\n` },
    annotations: [blockEdit.of('insert')],
    userEvent: 'input.block',
  });
}

export function ejectBlock(view: EditorView, block: BlockInstance) {
  const body = view.state.sliceDoc(block.bodyFrom, block.bodyTo);
  view.dispatch({
    changes: { from: block.from, to: block.to, insert: body },
    annotations: [blockEdit.of('eject')],
    userEvent: 'delete.eject',
    selection: { anchor: block.from }, // land the cursor on the freed code
  });
}
```

**Undo semantics worth noting:** because eject is a normal transaction, ⌘Z after eject restores the block — a lovely safety net for beginners ("I ejected too early") that costs zero extra code.

### 4.6 The slot chips (where the polish lives)

`SlotChip extends WidgetType`. Behavior by slot kind:

- **number** — a monospace value chip. `pointerdown` → `setPointerCapture`; horizontal drag maps px→value through the slot's scale (`log` for frequencies — one screen-inch should feel the same at 200 Hz as at 4 kHz). Shift = fine (0.1×), Alt = coarse (10×). Double-click → inline `<input type=number>`. Scroll-wheel nudges by `step`. Cursor becomes `ew-resize` with `document.body` cursor override during drag.
- **enum** — chip opens a small popover listbox (arrow keys + typeahead). For sample banks, each option row has a ▸ that _previews the sound_ via a one-shot superdough trigger.
- **mini** — a chip showing the mini-notation string; click opens a mini-editor popover: a single-line CM6 instance with mini-notation highlighting and a live step-sequencer strip underneath (each `~`/token toggleable). This is the beginner's rhythm editor.

**Audio application policy (ties to Principle 1):** drags dispatch `setSlot` throttled to ~30 Hz so the code text and header JSON track continuously, but _re-evaluation_ is quantized: the eval pipeline holds pending changes and applies them at the next cycle boundary (configurable: `beat | cycle | immediate`). Musically, tweaks land on the grid instead of mid-phrase glitching. Visually, the chip shows the _pending_ value with a subtle progress ring that fills as the boundary approaches — this one detail teaches beginners what a cycle is without a single word of documentation.

### 4.7 Widget/React integration

Chips need real interactivity (popovers, drag state), so implement `WidgetType.toDOM` as a mount point and render chip internals through a React portal keyed by `${block.from}:${slot.key}` (a `WidgetRegistry` Zustand map that the editor plugin writes into and a `<ChipPortals/>` component reads). `eq()` on the widget compares `defId + key + value` so CM6 reuses DOM across unrelated transactions and drags don't lose pointer capture.

---

## 5. Eval Pipeline & Clock

### 5.1 Evaluation

```ts
// audio/engine.ts
import { initStrudel } from '@strudel/web'; // pins: see package.json

export interface Engine {
  evaluate(code: string): Promise<void>; // transpile + swap pattern
  pattern(): Pattern | null; // current pattern (for queryArc)
  scheduler: Cyclist; // exposes now(), cps, started
  analyser: AnalyserNode; // tapped off master gain
}
```

Flow for editor audition: clip document change → strip nothing (comments are legal) → debounce 150 ms → `transpiler` → `evaluate`. Flow for session playback: launch-state change → compile active clips into `stack(...)` → hold until the chosen scheduler boundary → `evaluate`. Errors never throw into the UI: they land in a status strip and the previous pattern keeps playing. A broken edit must never silence an otherwise valid jam.

Quantized apply (from §4.6): the engine holds `pendingCode` and swaps it in a callback scheduled for the next boundary using the scheduler clock, not `setTimeout` guesswork.

### 5.2 ClockStore

A tiny rAF loop reads the scheduler each frame and publishes `{cycle, phase, beat, cps, playing}` to (a) a Zustand store for React consumers and (b) CSS custom properties on the app root:

```ts
function tick() {
  const now = scheduler.now(); // in cycles
  root.style.setProperty('--phase', String(now % 1));
  root.style.setProperty('--beat', String(Math.floor((now % 1) * beatsPerCycle)));
  clockStore.setState({ cycle: Math.floor(now), phase: now % 1 });
  requestAnimationFrame(tick);
}
```

Everything that "breathes" in the UI — play button pulse, block header beat dot, slot pending-ring, evaluation flash decay — is a pure function of `--phase`. This is the cheapest possible route to the "it feels alive and coherent" quality of the reference sites.

### 5.3 Hap highlighting

Reuse Strudel's approach: the transpiler tags mini-notation tokens with source locations; on each frame, query haps in a small window around now, and set a `Decoration.mark` on tokens whose hap is active. Implement as a `ViewPlugin` reading from a `highlightsField` updated by the rAF loop (batched — one dispatch per frame max, skipped when the active set is unchanged).

---

## 6. Completion

### Tier 1 — deterministic autocomplete (build first, zero network)

Sources, merged into one CM6 `autocompletion()` config:

1. **Function/method completions** from Strudel's generated JSDoc metadata (the repo ships a doc-generation pipeline; vendor the JSON at build time). Each completion carries the doc summary + an inline _runnable_ example in the info panel.
2. **Context-aware string completions**: inside `s("…")` → sample names from the currently loaded sample map (queryable from superdough's sound registry); inside `.scale('…')` → scale names from tonal; `.bank("…")` → known banks.
3. **Mini-notation snippets** inside pattern strings: `bd*4`, `<a b c>`, `[x ~]*2` templates with tab-stop fields.

### Tier 2 — LLM ghost text

CM6 has no built-in inline-suggestion UI; it's a well-known extension shape:

```ts
// editor/ghost-text.ts
const setGhost = StateEffect.define<{ pos: number; text: string } | null>();

const ghostField = StateField.define<{ pos: number; text: string } | null>({
  create: () => null,
  update(v, tr) {
    for (const e of tr.effects) if (e.is(setGhost)) return e.value;
    if (tr.docChanged || tr.selection) return null; // any keystroke invalidates
    return v;
  },
  provide: (f) =>
    EditorView.decorations.from(f, (g) =>
      g
        ? Decoration.set([
            Decoration.widget({
              widget: new GhostWidget(g.text),
              side: 1,
            }).range(g.pos),
          ])
        : Decoration.none,
    ),
});

const acceptGhost: Command = (view) => {
  const g = view.state.field(ghostField);
  if (!g) return false;
  view.dispatch({
    changes: { from: g.pos, insert: g.text },
    selection: { anchor: g.pos + g.text.length },
    effects: setGhost.of(null),
  });
  return true;
};
// keymap: { key: 'Tab', run: acceptGhost }  — ordered BEFORE indent/autocomplete
```

Trigger policy: fire only when the cursor is at end-of-line, after 500 ms idle, with an `AbortController` cancelling stale requests; cache keyed on `hash(prefixLast40Lines)`. Never trigger inside a locked block.

Prompting: system prompt = ~2k-token distillation of the Strudel API (function signatures + 15 idiomatic full-pattern examples across genres) + hard rules ("continue the code; output only code; ≤2 lines; prefer chaining onto the current expression"). User turn = last N lines + `<cursor>` marker. Haiku-class model, `max_tokens: 64`, temperature ~0.3. Expected latency 300–700 ms — fine for idle-triggered ghost text.

Auth: two modes behind one interface — (a) paste-your-own-key stored in localStorage, calls direct with `anthropic-dangerous-direct-browser-access` (fine for personal use), or (b) a ~20-line Cloudflare Worker proxy holding the key. Ship (a), keep (b) in the repo.

A fun v1.5: **"riff" completion** — a palette command that asks the model for a whole next layer given the current buffer ("add a hi-hat pattern that complements this"), inserted as a _block-like preview region_ you audition (solo'd) before accepting. This is more useful than line completion for actual music-making and uses the same plumbing.

---

## 7. Visuals

Layered canvas system to the right of (or below) the editor; each layer is a module with `draw(ctx, frame)` where `frame = { now, haps, analyser, size }`:

1. **Hap lane (v1 core)** — horizontally scrolling now-line view. Each active session lane gets a visual row; haps queried via `pattern.queryArc(now - 0.5, now + lookahead)` render as rounded rects (pitch → y within lane, gain → opacity, sound → hue from a fixed palette). Clip compilation tags events with lane identity so visualization and later stem export do not guess lanes from sound names. Because haps are known _before_ they sound, notes visibly approach the now-line and light up exactly on hit.
2. **Pianoroll** — Strudel ships pianoroll/punchcard drawing; reimplement to match the app's visual language rather than importing their canvas styles.
3. **Scope + spectrum** — `AnalyserNode` (fftSize 2048) waveform ring or bars; garnish layer, blended under the hap lane.
4. **Shader scene (v2)** — regl fullscreen frag shader with uniforms fed by _pattern data_ (onset envelope per lane, cps, cycle) rather than raw FFT; Strudel's existing hydra integration is prior art but a bespoke shader will look less "default hydra."

Perf budget: all layers share one rAF (the ClockStore tick); target < 4 ms/frame combined on an M-series laptop; degrade by dropping the spectrum layer first. `queryArc` runs once per frame over a ~2-cycle window, memoized per (patternId, windowStart quantized to 1/32 cycle).

---

## 8. Product Surface & Interaction Spec

### Session layout

```
┌──────────────────────────────────────────────────────────────────┐
│ ⏯ 120 bpm  quantize: cycle   Session | Code   Capture      ⌘K ⚙ │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────┤
│ scenes   │ drums    │ bass     │ harmony  │ melody   │ texture  │
│ ▶ base   │ 909 ●    │ acid ●   │ warm ●   │   —      │ dust ●   │
│ ▶ lift   │ break    │ sub      │ stabs    │ arp      │ swell    │
│          │ ■ stop   │ ■ stop   │ ■ stop   │ ■ stop   │ ■ stop   │
├──────────┴──────────┴──────────┴──────────┴──────────┴──────────┤
│ selected clip editor / parameter inspector      visual canvas   │
├──────────────────────────────────────────────────────────────────┤
│ ✓ scene queued for cycle 43 · capture 00:24 · errors here        │
└──────────────────────────────────────────────────────────────────┘
```

The Session/Code switch changes emphasis, not data. Session is the default overview. Opening or editing a clip reveals Code with that clip selected; returning to Session preserves editor state and launch state.

### Keyboard-first command surface

| Key    | Action                                                                                                                |
| ------ | --------------------------------------------------------------------------------------------------------------------- |
| ⌘⏎     | Evaluate now (bypass quantize)                                                                                        |
| ⌘.     | Stop (hush) — with a 60 ms fade, never a click                                                                        |
| ⌘K     | Command palette: insert block, switch visual, toggle vim, examples                                                    |
| Tab    | Accept ghost text (else indent)                                                                                       |
| ⌘E     | Eject block under cursor                                                                                              |
| ⌥↑/⌥↓  | Nudge number under cursor (works on plain code too — parse the token; this brings slot-scrubbing joy to ejected code) |
| 1–9    | Launch scene by visible row                                                                                           |
| Space  | Launch/stop the focused clip                                                                                          |
| ⇧Space | Stop focused lane                                                                                                     |
| ⌘⇧R    | Start/stop jam capture                                                                                                |

### Micro-interaction spec (the Rauno list)

- **Evaluation flash:** on apply, the affected code region's background does a 250 ms ease-out sweep _timed to start on the boundary it applied at_.
- **Play button:** morphs ▶→⏸ with a spring; while playing, its ring is a conic-gradient driven by `--phase`.
- **Block insert:** region animates in with height auto-transition + a single sparkle on the header beat-dot at the next downbeat.
- **Slot drag:** value chip lifts (scale 1.04, shadow token), cursor `ew-resize`, halo shows min–max extent; pending ring fills toward next boundary.
- **Eject:** the block chrome dissolves (200 ms, opacity + blur-to-sharp on the underlying code) — visually literalizing "the training wheels come off."
- **Empty state:** a ghosted example pattern with a single pulsing "press ⌘⏎" — first sound in one keystroke.
- Honor `prefers-reduced-motion` everywhere; motion durations from a 3-token scale (120/200/320 ms), one easing curve family.

### Sound-design details (audio polish is polish too)

- Master limiter on by default (superdough supports gain staging); beginners will stack 6 patterns and clip.
- `hush` and pattern-swap use short crossfades where possible.
- Sample-bank preview in enum popovers plays at −6 dB, mono, dry.

---

## 9. Persistence & Sharing

- Autosave the entire project—lanes, clips, scenes, active selection, arrangement, tempo, and settings—to IndexedDB (debounced 1 s).
- Multiple named projects replace the earlier flat "sketch" concept. Individual clips still support copy/paste as plain Strudel.
- "Copy active session as Strudel" compiles the current launch state into a standalone `stack(...)` program and offers a strudel.cc deep link.
- URL sharing encodes the project or a selected scene with versioned migrations. Large projects fall back to a downloadable local project file.

### 9.1 Jam capture and arrangement

Capture appends scheduler-timestamped launch-state events while the user performs. Arrangement playback replays that event log against the same clock. The first arrangement UI is deliberately small: a lane-per-row event strip with movable section boundaries, not waveform editing.

### 9.2 MIDI and production export

- **MIDI import:** read a Standard MIDI File into one or more pitched clips. Ask for quantization and lane mapping; preserve the original event list so import is lossless even when generated mini-notation is simplified.
- **MIDI export:** query a scene or arrangement over an explicit bar range and write note, velocity, duration, channel, tempo, and time-signature events. Infinite/generative patterns require an export length and deterministic seed.
- **Drum mapping:** sample names map through a user-editable General MIDI drum table. Unmapped samples remain visible warnings rather than silently disappearing.
- **Automation limits:** filters, room, sample slicing, randomness, and Strudel-specific controls do not always map to MIDI. Export supported controls as CC where configured and report omissions.
- **Audio export:** mix bounce and per-lane stems follow MIDI. For sample-based Strudel production, rendered audio is often the more faithful interchange format.
- Live Web MIDI device input/output remains a later workflow because it introduces permissions, latency calibration, clock sync, and hardware testing beyond file interchange.

---

## 10. Milestones & Gates

Solo build, evenings-scale. Each milestone has a **done-gate** — demonstrable, not vibes. Rough effort in focused days.

| #   | Milestone              | Scope                                                                                          | Done-gate                                                                            | ~Days |
| --- | ---------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----- |
| M0  | Skeleton               | Vite+React+CM6+@strudel/web wired; eval on ⌘⏎; play/stop; error strip                          | A pasted strudel.cc example plays; error doesn't stop audio                          | 2     |
| M1  | Clock & feel           | ClockStore, CSS vars, transport bar, eval flash, quantized apply                               | Slot-less demo: edits land on cycle boundaries; flash syncs to beat on video capture | 2     |
| M2  | Blocks core            | blocksField, enforceLocks, atomicRanges, header widget, insert/eject, 3 block defs             | Insert→play→eject→⌘Z-restores; illegal edits provably dropped (test suite)           | 4     |
| M3  | Slots                  | number scrub (log scale), enum w/ audio preview, mini popover; pending-ring                    | Filter-sweep a playing acid line by dragging; change lands on boundary               | 4     |
| M4  | Autocomplete T1        | doc-JSON completions, sample/scale string completions, mini snippets                           | Type `.l` → lpf with doc panel; `s("` lists loaded samples                           | 3     |
| M5  | Visuals v1             | Hap lane + scope underlay, palette-coherent                                                    | 4-layer pattern renders 60fps; notes light exactly on hit                            | 4     |
| M6  | Ghost text             | ghostField ext, prompt, key/proxy modes, riff command                                          | Tab-accept works; suggestions arrive <800 ms p50; never fires in blocks              | 3     |
| M7  | Session foundation     | 5 lanes, two clips per lane, two scenes, quantized launch/replace/stop, valid session compiler | Build a five-layer jam and switch scenes without opening code or losing the clock    | 4     |
| M8  | Clip editing & mixer   | Select/edit/save clips, block palette in clips, lane gain/mute/solo, project persistence       | Edit a playing bass clip, return to Session, save/reload, and recover the same jam   | 4     |
| M9  | Capture & arrangement  | Clock-stamped performance log, arrangement playback, compact event timeline                    | Perform a 32-cycle jam and replay the same structure deterministically               | 5     |
| M10 | Production interchange | MIDI file import/export, active-session Strudel export, project files                          | Import a MIDI phrase, layer it with drums, and export an 8-bar MIDI arrangement      | 4     |
| M11 | Library & ship         | 12–15 curated clips/blocks, templates, URL sharing, onboarding polish                          | A non-programmer friend creates and saves a structured jam in <5 min, unassisted     | 4     |

**Kill/pivot gates (pre-registered, your house style):**

- **G1 (after M2):** if lock enforcement can't be made airtight against a fuzz test (random transactions, 10k iterations, zero invariant violations), _pivot blocks to read-only display + eject-to-edit only_ (no slots). The product survives; slots were the risk.
- **G2 (after M3):** if quantized-apply causes audible glitches on pattern swap (superdough swap behavior is the unknown), fall back to `immediate` apply and keep the pending-ring as a purely visual metronome affordance.
- **G3 (after M6):** if ghost-text acceptance rate in your own use is <15% over a week, demote it to the ⌘K "riff" command only and delete the inline machinery.

---

## 11. Risks & Open Questions

| Risk                                                                                                       | Likelihood | Mitigation                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Upstream churn (Codeberg move, package renames — `@strudel.cycles/*` → `@strudel/*` already happened once) | Med        | Pin exact versions; vendor doc JSON; wrap all Strudel imports behind `audio/engine.ts` so a version bump touches one file             |
| CM6 replace-decorations + atomic ranges edge cases (line-boundary widgets, IME, mobile selection)          | Med        | The fuzz test at G2; keep block regions whole-line aligned (sentinels always own their lines) to dodge the worst cases                |
| `queryArc` cost on pathological patterns (`.sometimesBy` chains, fine subdivisions)                        | Low        | Memoize per frame; cap lookahead; wrap in try/budget and drop the lane gracefully                                                     |
| Transpiler source-map format is internal API (highlighting)                                                | Med        | Snapshot-test against the pinned version; highlighting is degradable                                                                  |
| Browser autoplay policy                                                                                    | Certain    | First interaction gates AudioContext resume; the empty-state ⌘⏎ prompt doubles as the unlock                                          |
| Session recompiles restart pattern phase or tails                                                          | High       | Test replacement at beat/cycle boundaries; preserve scheduler time; add per-lane transitions only after the atomic compiler is proven |
| Invalid code in one clip breaks the combined scene                                                         | Med        | Compile/audition clips independently, retain last-known-good clip pattern, and identify the failing lane in errors                    |
| Generative patterns make finite export ambiguous                                                           | Med        | Require bar length and seed; show that MIDI is a rendered snapshot, not the source pattern                                            |

**Open questions to settle during M0–M1 spikes:**

1. Does `@strudel/web`'s evaluate expose the pattern object cleanly for `queryArc`, or do we need to eval through `@strudel/core` repl internals? (1-hour spike; determines §7 plumbing.)
2. Exact mechanism for scheduling a callback on the next cycle boundary from the Cyclist scheduler — public API or derive from `now()` + cps?
3. Can superdough's master chain be tapped for an AnalyserNode without forking, or do we construct our own output context? (Their `getAudioContext()` export suggests yes.)

---

## 12. Decision Log (ADR-style, one-liners)

1. **Headless `@strudel/web` over `<strudel-editor>`** — own the editor; their component bundles opinions we're here to replace.
2. **Blocks as comment-delimited real code** — doc always valid Strudel; rejected placeholder-token and dual-AST designs (sync risk).
3. **Slot offsets computed from render, never parsed** — eliminates the entire class of drift bugs; requires the repair pass on load.
4. **transactionFilter as sole lock mechanism** — one choke point, fuzz-testable; UI affordances (atomic ranges) are UX, not security.
5. **Quantized apply with visible pending state** — the pedagogical _and_ aesthetic core; immediate-apply kept as escape hatch.
6. **Canvas 2D before WebGL** — hap lane doesn't need shaders; regl is a v2 layer behind the same `draw(frame)` interface.
7. **Ghost text via own CM6 extension + Anthropic API** — no Copilot dependency; deterministic Tier-1 ships first and stands alone.
8. **Session workspace as the primary shell** — musicians launch clips before editing code; the editor becomes a focused clip tool without losing progressive disclosure.
9. **One active clip per lane by default** — replacement is predictable and Ableton-like; explicit stacking happens by adding lanes, not hidden polyphony inside a column.
10. **Session compiler emits ordinary `stack(...)` code** — launch state is project state, but the evaluated and exported result remains portable Strudel.
11. **Capture semantic events in scheduler cycles** — arrangements record musical decisions, not wall-clock audio, so they remain editable and tempo-independent.
12. **MIDI files before live MIDI devices** — import/export improves production interchange without taking on hardware permissions and synchronization in the session MVP.
