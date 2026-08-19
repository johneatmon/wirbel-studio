# Roadmap

The session MVP is built. Next work is in this order. Don't skip ahead: hosting makes the share link real, and audio bounce is the export people will actually use.

## Now

**Host a public build on wirbel.dev.** Wrangler is set up for a local production preview (`pnpm preview:cf`). First `pnpm deploy` plus attaching the custom domain makes share links real. Keep IndexedDB local-first. If a share payload is too large for the hash, keep falling back to the JSON project file.

## Next

1. **Audio bounce and stems.** Query/render a finite bar range to a mixdown, then per-lane stems. MIDI is a snapshot of notes; bounced audio is what sample-based Strudel actually sounds like. Require an export length (and a seed if the pattern is generative).

2. **Pianoroll.** A pitch/time view of the same tagged haps the lane already draws. Stay on Canvas 2D. Don't import Strudel's pianoroll chrome.

3. **Live MIDI devices.** Web MIDI in/out: notes, clock, maybe clip launch. This waits because it adds permissions, latency calibration, and hardware testing. File import/export already covers interchange.

## Out of scope until the list above is done

Collaboration, accounts, a sharing backend, OSC, mobile-first layout, multitrack waveform editing, plug-ins, sample warping, shader/WebGL scenes.

## Locked decisions

These are already settled. Reopen them only with a reason that beats the original:

- One scheduler clock drives UI, capture, and visuals.
- Every clip is valid Strudel; blocks are comment-delimited regions, not a second format.
- Slot offsets come from render, never from parsing the document.
- Locks go through `transactionFilter` only.
- Session is the primary shell; one active clip per lane.
- The compiler emits ordinary `stack(...)`.
- Capture logs musical decisions in scheduler cycles, not wall-clock audio.
- MIDI files before live MIDI devices. Canvas 2D before WebGL.
