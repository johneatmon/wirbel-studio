import { useState } from 'react';
import type { SessionClip } from './model';
import { useSessionStore } from './session-store';

interface SessionWorkspaceProps {
  disabled?: boolean;
  transportPlaying: boolean;
  onSessionChange: () => void;
  onEditClip: (clip: SessionClip) => void;
}

export function SessionWorkspace({
  disabled = false,
  transportPlaying,
  onSessionChange,
  onEditClip,
}: SessionWorkspaceProps) {
  const projectId = useSessionStore((state) => state.projectId);
  const projectName = useSessionStore((state) => state.projectName);
  const tempo = useSessionStore((state) => state.tempo);
  const projects = useSessionStore((state) => state.projects);
  const hydrated = useSessionStore((state) => state.hydrated);
  const persistenceStatus = useSessionStore((state) => state.persistenceStatus);
  const persistenceError = useSessionStore((state) => state.persistenceError);
  const lanes = useSessionStore((state) => state.lanes);
  const laneErrors = useSessionStore((state) => state.laneErrors);
  const clips = useSessionStore((state) => state.clips);
  const scenes = useSessionStore((state) => state.scenes);
  const activeByLane = useSessionStore((state) => state.activeByLane);
  const selectedClipId = useSessionStore((state) => state.selectedClipId);
  const toggleClip = useSessionStore((state) => state.toggleClip);
  const stopLane = useSessionStore((state) => state.stopLane);
  const launchScene = useSessionStore((state) => state.launchScene);
  const stopAll = useSessionStore((state) => state.stopAll);
  const selectClip = useSessionStore((state) => state.selectClip);
  const createClip = useSessionStore((state) => state.createClip);
  const duplicateClip = useSessionStore((state) => state.duplicateClip);
  const deleteClip = useSessionStore((state) => state.deleteClip);
  const renameClip = useSessionStore((state) => state.renameClip);
  const addScene = useSessionStore((state) => state.addScene);
  const renameScene = useSessionStore((state) => state.renameScene);
  const renameProject = useSessionStore((state) => state.renameProject);
  const switchProject = useSessionStore((state) => state.switchProject);
  const createProject = useSessionStore((state) => state.createProject);
  const duplicateProject = useSessionStore((state) => state.duplicateProject);
  const deleteProject = useSessionStore((state) => state.deleteProject);
  const setTempo = useSessionStore((state) => state.setTempo);
  const setLaneGain = useSessionStore((state) => state.setLaneGain);
  const toggleLaneMute = useSessionStore((state) => state.toggleLaneMute);
  const toggleLaneSolo = useSessionStore((state) => state.toggleLaneSolo);
  const setPersistenceState = useSessionStore((state) => state.setPersistenceState);
  const [deleteCandidate, setDeleteCandidate] = useState<SessionClip | null>(null);
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false);

  const selectedClip = clips.find((clip) => clip.id === selectedClipId) ?? null;
  const activeLayerCount = Object.values(activeByLane).filter(Boolean).length;
  const launchDisabled = disabled || !hydrated;
  const requestEval = () => onSessionChange();
  const runProjectAction = (action: () => Promise<void>) => {
    void action().catch((error: unknown) =>
      setPersistenceState('error', error instanceof Error ? error.message : String(error)),
    );
  };

  return (
    <section className="relative flex h-full min-w-0 flex-col" aria-label="Session workspace">
      <div className="flex items-center justify-between gap-5 border-b border-neutral-800 px-5 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold tracking-[0.18em] text-neutral-600 uppercase">
            Live set
          </p>
          <input
            value={projectName}
            onChange={(event) => renameProject(event.target.value)}
            onBlur={() => {
              if (!projectName.trim()) renameProject('Untitled session');
            }}
            aria-label="Project name"
            disabled={!hydrated}
            className="mt-0.5 w-full max-w-sm bg-transparent text-lg font-medium text-neutral-100 outline-none placeholder:text-neutral-700"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <select
            value={projectId}
            onChange={(event) => runProjectAction(() => switchProject(event.target.value))}
            aria-label="Open project"
            disabled={!hydrated}
            className="max-w-40 rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-neutral-400 outline-none hover:border-neutral-700"
          >
            {projects.length ? (
              projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name || 'Untitled session'}
                </option>
              ))
            ) : (
              <option value={projectId}>{projectName}</option>
            )}
          </select>
          <button
            type="button"
            onClick={() => runProjectAction(createProject)}
            disabled={!hydrated}
            className="rounded-md border border-neutral-800 px-2.5 py-1.5 hover:border-neutral-700 hover:bg-neutral-900 hover:text-neutral-300"
          >
            New
          </button>
          <button
            type="button"
            onClick={() => runProjectAction(duplicateProject)}
            disabled={!hydrated}
            className="rounded-md border border-neutral-800 px-2.5 py-1.5 hover:border-neutral-700 hover:bg-neutral-900 hover:text-neutral-300"
          >
            Duplicate
          </button>
          <button
            type="button"
            onClick={() => setDeleteProjectOpen(true)}
            disabled={!hydrated}
            className="rounded-md border border-neutral-800 px-2.5 py-1.5 text-neutral-600 hover:border-red-900/60 hover:bg-red-950/30 hover:text-red-400"
          >
            Delete
          </button>
          <label className="flex items-center gap-1 text-neutral-500">
            <span className="text-neutral-600">tempo</span>
            <input
              type="number"
              min={20}
              max={999}
              value={tempo}
              onChange={(event) => setTempo(Number(event.target.value))}
              aria-label="Project tempo in BPM"
              disabled={!hydrated}
              className="w-14 rounded-md border border-neutral-800 bg-neutral-900 px-1.5 py-1.5 text-center text-neutral-300 outline-none hover:border-neutral-700 focus:border-neutral-600"
            />
            <span className="text-neutral-600">bpm</span>
          </label>
          <span className={persistenceStatus === 'error' ? 'text-red-400' : 'text-neutral-600'}>
            {persistenceStatus === 'saving'
              ? 'saving…'
              : persistenceStatus === 'loading'
                ? 'loading…'
                : persistenceStatus === 'error'
                  ? 'save failed'
                  : 'saved'}
          </span>
          <span>
            {activeLayerCount} {activeLayerCount === 1 ? 'layer' : 'layers'}{' '}
            {transportPlaying ? 'active' : 'armed'}
          </span>
          <button
            type="button"
            onClick={() => {
              stopAll();
              requestEval();
            }}
            disabled={launchDisabled || activeLayerCount === 0}
            className="rounded-md border border-neutral-800 px-2.5 py-1.5 hover:border-neutral-700 hover:bg-neutral-900 hover:text-neutral-300 disabled:opacity-30"
          >
            Stop all
          </button>
        </div>
      </div>

      {Object.keys(laneErrors).length > 0 && (
        <div className="border-b border-amber-950/60 bg-amber-950/20 px-5 py-1.5 text-[10px] text-amber-400">
          {Object.entries(laneErrors).map(([laneId, message]) => {
            const lane = lanes.find((candidate) => candidate.id === laneId);
            return (
              <span key={laneId} className="mr-4">
                {lane?.name ?? laneId}: {message} (playing last-known-good)
              </span>
            );
          })}
        </div>
      )}

      {persistenceError && (
        <div className="border-b border-red-950/60 bg-red-950/20 px-5 py-1.5 text-[10px] text-red-400">
          Project autosave: {persistenceError}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto p-5">
        <div
          className="grid min-w-[820px] gap-2"
          style={{ gridTemplateColumns: `116px repeat(${lanes.length}, minmax(126px, 1fr))` }}
        >
          <div className="flex items-end px-2 pb-2 text-[10px] font-semibold tracking-wider text-neutral-600 uppercase">
            Scenes
          </div>
          {lanes.map((lane) => {
            const laneError = laneErrors[lane.id];
            return (
              <div key={lane.id} className="flex flex-col gap-1.5 px-1 pb-2">
                <div className="flex items-end justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <div className="text-xs font-medium text-neutral-300">{lane.name}</div>
                      {laneError && (
                        <span
                          className="text-[10px] text-amber-500"
                          title={`${laneError} — last-known-good clip is playing`}
                        >
                          ⚠
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[10px] text-neutral-600">{lane.role}</div>
                  </div>
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${activeByLane[lane.id] ? 'bg-emerald-400' : 'bg-neutral-800'}`}
                  />
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      toggleLaneMute(lane.id);
                      requestEval();
                    }}
                    disabled={!hydrated}
                    aria-pressed={lane.muted}
                    aria-label={`${lane.muted ? 'Unmute' : 'Mute'} ${lane.name}`}
                    className={`rounded px-1.5 py-0.5 text-[10px] disabled:opacity-40 ${
                      lane.muted
                        ? 'bg-neutral-700 text-neutral-200'
                        : 'text-neutral-600 hover:bg-neutral-800 hover:text-neutral-300'
                    }`}
                  >
                    M
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      toggleLaneSolo(lane.id);
                      requestEval();
                    }}
                    disabled={!hydrated}
                    aria-pressed={lane.solo}
                    aria-label={`${lane.solo ? 'Unsolo' : 'Solo'} ${lane.name}`}
                    className={`rounded px-1.5 py-0.5 text-[10px] disabled:opacity-40 ${
                      lane.solo
                        ? 'bg-amber-900/70 text-amber-200'
                        : 'text-neutral-600 hover:bg-neutral-800 hover:text-neutral-300'
                    }`}
                  >
                    S
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={lane.gain}
                    onChange={(event) => setLaneGain(lane.id, Number(event.target.value))}
                    onPointerUp={() => requestEval()}
                    onKeyUp={() => requestEval()}
                    disabled={!hydrated}
                    aria-label={`${lane.name} gain`}
                    className="h-1 min-w-0 flex-1 accent-emerald-500"
                  />
                </div>
              </div>
            );
          })}

          {scenes.map((scene, sceneIndex) => {
            const sceneIsActive = lanes.every(
              (lane) => activeByLane[lane.id] === (scene.clipIds[lane.id] ?? null),
            );
            return (
              <div key={scene.id} className="contents">
                <div
                  className={`group flex min-h-24 flex-col justify-between rounded-lg border p-3 transition-colors ${
                    sceneIsActive
                      ? 'border-emerald-700/70 bg-emerald-950/30'
                      : 'border-neutral-800 bg-neutral-900/35 hover:border-neutral-700 hover:bg-neutral-900/70'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-neutral-600">
                      {String(sceneIndex + 1).padStart(2, '0')}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        launchScene(scene.id);
                        requestEval();
                      }}
                      disabled={launchDisabled}
                      className={`rounded px-1.5 py-0.5 text-xs disabled:opacity-40 ${
                        sceneIsActive
                          ? 'bg-emerald-900/60 text-emerald-300'
                          : 'text-neutral-600 hover:bg-neutral-800 hover:text-neutral-300'
                      }`}
                      aria-label={`Launch ${scene.name || 'Untitled scene'}`}
                    >
                      ▶
                    </button>
                  </div>
                  <input
                    value={scene.name}
                    onChange={(event) => renameScene(scene.id, event.target.value)}
                    onBlur={() => {
                      if (!scene.name.trim()) renameScene(scene.id, 'Untitled scene');
                    }}
                    aria-label={`Scene ${sceneIndex + 1} name`}
                    disabled={!hydrated}
                    className="w-full bg-transparent text-xs font-medium text-neutral-300 outline-none"
                  />
                </div>

                {lanes.map((lane) => {
                  const clipId = scene.clipIds[lane.id];
                  const clip = clips.find((candidate) => candidate.id === clipId);
                  if (!clip) {
                    return (
                      <button
                        key={lane.id}
                        type="button"
                        onClick={() => {
                          const created = createClip(lane.id, scene.id);
                          if (created) onEditClip(created);
                        }}
                        disabled={!hydrated}
                        className="min-h-24 rounded-lg border border-dashed border-neutral-900 bg-neutral-900/15 text-[10px] text-neutral-700 hover:border-neutral-700 hover:bg-neutral-900/40 hover:text-neutral-400"
                      >
                        + new clip
                      </button>
                    );
                  }
                  const isActive = activeByLane[lane.id] === clip.id;
                  const isSelected = selectedClipId === clip.id;
                  return (
                    <div
                      key={lane.id}
                      className={`group relative min-h-24 overflow-hidden rounded-lg border transition-colors ${
                        isActive
                          ? 'border-emerald-700/80 bg-neutral-900'
                          : isSelected
                            ? 'border-neutral-600 bg-neutral-900/80'
                            : 'border-neutral-800 bg-neutral-900/45 hover:border-neutral-700'
                      }`}
                      style={{ boxShadow: isActive ? `inset 3px 0 0 ${clip.color}` : undefined }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          toggleClip(clip.id);
                          requestEval();
                        }}
                        onFocus={() => selectClip(clip.id)}
                        disabled={launchDisabled}
                        className="flex h-full min-h-24 w-full flex-col items-start justify-between p-3 text-left disabled:opacity-40"
                        aria-pressed={isActive}
                        aria-label={`${isActive ? (transportPlaying ? 'Stop' : 'Unselect') : 'Launch'} ${clip.name || 'Untitled clip'}`}
                      >
                        <span
                          className="h-1.5 w-9 rounded-full opacity-80"
                          style={{ backgroundColor: clip.color }}
                        />
                        <span>
                          <span className="block text-xs font-medium text-neutral-200">
                            {clip.name || 'Untitled clip'}
                          </span>
                          <span className="mt-1 block font-mono text-[9px] text-neutral-600">
                            {isActive ? (transportPlaying ? 'playing' : 'armed') : 'queued clip'}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          selectClip(clip.id);
                          onEditClip(clip);
                        }}
                        disabled={!hydrated}
                        className="absolute top-2 right-2 rounded px-1.5 py-1 text-[10px] text-neutral-600 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-neutral-800 hover:text-neutral-300 focus:opacity-100"
                        aria-label={`Edit ${clip.name || 'Untitled clip'}`}
                      >
                        edit
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}

          <button
            type="button"
            onClick={addScene}
            disabled={!hydrated}
            className="rounded-md border border-dashed border-neutral-800 py-2 text-[10px] text-neutral-600 hover:border-neutral-700 hover:bg-neutral-900 hover:text-neutral-300"
          >
            + add scene
          </button>
          {lanes.map((lane) => (
            <button
              key={lane.id}
              type="button"
              onClick={() => {
                stopLane(lane.id);
                requestEval();
              }}
              disabled={launchDisabled || !activeByLane[lane.id]}
              className="rounded-md border border-neutral-900 py-2 text-[10px] text-neutral-600 hover:border-neutral-800 hover:bg-neutral-900 hover:text-neutral-400 disabled:opacity-25"
            >
              ■ stop {lane.name.toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-12 items-center gap-3 border-t border-neutral-900 px-5 py-2 text-xs">
        {selectedClip ? (
          <>
            <span className="text-[10px] tracking-wider text-neutral-600 uppercase">Selected</span>
            <input
              value={selectedClip.name}
              onChange={(event) => renameClip(selectedClip.id, event.target.value)}
              onBlur={() => {
                if (!selectedClip.name.trim()) renameClip(selectedClip.id, 'Untitled clip');
              }}
              aria-label="Selected clip name"
              className="w-44 rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-neutral-300 outline-none focus:border-neutral-700"
            />
            <button
              type="button"
              onClick={() => onEditClip(selectedClip)}
              className="rounded px-2 py-1 text-neutral-500 hover:bg-neutral-900 hover:text-neutral-300"
            >
              Edit code
            </button>
            <button
              type="button"
              onClick={() => {
                const duplicate = duplicateClip(selectedClip.id);
                if (duplicate) selectClip(duplicate.id);
              }}
              className="rounded px-2 py-1 text-neutral-500 hover:bg-neutral-900 hover:text-neutral-300"
            >
              Duplicate
            </button>
            <button
              type="button"
              onClick={() => setDeleteCandidate(selectedClip)}
              className="rounded px-2 py-1 text-neutral-600 hover:bg-red-950/30 hover:text-red-400"
            >
              Delete
            </button>
          </>
        ) : (
          <span className="text-[10px] text-neutral-600">
            Select a clip to rename, duplicate, delete, or edit its Strudel source.
          </span>
        )}
        <span className="ml-auto text-[10px] text-neutral-700">
          Clip changes use transport quantize · one clip per lane
        </span>
      </div>

      {deleteProjectOpen && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 p-6">
          <div className="w-full max-w-sm rounded-lg border border-neutral-700 bg-neutral-900 p-4 shadow-2xl">
            <h2 className="text-sm font-medium text-neutral-100">Delete project?</h2>
            <p className="mt-2 text-xs leading-relaxed text-neutral-500">
              “{projectName || 'Untitled session'}” will be removed from this browser.{' '}
              {projects.length > 1
                ? 'Another saved project will open.'
                : 'A fresh empty project will be created.'}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteProjectOpen(false)}
                className="rounded px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteProjectOpen(false);
                  runProjectAction(deleteProject);
                }}
                className="rounded bg-red-800 px-3 py-1.5 text-xs text-white hover:bg-red-700"
              >
                Delete project
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteCandidate && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 p-6">
          <div className="w-full max-w-sm rounded-lg border border-neutral-700 bg-neutral-900 p-4 shadow-2xl">
            <h2 className="text-sm font-medium text-neutral-100">Delete clip?</h2>
            <p className="mt-2 text-xs leading-relaxed text-neutral-500">
              “{deleteCandidate.name || 'Untitled clip'}” will be removed from every scene. The
              project autosave cannot undo this after reload.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                className="rounded px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteClip(deleteCandidate.id);
                  setDeleteCandidate(null);
                }}
                className="rounded bg-red-800 px-3 py-1.5 text-xs text-white hover:bg-red-700"
              >
                Delete clip
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
