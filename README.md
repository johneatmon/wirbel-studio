# Strudel Studio

A beginner-friendly live-coding music environment built on
[Strudel](https://strudel.cc/). It layers locked, editable pattern blocks over plain Strudel code,
then lets musicians eject those blocks into regular code as they learn.

The product direction and architectural decisions live in [DESIGN.md](./DESIGN.md).

## Current MVP state

- Strudel audio engine with evaluate, stop, errors, and cycle/beat-quantized pattern updates
- A single scheduler-derived clock shared by the transport, editor feedback, and canvas
- Three valid-Strudel block definitions with locked regions, undoable eject, and repair-on-load
- Number, enum, and mini-notation slot controls with quantized re-evaluation
- Deterministic API, sample, scale, bank, and mini-notation autocomplete
- Hap-lane and oscilloscope canvas layers on the shared animation frame
- Optional, idle-triggered Anthropic ghost text with Tab acceptance and locked-block suppression

The next product milestone is the library-and-ship pass: more curated blocks, sketch persistence,
URL sharing, the command palette, and first-run polish.

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

Blocks can be inserted from the toolbar and ejected from their header. Number chips support drag,
wheel, and double-click entry; Shift makes a drag finer and Alt makes it coarser.

## AI completion

AI completion is off by default. Open the settings button, provide an Anthropic-compatible API key,
and enable inline suggestions. The key is saved only to this browser's local storage and requests
go directly to the configured Messages API endpoint. For a deployed or shared build, use a restricted
key or place a small authenticated proxy in front of the provider.

The endpoint and model are editable because provider model names and gateways change independently
of the app.
