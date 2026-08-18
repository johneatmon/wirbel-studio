import { useRef, useState } from 'react';
import { compileSession } from '../session/model';
import { snapshotProject, useSessionStore } from '../session/session-store';
import { loadPattern } from '../audio/engine';
import { parseMidi, writeMidi } from './midi-file';
import { hapsToMidiNotes, midiNotesToParts } from './midi-map';
import { sessionPortableCode, strudelShareUrl } from './export-session';
import {
  buildShareUrl,
  projectSharePayload,
  shareUrlLength,
  SHARE_URL_MAX,
} from './url-share';
import { parseProjectFile, serializeProject } from './project-file';

function safeFilename(name: string, ext: string): string {
  const stem = name.trim().replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'session';
  return `${stem}.${ext}`;
}

function download(filename: string, data: string | Uint8Array, mime: string): void {
  const blob =
    typeof data === 'string'
      ? new Blob([data], { type: mime })
      : new Blob([Uint8Array.from(data).buffer as ArrayBuffer], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function InterchangePanel({
  engineReady,
  onClose,
}: {
  engineReady: boolean;
  onClose: () => void;
}) {
  const midiInputRef = useRef<HTMLInputElement | null>(null);
  const projectInputRef = useRef<HTMLInputElement | null>(null);
  const [bars, setBars] = useState(8);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const hasActiveClip = useSessionStore((state) => Object.values(state.activeByLane).some(Boolean));
  const hydrated = useSessionStore((state) => state.hydrated);

  const report = (text: string, nextWarnings: string[] = []) => {
    setMessage(text);
    setWarnings(nextWarnings);
  };

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    try {
      await work();
    } catch (reason) {
      report(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end bg-black/45 p-4"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="mt-10 w-full max-w-sm space-y-4 rounded-lg border border-neutral-700 bg-neutral-900 p-4 shadow-2xl"
        role="dialog"
        aria-label="Share and interchange"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-neutral-100">Share and interchange</h2>
            <p className="mt-1 text-xs leading-relaxed text-neutral-500">
              Copy the launched session as ordinary Strudel, import or export a Standard MIDI File,
              or save the project as JSON.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
            aria-label="Close interchange"
          >
            ×
          </button>
        </div>

        <section className="space-y-2">
          <h3 className="text-[10px] font-semibold tracking-[0.18em] text-neutral-600 uppercase">
            Studio link
          </h3>
          <button
            type="button"
            disabled={busy || !hydrated}
            onClick={() =>
              void run(async () => {
                const payload = projectSharePayload(snapshotProject());
                if (shareUrlLength(payload) > SHARE_URL_MAX) {
                  throw new Error(
                    'Project link is too long for a URL — download the JSON project file instead.',
                  );
                }
                const url = buildShareUrl(payload);
                await navigator.clipboard.writeText(url);
                report('Copied Studio share link. Opening this URL imports the project.');
              })
            }
            className="rounded bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700 disabled:opacity-40"
          >
            Copy Studio link
          </button>
        </section>

        <section className="space-y-2">
          <h3 className="text-[10px] font-semibold tracking-[0.18em] text-neutral-600 uppercase">
            Strudel
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || !hasActiveClip}
              onClick={() =>
                void run(async () => {
                  const code = sessionPortableCode();
                  if (!code) throw new Error('Launch at least one clip first.');
                  await navigator.clipboard.writeText(code);
                  report('Copied portable Strudel to the clipboard.');
                })
              }
              className="rounded bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700 disabled:opacity-40"
            >
              Copy as Strudel
            </button>
            <button
              type="button"
              disabled={busy || !hasActiveClip}
              onClick={() =>
                void run(async () => {
                  const code = sessionPortableCode();
                  if (!code) throw new Error('Launch at least one clip first.');
                  window.open(strudelShareUrl(code), '_blank', 'noopener');
                  report('Opened the launched session on strudel.cc.');
                })
              }
              className="rounded bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700 disabled:opacity-40"
            >
              Open strudel.cc
            </button>
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-[10px] font-semibold tracking-[0.18em] text-neutral-600 uppercase">
            MIDI
          </h3>
          <label className="flex items-center gap-2 text-xs text-neutral-400">
            <span>Export length</span>
            <input
              type="number"
              min={1}
              max={64}
              value={bars}
              onChange={(event) =>
                setBars(Math.min(64, Math.max(1, Number(event.target.value) || 1)))
              }
              className="w-14 rounded border border-neutral-700 bg-neutral-950 px-1.5 py-1 text-center text-neutral-200 outline-none"
            />
            <span>bars</span>
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || !engineReady || !hasActiveClip}
              onClick={() =>
                void run(async () => {
                  const state = useSessionStore.getState();
                  const code = compileSession(state.lanes, state.clips, state.activeByLane);
                  if (!code) throw new Error('Launch at least one clip first.');
                  const pattern = await loadPattern(code);
                  if (!pattern) throw new Error('Could not compile the launched session.');
                  const { notes, warnings: midiWarnings } = hapsToMidiNotes(
                    pattern.queryArc(0, bars),
                  );
                  if (!notes.length) {
                    throw new Error('No MIDI notes in that window. Check mapping warnings.');
                  }
                  download(
                    safeFilename(state.projectName, 'mid'),
                    writeMidi(notes, state.tempo),
                    'audio/midi',
                  );
                  report(`Exported ${bars}-bar MIDI.`, midiWarnings);
                })
              }
              className="rounded bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700 disabled:opacity-40"
            >
              Export MIDI
            </button>
            <button
              type="button"
              disabled={busy || !hydrated}
              onClick={() => midiInputRef.current?.click()}
              className="rounded bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700 disabled:opacity-40"
            >
              Import MIDI
            </button>
          </div>
          <input
            ref={midiInputRef}
            type="file"
            accept=".mid,.midi,audio/midi"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (!file) return;
              void run(async () => {
                const parsed = parseMidi(new Uint8Array(await file.arrayBuffer()));
                const { parts, warnings: midiWarnings } = midiNotesToParts(parsed.notes);
                if (!parts.length) throw new Error('No notes found in that MIDI file.');
                useSessionStore.getState().importMidiScene(parts, parsed.bpm);
                report(
                  `Imported into a new scene at ${parsed.bpm} bpm. Launch it to layer with other clips.`,
                  midiWarnings,
                );
              });
            }}
          />
        </section>

        <section className="space-y-2">
          <h3 className="text-[10px] font-semibold tracking-[0.18em] text-neutral-600 uppercase">
            Project file
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || !hydrated}
              onClick={() =>
                void run(async () => {
                  const project = snapshotProject();
                  download(
                    safeFilename(project.name, 'json'),
                    serializeProject(project),
                    'application/json',
                  );
                  report('Downloaded the project file.');
                })
              }
              className="rounded bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700 disabled:opacity-40"
            >
              Download JSON
            </button>
            <button
              type="button"
              disabled={busy || !hydrated}
              onClick={() => projectInputRef.current?.click()}
              className="rounded bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700 disabled:opacity-40"
            >
              Load JSON
            </button>
          </div>
          <input
            ref={projectInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (!file) return;
              void run(async () => {
                const project = parseProjectFile(await file.text());
                await useSessionStore.getState().importProjectFile(project);
                report(`Loaded “${project.name}” as a new project.`);
              });
            }}
          />
        </section>

        {(message || warnings.length > 0) && (
          <div className="space-y-1 text-xs">
            {message && <p className="text-neutral-300">{message}</p>}
            {warnings.map((warning) => (
              <p key={warning} className="text-amber-400/90">
                {warning}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
