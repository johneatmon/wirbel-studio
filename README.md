# Wirbel

A session-oriented live-coding music environment built on [Strudel](https://strudel.cc/). Musicians
launch clips into instrument lanes, combine them into scenes, and open any clip as plain Strudel code.
The public origin is [wirbel.dev](https://wirbel.dev).

What's next lives in [ROADMAP.md](./ROADMAP.md).

## Current MVP state

- Strudel audio engine with evaluate, stop, errors, and cycle/beat-quantized pattern updates
- A single scheduler-derived clock shared by the transport, editor feedback, and canvas
- Three valid-Strudel block definitions with locked regions, undoable eject, and repair-on-load
- Number, enum, and mini-notation slot controls with quantized re-evaluation
- Deterministic API, sample, scale, bank, and mini-notation autocomplete
- Hap-lane visualization aligned to session mixer rows, with tagged clip identity, plus a shared-clock oscilloscope underlay
- Command palette (`Cmd/Ctrl + K`) with insert-block, templates, and share commands
- Session workspace with five lanes, clock-quantized clip replacement, and per-lane stops
- A portable session compiler that renders active clips as ordinary `stack(...)` Strudel code
- Versioned IndexedDB projects with autosave, project switching, new/duplicate flows, and reload restoration
- Editable scene and clip names plus scene creation and clip create/duplicate/delete controls
- Per-lane mixer (gain, mute, solo) and last-known-good clip error isolation during session playback
- Jam capture to a scheduler-cycle arrangement with replay and a compact lane timeline
- MIDI file import/export, copy-as-Strudel / strudel.cc links, and downloadable JSON project files
- Starter library with scene templates, Wirbel URL sharing, onboarding hints, and importable community blocks
- Collapsible hap-lane visualizer

## Run locally

Requirements: Node.js 20+ and pnpm 10.

```sh
pnpm install
pnpm dev
```

Audio is subject to the browser's autoplay rules, so the first evaluate action also unlocks the
audio context.

Useful checks:

```sh
pnpm test
pnpm lint
pnpm build
```

## Preview the production build

`pnpm preview` is Vite's static server. `pnpm preview:cf` builds first, then serves `dist/` with
Wrangler — same static-asset + SPA fallback as Cloudflare.

```sh
pnpm preview:cf
```

First production deploy (Cloudflare login required):

```sh
pnpm deploy
```

Attach `wirbel.dev` as a custom domain on the `wirbel` Worker in the Cloudflare dashboard. IndexedDB
is per-origin, so localhost and wirbel.dev keep separate project libraries.

## Keyboard controls

| Shortcut           | Action                                         |
| ------------------ | ---------------------------------------------- |
| `Cmd/Ctrl + Enter` | Evaluate immediately                           |
| `Cmd/Ctrl + .`     | Stop playback                                  |
| `Tab`              | Indent                                       |
| `Cmd/Ctrl + K`     | Command palette (templates, blocks, share) |
| `1`–`9`            | Launch scene by row (session workspace)    |
| `Space`            | Toggle launch for selected clip            |
| `Shift + Space`    | Stop the selected clip's lane              |
| `Cmd/Ctrl + Shift + R` | Start or stop jam capture              |

Session is the default workspace. Launching a clip replaces the active clip in its lane; launching a
scene changes all populated lanes together at the selected quantize boundary. Use a clip's **edit**
action to open its source in Code mode. **Share** copies the launched session as Strudel, imports or
exports Standard MIDI Files, and downloads or loads a JSON project.

Blocks can be inserted from the Code toolbar and ejected from their header. Number chips support
drag, wheel, and double-click entry; Shift makes a drag finer and Alt makes it coarser.
