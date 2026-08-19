import { useCallback, useEffect, useRef, useState } from 'react';
import { StrudelEditor, type StrudelEditorHandle } from './editor/editor';
import { evaluateCode, initEngine, setCps, stopEngine, tempoToCps, type QuantizeBoundary } from './audio/engine';
import { startClockLoop } from './audio/clock';
import { useAppStore } from './store/app-store';
import { useClockStore } from './store/clock-store';
import { allBlocks, refreshCommunityRegistry } from './blocks/registry';
import { VisualCanvas } from './visuals/visual-canvas';
import {
  AI_FEATURES_VISIBLE,
  loadGhostSettings,
  saveGhostSettings,
  type GhostSettings,
} from './completions/ghost-settings';
import type { GhostStatus } from './editor/ghost-text';
import { SessionWorkspace } from './session/session-workspace';
import { type SessionClip } from './session/model';
import { evaluateActiveSession } from './session/eval-session';
import { startArrangementPlayer } from './session/arrangement-player';
import { startSessionPersistence, snapshotProject, useSessionStore } from './session/session-store';
import { formatRiffInsert, requestRiffSuggestion } from './completions/ghost-client';
import { CommandPalette, type CommandItem } from './ui/command-palette';
import { RiffPreview } from './ui/riff-preview';
import { InterchangePanel } from './interchange/interchange-panel';
import { sessionPortableCode, strudelShareUrl } from './interchange/export-session';
import {
  buildShareUrl,
  clearShareHash,
  parseShareHash,
  projectSharePayload,
  shareUrlLength,
  SHARE_URL_MAX,
} from './interchange/url-share';
import { OnboardingOverlay } from './ui/onboarding-overlay';
import { isOnboardingComplete } from './ui/onboarding-state';
import { LibraryPanel } from './ui/library-panel';
import { CommunityBlocksPanel } from './ui/community-blocks-panel';


const STARTER_CODE = `note("<c3 eb3 g3 bb3>/2")
  .s("sawtooth")
  .lpf(sine.range(420, 1800).slow(8))
  .lpq(8)
  .shape(0.28)
  .attack(0.4)
  .release(0.9)
  .room(0.65)
  .delay(0.28)
  .gain(0.22)

// $: s("bd*4, ~ sd ~, hh*16").bank("RolandTR808").gain(0.55)
`;

const QUANTIZE_OPTIONS: { value: QuantizeBoundary; label: string }[] = [
  { value: 'immediate', label: 'off' },
  { value: 'beat', label: 'beat' },
  { value: 'cycle', label: 'cycle' },
];

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

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
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [showInterchange, setShowInterchange] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showCommunityBlocks, setShowCommunityBlocks] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => !isOnboardingComplete());
  const [showVisualizer, setShowVisualizer] = useState(true);
  const [blocksVersion, setBlocksVersion] = useState(0);
  const [riff, setRiff] = useState<{
    status: 'loading' | 'ready' | 'error';
    code: string;
    error: string | null;
    backup: string;
  } | null>(null);
  const riffAbortRef = useRef<AbortController | null>(null);
  const bootedRef = useRef(false);
  const editorRef = useRef<StrudelEditorHandle>(null);
  const selectedClipId = useSessionStore((state) => state.selectedClipId);
  const projectId = useSessionStore((state) => state.projectId);
  const tempo = useSessionStore((state) => state.tempo);
  const quantize = useSessionStore((state) => state.launchQuantize);
  const setLaunchQuantize = useSessionStore((state) => state.setLaunchQuantize);
  const selectedClip = useSessionStore((state) =>
    state.clips.find((clip) => clip.id === state.selectedClipId),
  );
  const capturing = useSessionStore((state) => state.capturing);
  const playingArrangement = useSessionStore((state) => state.playingArrangement);
  const arrangementLength = useSessionStore((state) => state.arrangement.lengthCycles);
  const hasActiveClip = useSessionStore((state) => Object.values(state.activeByLane).some(Boolean));
  const hydrated = useSessionStore((state) => state.hydrated);
  const scenes = useSessionStore((state) => state.scenes);
  const shareHandledRef = useRef(false);
  const blockDefs = allBlocks();
  void blocksVersion;

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
    if (!hydrated || shareHandledRef.current) return;
    const payload = parseShareHash();
    if (!payload) return;
    shareHandledRef.current = true;
    void useSessionStore
      .getState()
      .importSharePayload(payload)
      .then(() => clearShareHash())
      .catch(() => {
        shareHandledRef.current = false;
      });
  }, [hydrated]);

  useEffect(() => {
    useAppStore.getState().setQuantize(quantize);
  }, [quantize]);

  useEffect(() => {
    if (!ready) return;
    setCps(tempoToCps(tempo));
  }, [ready, tempo, projectId]);

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

  const handleSessionChange = useCallback(() => {
    if (!ready) return;
    void evaluateActiveSession(quantize, markEvaluated);
  }, [ready, quantize, markEvaluated]);

  useEffect(
    () =>
      startArrangementPlayer(() => {
        if (!ready) return;
        void evaluateActiveSession('immediate', markEvaluated);
      }),
    [markEvaluated, ready],
  );

  const handleStop = useCallback(() => {
    useSessionStore.getState().stopArrangementPlayback();
    useSessionStore.getState().stopAll();
    stopEngine();
  }, []);

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
        void evaluateActiveSession('immediate', markEvaluated);
        return;
      }
      void handleEvaluate(code, 'immediate');
    },
    [handleEvaluate, markEvaluated, selectedClipId],
  );

  const handleTransportEvaluate = useCallback(() => {
    if (workspace === 'code') {
      handleEditorEvaluate(editorRef.current?.getCode() ?? '');
      return;
    }

    const session = useSessionStore.getState();
    if (!Object.values(session.activeByLane).some(Boolean)) {
      session.launchScene(session.scenes[0]?.id ?? '');
    }
    handleSessionChange();
  }, [handleEditorEvaluate, handleSessionChange, workspace]);

  const handleSaveSettings = useCallback((settings: GhostSettings) => {
    saveGhostSettings(settings);
    setGhostSettings(settings);
    setGhostStatus({ status: 'idle' });
    setShowSettings(false);
  }, []);

  const toggleCapture = useCallback(() => {
    const session = useSessionStore.getState();
    if (session.capturing) session.stopCapture();
    else session.startCapture();
  }, []);

  const playArrangement = useCallback(() => {
    if (!useSessionStore.getState().playArrangement()) return;
    void evaluateActiveSession('immediate', markEvaluated);
  }, [markEvaluated]);

  const startRiff = useCallback(() => {
    const settings = loadGhostSettings();
    setGhostSettings(settings);
    if (!settings.apiKey.trim() || !ready) return;
    setWorkspace('code');
    riffAbortRef.current?.abort();
    const controller = new AbortController();
    riffAbortRef.current = controller;
    const backup = editorRef.current?.getCode() ?? '';
    setRiff({ status: 'loading', code: '', error: null, backup });
    void requestRiffSuggestion(backup, settings, controller.signal)
      .then(async (code) => {
        if (controller.signal.aborted) return;
        const stacked = backup.trim() ? `stack(\n${backup.trim()},\n${code}\n)` : code;
        await evaluateCode(stacked, 'immediate');
        markEvaluated();
        setRiff({ status: 'ready', code, error: null, backup });
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setRiff({
          status: 'error',
          code: '',
          error: reason instanceof Error ? reason.message : String(reason),
          backup,
        });
      });
  }, [markEvaluated, ready]);

  const rejectRiff = useCallback(() => {
    riffAbortRef.current?.abort();
    const backup = riff?.backup;
    setRiff(null);
    if (backup !== undefined) handleEditorEvaluate(backup);
  }, [handleEditorEvaluate, riff]);

  const acceptRiff = useCallback(() => {
    if (!riff?.code) return;
    editorRef.current?.insertAtEnd(formatRiffInsert(riff.code));
    setRiff(null);
    handleEditorEvaluate(editorRef.current?.getCode() ?? '');
  }, [handleEditorEvaluate, riff]);

  const launchFirstScene = useCallback(() => {
    const session = useSessionStore.getState();
    const sceneId = session.scenes[0]?.id;
    if (!sceneId) return;
    session.launchScene(sceneId);
    void evaluateActiveSession(quantize, markEvaluated);
  }, [markEvaluated, quantize]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (paletteOpen) {
          event.preventDefault();
          setPaletteOpen(false);
          return;
        }
        if (showLibrary) {
          event.preventDefault();
          setShowLibrary(false);
          return;
        }
        if (showCommunityBlocks) {
          event.preventDefault();
          setShowCommunityBlocks(false);
          return;
        }
        if (showInterchange) {
          event.preventDefault();
          setShowInterchange(false);
          return;
        }
        if (riff) {
          event.preventDefault();
          rejectRiff();
        }
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'r') {
        event.preventDefault();
        toggleCapture();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setShowSettings(false);
        setShowInterchange(false);
        setShowLibrary(false);
        setShowCommunityBlocks(false);
        setPaletteOpen((open) => !open);
        return;
      }
      if (workspace !== 'session' || isTypingTarget(event.target)) return;
      const session = useSessionStore.getState();
      if (/^[1-9]$/.test(event.key) && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const scene = session.scenes[Number(event.key) - 1];
        if (!scene) return;
        event.preventDefault();
        session.launchScene(scene.id);
        void evaluateActiveSession(quantize, markEvaluated);
        return;
      }
      if (event.key === ' ' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        const clipId = session.selectedClipId;
        if (!clipId) return;
        if (event.shiftKey) {
          const clip = session.clips.find((candidate) => candidate.id === clipId);
          if (clip) {
            session.stopLane(clip.laneId);
            void evaluateActiveSession(quantize, markEvaluated);
          }
          return;
        }
        session.toggleClip(clipId);
        void evaluateActiveSession(quantize, markEvaluated);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    markEvaluated,
    paletteOpen,
    quantize,
    rejectRiff,
    riff,
    showCommunityBlocks,
    showInterchange,
    showLibrary,
    toggleCapture,
    workspace,
  ]);

  const commandItems: CommandItem[] = [
    {
      id: 'capture',
      label: capturing ? 'Stop jam capture' : 'Capture jam',
      hint: '⌘⇧R',
      run: toggleCapture,
    },
    {
      id: 'play-arrangement',
      label: 'Play arrangement',
      disabled: arrangementLength <= 0 && !capturing,
      run: playArrangement,
    },
    {
      id: 'clear-arrangement',
      label: 'Clear arrangement',
      disabled: arrangementLength <= 0,
      run: () => useSessionStore.getState().clearArrangement(),
    },
    {
      id: 'copy-strudel',
      label: 'Copy session as Strudel',
      disabled: !hasActiveClip,
      run: () => {
        const code = sessionPortableCode();
        if (code) void navigator.clipboard.writeText(code);
      },
    },
    {
      id: 'open-strudel',
      label: 'Open session in strudel.cc',
      disabled: !hasActiveClip,
      run: () => {
        const code = sessionPortableCode();
        if (code) window.open(strudelShareUrl(code), '_blank', 'noopener');
      },
    },
    {
      id: 'copy-studio-link',
      label: 'Copy Studio share link',
      run: () => {
        const payload = projectSharePayload(snapshotProject());
        if (shareUrlLength(payload) > SHARE_URL_MAX) return;
        void navigator.clipboard.writeText(buildShareUrl(payload));
      },
    },
    {
      id: 'toggle-visualizer',
      label: showVisualizer ? 'Hide hap lane' : 'Show hap lane',
      run: () => setShowVisualizer((open) => !open),
    },
    {
      id: 'library',
      label: 'New project from template',
      run: () => setShowLibrary(true),
    },
    {
      id: 'community-blocks',
      label: 'Community blocks',
      run: () => setShowCommunityBlocks(true),
    },
    {
      id: 'interchange',
      label: 'MIDI and project files',
      hint: 'Share',
      run: () => setShowInterchange(true),
    },
    ...(AI_FEATURES_VISIBLE
      ? [
          {
            id: 'riff',
            label: 'Riff a complementary layer',
            hint: ghostSettings.apiKey ? 'AI' : 'Needs API key',
            disabled: !ready || !ghostSettings.apiKey,
            run: startRiff,
          },
        ]
      : []),
    ...blockDefs.map((def) => ({
      id: `block-${def.id}`,
      label: `Insert ${def.name}`,
      hint: def.category,
      run: () => {
        setWorkspace('code');
        editorRef.current?.insertBlock(def.id);
      },
    })),
  ];

  return (
    <div className="flex h-full flex-col bg-neutral-950 text-neutral-200">
      <header className="flex items-center gap-4 border-b border-neutral-800 px-4 py-2 text-sm">
        <h1 className="shrink-0 text-sm font-medium text-neutral-400">strudel studio</h1>
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
        <button
          type="button"
          onClick={toggleCapture}
          className={`rounded px-2.5 py-1 text-xs font-medium ${
            capturing
              ? 'bg-red-900/80 text-red-100'
              : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200'
          }`}
        >
          {capturing ? '● Rec' : '○ Rec'}
        </button>
        <button
          type="button"
          onClick={playArrangement}
          disabled={arrangementLength <= 0 && !capturing}
          className={`rounded px-2.5 py-1 text-xs font-medium disabled:opacity-40 ${
            playingArrangement
              ? 'bg-emerald-900/70 text-emerald-200'
              : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200'
          }`}
        >
          {playingArrangement ? 'Playing take' : 'Play take'}
        </button>
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
        <button
          type="button"
          onClick={() => setShowVisualizer((open) => !open)}
          aria-pressed={showVisualizer}
          className={`rounded px-2 py-1 text-xs ${
            showVisualizer
              ? 'bg-neutral-800 text-neutral-200'
              : 'text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200'
          }`}
          title={showVisualizer ? 'Hide hap lane' : 'Show hap lane'}
        >
          Lane
        </button>
        <button
          type="button"
          onClick={() => {
            setShowSettings(false);
            setShowInterchange(true);
          }}
          className="rounded px-2 py-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
          aria-label="Share and interchange"
          title="Share, MIDI, and project files"
        >
          Share
        </button>
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="rounded px-2 py-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
          aria-label="Open command palette"
          title="Command palette"
        >
          ⌘K
        </button>
        {AI_FEATURES_VISIBLE && (
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="rounded px-2 py-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
            aria-label="Open settings"
            title="Settings"
          >
            ⚙
          </button>
        )}
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
          {blockDefs.map((def) => (
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
        <div className={`min-h-0 flex-1 ${showVisualizer ? 'border-r border-neutral-800' : ''}`}>
          <div className={workspace === 'session' ? 'h-full' : 'hidden'}>
            <SessionWorkspace
              disabled={!ready}
              transportPlaying={playing}
              onSessionChange={handleSessionChange}
              onEditClip={handleEditClip}
              onBrowseTemplates={() => setShowLibrary(true)}
            />
            {showOnboarding && !hasActiveClip && hydrated && (
              <OnboardingOverlay
                sceneCount={scenes.length}
                onLaunchFirst={launchFirstScene}
                onDismiss={() => setShowOnboarding(false)}
              />
            )}
          </div>
          <div className={workspace === 'code' ? 'relative h-full' : 'hidden'}>
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
            {AI_FEATURES_VISIBLE && riff && (
              <RiffPreview
                code={riff.code}
                error={riff.error}
                loading={riff.status === 'loading'}
                onAccept={acceptRiff}
                onReject={rejectRiff}
              />
            )}
          </div>
        </div>
        {showVisualizer ? (
          <aside className="relative w-80 shrink-0 bg-neutral-950" aria-label="Hap lane">
            <button
              type="button"
              onClick={() => setShowVisualizer(false)}
              className="absolute top-2 left-2 z-10 rounded bg-neutral-900/80 px-1.5 py-0.5 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
              aria-label="Hide hap lane"
              title="Hide hap lane"
            >
              ›
            </button>
            <VisualCanvas />
          </aside>
        ) : (
          <button
            type="button"
            onClick={() => setShowVisualizer(true)}
            className="flex w-7 shrink-0 items-start justify-center border-l border-neutral-800 bg-neutral-950 pt-2 text-xs text-neutral-500 hover:bg-neutral-900 hover:text-neutral-200"
            aria-label="Show hap lane"
            title="Show hap lane"
          >
            ‹
          </button>
        )}
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
        {AI_FEATURES_VISIBLE && ghostSettings.enabled && (
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

      {paletteOpen && (
        <CommandPalette items={commandItems} onClose={() => setPaletteOpen(false)} />
      )}

      {showLibrary && (
        <LibraryPanel
          onClose={() => setShowLibrary(false)}
          onCreateFromPack={(packId) => {
            void useSessionStore
              .getState()
              .createProjectFromPack(packId)
              .catch((error: unknown) =>
                useSessionStore
                  .getState()
                  .setPersistenceState(
                    'error',
                    error instanceof Error ? error.message : String(error),
                  ),
              );
          }}
        />
      )}

      {showCommunityBlocks && (
        <CommunityBlocksPanel
          onClose={() => setShowCommunityBlocks(false)}
          onBlocksChanged={() => {
            refreshCommunityRegistry();
            setBlocksVersion((version) => version + 1);
          }}
        />
      )}

      {showInterchange && (
        <InterchangePanel engineReady={ready} onClose={() => setShowInterchange(false)} />
      )}

      {AI_FEATURES_VISIBLE && showSettings && (
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
