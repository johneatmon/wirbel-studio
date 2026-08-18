import { useCallback, useEffect, useRef, useState } from 'react';
import { StrudelEditor, type StrudelEditorHandle } from './editor/editor';
import { evaluateCode, initEngine, stopEngine, type QuantizeBoundary } from './audio/engine';
import { startClockLoop } from './audio/clock';
import { useAppStore } from './store/app-store';
import { useClockStore } from './store/clock-store';
import { registry } from './blocks/registry';
import { VisualCanvas } from './visuals/visual-canvas';
import {
  loadGhostSettings,
  saveGhostSettings,
  type GhostSettings,
} from './completions/ghost-settings';
import type { GhostStatus } from './editor/ghost-text';
import { SessionWorkspace } from './session/session-workspace';
import { compileSession, type SessionClip } from './session/model';
import { startSessionPersistence, useSessionStore } from './session/session-store';

const BLOCK_DEFS = [...registry.values()];

const STARTER_CODE = `note("<c3 eb3 g3 bb3>*2")
  .s("sawtooth")
  .lpf(400)
  .lpq(4)
  .attack(0.05)
  .release(0.15)
  .room(0.2)
  .gain(0.35)

// $: s("bd*4, ~ cp ~ cp, hh*8").bank("RolandTR909")
`;

const QUANTIZE_OPTIONS: { value: QuantizeBoundary; label: string }[] = [
  { value: 'immediate', label: 'off' },
  { value: 'beat', label: 'beat' },
  { value: 'cycle', label: 'cycle' },
];

function App() {
  const { ready, error, started, setReady, setEngineState, markEvaluated } = useAppStore();
  const { cycle, phase, cps, playing } = useClockStore();
  const [evaluating, setEvaluating] = useState(false);
  const [hasEvaluated, setHasEvaluated] = useState(false);
  const [workspace, setWorkspace] = useState<'session' | 'code'>('session');
  const [showSettings, setShowSettings] = useState(false);
  const [ghostSettings, setGhostSettings] = useState<GhostSettings>(loadGhostSettings);
  const [ghostStatus, setGhostStatus] = useState<{ status: GhostStatus; message?: string }>({
    status: 'idle',
  });
  const bootedRef = useRef(false);
  const editorRef = useRef<StrudelEditorHandle>(null);
  const selectedClipId = useSessionStore((state) => state.selectedClipId);
  const projectId = useSessionStore((state) => state.projectId);
  const quantize = useSessionStore((state) => state.launchQuantize);
  const setLaunchQuantize = useSessionStore((state) => state.setLaunchQuantize);
  const selectedClip = useSessionStore((state) =>
    state.clips.find((clip) => clip.id === state.selectedClipId),
  );

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    void initEngine(setEngineState)
      .then(() => {
        setReady(true);
        startClockLoop();
      })
      .catch((reason: unknown) => {
        const bootError = reason instanceof Error ? reason : new Error(String(reason));
        setEngineState({ started: false, pattern: null, error: bootError });
      });
  }, [setEngineState, setReady]);

  useEffect(() => startSessionPersistence(), []);

  useEffect(() => {
    useAppStore.getState().setQuantize(quantize);
  }, [quantize]);

  useEffect(() => {
    stopEngine();
  }, [projectId]);

  const handleEvaluate = useCallback(
    async (code: string, boundary: QuantizeBoundary) => {
      if (!ready) return;
      setEvaluating(true);
      try {
        await evaluateCode(code, boundary);
        markEvaluated();
        setHasEvaluated(true);
      } catch {
        // engine surfaces errors via onUpdateState; nothing else to do here.
      } finally {
        setEvaluating(false);
      }
    },
    [ready, markEvaluated],
  );

  const status: 'idle' | 'evaluating' | 'ok' | 'error' = evaluating
    ? 'evaluating'
    : error
      ? 'error'
      : hasEvaluated
        ? 'ok'
        : 'idle';

  const handleStop = useCallback(() => {
    useSessionStore.getState().stopAll();
    stopEngine();
  }, []);

  const handleSessionComposition = useCallback(
    (code: string | null) => {
      if (!code) {
        stopEngine();
        return;
      }
      void handleEvaluate(code, quantize);
    },
    [handleEvaluate, quantize],
  );

  const handleEditClip = useCallback((clip: SessionClip) => {
    editorRef.current?.setCode(clip.code);
    setWorkspace('code');
  }, []);

  const handleEditorEvaluate = useCallback(
    (code: string) => {
      const session = useSessionStore.getState();
      const selectedIsActive =
        selectedClipId !== null && Object.values(session.activeByLane).includes(selectedClipId);
      if (selectedIsActive) {
        const sessionCode = compileSession(session.lanes, session.clips, session.activeByLane);
        void handleEvaluate(sessionCode ?? code, 'immediate');
        return;
      }
      void handleEvaluate(code, 'immediate');
    },
    [handleEvaluate, selectedClipId],
  );

  const handleTransportEvaluate = useCallback(() => {
    if (workspace === 'code') {
      handleEditorEvaluate(editorRef.current?.getCode() ?? '');
      return;
    }

    const session = useSessionStore.getState();
    const active = Object.values(session.activeByLane).some(Boolean)
      ? session.activeByLane
      : session.launchScene(session.scenes[0]?.id ?? '');
    const code = compileSession(session.lanes, session.clips, active);
    if (code) void handleEvaluate(code, quantize);
  }, [handleEditorEvaluate, handleEvaluate, quantize, workspace]);

  const handleSaveSettings = useCallback((settings: GhostSettings) => {
    saveGhostSettings(settings);
    setGhostSettings(settings);
    setGhostStatus({ status: 'idle' });
    setShowSettings(false);
  }, []);

  return (
    <div className="flex h-full flex-col bg-neutral-950 text-neutral-200">
      <header className="flex items-center gap-4 border-b border-neutral-800 px-4 py-2 text-sm">
        <div
          className="h-6 w-6 shrink-0 rounded-full transition-colors"
          style={{
            background: playing
              ? `conic-gradient(#34d399 calc(${phase} * 1turn), #262626 0)`
              : '#262626',
          }}
          title={playing ? `cycle ${cycle}` : 'stopped'}
        />
        <button
          type="button"
          onClick={handleTransportEvaluate}
          disabled={!ready}
          className="rounded bg-neutral-800 px-3 py-1 font-medium hover:bg-neutral-700 disabled:opacity-40"
        >
          {workspace === 'session' ? '▶ Launch' : '⏎ Evaluate'}
        </button>
        <button
          type="button"
          onClick={handleStop}
          disabled={!ready}
          className="rounded bg-neutral-800 px-3 py-1 font-medium hover:bg-neutral-700 disabled:opacity-40"
        >
          ⏹ Stop
        </button>

        <div className="flex items-center gap-1 rounded bg-neutral-900 p-0.5 text-xs">
          {QUANTIZE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setLaunchQuantize(opt.value)}
              className={`rounded px-2 py-1 ${
                quantize === opt.value
                  ? 'bg-neutral-700 text-neutral-100'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <span className={started ? 'text-emerald-400' : 'text-neutral-500'}>
          {started ? `● cycle ${cycle} · ${(cps * 60).toFixed(0)} cpm` : '○ stopped'}
        </span>
        <div className="ml-auto flex items-center gap-1 rounded-md bg-neutral-900 p-0.5 text-xs">
          {(['session', 'code'] as const).map((view) => (
            <button
              key={view}
              type="button"
              onClick={() => setWorkspace(view)}
              className={`rounded px-2.5 py-1 capitalize transition-colors ${
                workspace === view
                  ? 'bg-neutral-700 text-neutral-100'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {view}
            </button>
          ))}
        </div>
        <span className="text-neutral-500">strudel studio</span>
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          className="rounded px-2 py-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
          aria-label="Open settings"
          title="Settings"
        >
          ⚙
        </button>
      </header>

      {workspace === 'code' && (
        <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-1.5 text-xs">
          {selectedClip ? (
            <span className="mr-2 text-neutral-500">
              editing <span className="text-neutral-300">{selectedClip.name}</span>
            </span>
          ) : (
            <span className="text-neutral-500">scratch code</span>
          )}
          <span className="text-neutral-600">insert:</span>
          {BLOCK_DEFS.map((def) => (
            <button
              key={def.id}
              type="button"
              onClick={() => editorRef.current?.insertBlock(def.id)}
              title={def.description}
              className="rounded bg-neutral-900 px-2 py-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
            >
              {def.name}
            </button>
          ))}
        </div>
      )}

      <main className="flex min-h-0 flex-1">
        <div className="min-h-0 flex-1 border-r border-neutral-800">
          <div className={workspace === 'session' ? 'h-full' : 'hidden'}>
            <SessionWorkspace
              disabled={!ready}
              transportPlaying={playing}
              onCompositionChange={handleSessionComposition}
              onEditClip={handleEditClip}
            />
          </div>
          <div className={workspace === 'code' ? 'h-full' : 'hidden'}>
            <StrudelEditor
              ref={editorRef}
              initialDoc={STARTER_CODE}
              onEvaluate={handleEditorEvaluate}
              onStop={handleStop}
              onChange={(code) => {
                const clipId = useSessionStore.getState().selectedClipId;
                if (clipId) useSessionStore.getState().updateClipCode(clipId, code);
              }}
              onGhostStatus={(nextStatus, message) =>
                setGhostStatus({ status: nextStatus, message })
              }
            />
          </div>
        </div>
        <div className="w-80 shrink-0 bg-neutral-950">
          <VisualCanvas />
        </div>
      </main>

      <footer className="flex items-center border-t border-neutral-800 px-4 py-1.5 text-xs">
        <span>
          {!ready && !error ? (
            <span className="text-neutral-500">loading audio engine…</span>
          ) : status === 'error' && error ? (
            <span className="text-red-400">✗ {error.message}</span>
          ) : status === 'evaluating' ? (
            <span className="text-neutral-500">evaluating…</span>
          ) : status === 'ok' ? (
            <span className="text-neutral-500">✓ evaluated</span>
          ) : (
            <span className="text-neutral-500">idle</span>
          )}
        </span>
        {ghostSettings.enabled && (
          <span
            className={`ml-auto ${ghostStatus.status === 'error' ? 'text-red-400' : 'text-neutral-500'}`}
            title={ghostStatus.message}
          >
            {ghostStatus.status === 'loading'
              ? 'completing…'
              : ghostStatus.status === 'ready'
                ? 'Tab to accept suggestion'
                : ghostStatus.status === 'error'
                  ? `completion: ${ghostStatus.message ?? 'request failed'}`
                  : 'AI completion on'}
          </span>
        )}
      </footer>

      {showSettings && (
        <GhostSettingsPanel
          initial={ghostSettings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

function GhostSettingsPanel({
  initial,
  onSave,
  onClose,
}: {
  initial: GhostSettings;
  onSave: (settings: GhostSettings) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(initial);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end bg-black/45 p-4"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        className="mt-10 w-full max-w-sm space-y-4 rounded-lg border border-neutral-700 bg-neutral-900 p-4 shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({ ...draft, enabled: draft.enabled && Boolean(draft.apiKey.trim()) });
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-neutral-100">AI completion</h2>
            <p className="mt-1 text-xs leading-relaxed text-neutral-500">
              Optional ghost text appears after 500 ms at the end of an editable line. Requests go
              directly from this browser to the configured endpoint.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
            aria-label="Close settings"
          >
            ×
          </button>
        </div>

        <label className="flex items-center gap-2 text-xs text-neutral-300">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
            className="accent-emerald-500"
          />
          Enable inline suggestions
        </label>

        <label className="block space-y-1 text-xs text-neutral-400">
          <span>Anthropic API key</span>
          <input
            type="password"
            autoComplete="off"
            value={draft.apiKey}
            onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })}
            placeholder="sk-ant-…"
            className="w-full rounded border border-neutral-700 bg-neutral-950 px-2.5 py-2 font-mono text-neutral-200 outline-none focus:border-emerald-700"
          />
          <span className="block leading-relaxed text-neutral-600">
            Stored only in this browser's local storage. Use a restricted key or a proxy endpoint
            for anything beyond personal use.
          </span>
        </label>

        <label className="block space-y-1 text-xs text-neutral-400">
          <span>Model</span>
          <input
            type="text"
            value={draft.model}
            onChange={(event) => setDraft({ ...draft, model: event.target.value })}
            className="w-full rounded border border-neutral-700 bg-neutral-950 px-2.5 py-2 font-mono text-neutral-200 outline-none focus:border-emerald-700"
          />
        </label>

        <details className="text-xs text-neutral-500">
          <summary className="cursor-pointer select-none">Advanced endpoint</summary>
          <input
            type="url"
            value={draft.endpoint}
            onChange={(event) => setDraft({ ...draft, endpoint: event.target.value })}
            className="mt-2 w-full rounded border border-neutral-700 bg-neutral-950 px-2.5 py-2 font-mono text-neutral-200 outline-none focus:border-emerald-700"
          />
        </details>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

export default App;
