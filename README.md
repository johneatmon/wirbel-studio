# Strudel Studio

A session-oriented live-coding music environment built on [Strudel](https://strudel.cc/). Musicians
launch clips into instrument lanes, combine them into scenes, and open any clip as plain Strudel code.
Locked parameter blocks remain the bridge from guided composition to live coding.

What's next lives in [ROADMAP.md](./ROADMAP.md).

## Current MVP state

- Strudel audio engine with evaluate, stop, errors, and cycle/beat-quantized pattern updates
- A single scheduler-derived clock shared by the transport, editor feedback, and canvas
- Three valid-Strudel block definitions with locked regions, undoable eject, and repair-on-load
- Number, enum, and mini-notation slot controls with quantized re-evaluation
- Deterministic API, sample, scale, bank, and mini-notation autocomplete
- Hap-lane visualization aligned to session mixer rows, with tagged clip identity, plus a shared-clock oscilloscope underlay
- Optional, idle-triggered Anthropic ghost text with Tab acceptance and locked-block suppression
- Command palette (`Cmd/Ctrl + K`) with a riff command that auditions a complementary AI layer before insert
- Session workspace with five lanes, clock-quantized clip replacement, and per-lane stops
- A portable session compiler that renders active clips as ordinary `stack(...)` Strudel code
- Versioned IndexedDB projects with autosave, project switching, new/duplicate flows, and reload restoration
- Editable scene and clip names plus scene creation and clip create/duplicate/delete controls
- Per-lane mixer (gain, mute, solo) and last-known-good clip error isolation during session playback
- Jam capture to a scheduler-cycle arrangement with replay and a compact lane timeline
- MIDI file import/export, copy-as-Strudel / strudel.cc links, and downloadable JSON project files
- Starter library with scene templates, Studio URL sharing, onboarding hints, and importable community blocks
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

## Keyboard controls

| Shortcut           | Action                                         |
| ------------------ | ---------------------------------------------- |
| `Cmd/Ctrl + Enter` | Evaluate immediately                           |
| `Cmd/Ctrl + .`     | Stop playback                                  |
| `Tab`              | Accept visible AI ghost text; otherwise indent |
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

## AI completion

AI completion is off by default. Open the settings button, provide an Anthropic-compatible API key,
and enable inline suggestions. The key is saved only to this browser's local storage and requests
go directly to the configured Messages API endpoint. For a deployed or shared build, use a restricted
key or place a small authenticated proxy in front of the provider.

The endpoint and model are editable because provider model names and gateways change independently
of the app. With a key saved, **Riff a complementary layer** in the command palette asks for a
whole extra part, auditions it stacked on the current buffer, and inserts it only if you accept.
