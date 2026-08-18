import { compileSession, type ActiveClips, type SessionClip } from './model';
import { useSessionStore } from './session-store';

interface SessionWorkspaceProps {
  disabled?: boolean;
  onCompositionChange: (code: string | null) => void;
  onEditClip: (clip: SessionClip) => void;
}

export function SessionWorkspace({
  disabled = false,
  onCompositionChange,
  onEditClip,
}: SessionWorkspaceProps) {
  const lanes = useSessionStore((state) => state.lanes);
  const clips = useSessionStore((state) => state.clips);
  const scenes = useSessionStore((state) => state.scenes);
  const activeByLane = useSessionStore((state) => state.activeByLane);
  const selectedClipId = useSessionStore((state) => state.selectedClipId);
  const toggleClip = useSessionStore((state) => state.toggleClip);
  const stopLane = useSessionStore((state) => state.stopLane);
  const launchScene = useSessionStore((state) => state.launchScene);
  const stopAll = useSessionStore((state) => state.stopAll);
  const selectClip = useSessionStore((state) => state.selectClip);

  const emit = (next: ActiveClips) => onCompositionChange(compileSession(lanes, clips, next));

  return (
    <section className="flex h-full min-w-0 flex-col" aria-label="Session workspace">
      <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.18em] text-neutral-600 uppercase">
            Live set
          </p>
          <h1 className="mt-1 text-lg font-medium text-neutral-100">Untitled session</h1>
        </div>
        <div className="flex items-center gap-3 text-xs text-neutral-500">
          <span>{Object.values(activeByLane).filter(Boolean).length} layers active</span>
          <button
            type="button"
            onClick={() => emit(stopAll())}
            disabled={disabled || !Object.values(activeByLane).some(Boolean)}
            className="rounded-md border border-neutral-800 px-2.5 py-1.5 hover:border-neutral-700 hover:bg-neutral-900 hover:text-neutral-300 disabled:opacity-30"
          >
            Stop all
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-5">
        <div
          className="grid min-w-[820px] gap-2"
          style={{ gridTemplateColumns: `116px repeat(${lanes.length}, minmax(126px, 1fr))` }}
        >
          <div className="flex items-end px-2 pb-2 text-[10px] font-semibold tracking-wider text-neutral-600 uppercase">
            Scenes
          </div>
          {lanes.map((lane) => (
            <div key={lane.id} className="flex items-end justify-between px-2 pb-2">
              <div>
                <div className="text-xs font-medium text-neutral-300">{lane.name}</div>
                <div className="mt-0.5 text-[10px] text-neutral-600">{lane.role}</div>
              </div>
              <span
                className={`h-1.5 w-1.5 rounded-full ${activeByLane[lane.id] ? 'bg-emerald-400' : 'bg-neutral-800'}`}
              />
            </div>
          ))}

          {scenes.map((scene, sceneIndex) => {
            const sceneIsActive = lanes.every(
              (lane) => activeByLane[lane.id] === (scene.clipIds[lane.id] ?? null),
            );
            return (
              <div key={scene.id} className="contents">
                <button
                  type="button"
                  onClick={() => emit(launchScene(scene.id))}
                  disabled={disabled}
                  className={`group flex min-h-24 flex-col justify-between rounded-lg border p-3 text-left transition-colors disabled:opacity-40 ${
                    sceneIsActive
                      ? 'border-emerald-700/70 bg-emerald-950/30'
                      : 'border-neutral-800 bg-neutral-900/35 hover:border-neutral-700 hover:bg-neutral-900/70'
                  }`}
                >
                  <span className="text-[10px] text-neutral-600">0{sceneIndex + 1}</span>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-neutral-300">
                    <span className={sceneIsActive ? 'text-emerald-400' : 'text-neutral-600'}>
                      ▶
                    </span>
                    {scene.name}
                  </span>
                </button>

                {lanes.map((lane) => {
                  const clipId = scene.clipIds[lane.id];
                  const clip = clips.find((candidate) => candidate.id === clipId);
                  if (!clip)
                    return <div key={lane.id} className="min-h-24 rounded-lg bg-neutral-900/20" />;
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
                        onClick={() => emit(toggleClip(clip.id))}
                        onFocus={() => selectClip(clip.id)}
                        disabled={disabled}
                        className="flex h-full min-h-24 w-full flex-col items-start justify-between p-3 text-left disabled:opacity-40"
                        aria-pressed={isActive}
                        aria-label={`${isActive ? 'Stop' : 'Launch'} ${clip.name}`}
                      >
                        <span
                          className="h-1.5 w-9 rounded-full opacity-80"
                          style={{ backgroundColor: clip.color }}
                        />
                        <span>
                          <span className="block text-xs font-medium text-neutral-200">
                            {clip.name}
                          </span>
                          <span className="mt-1 block font-mono text-[9px] text-neutral-600">
                            {isActive ? 'playing' : 'queued clip'}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          selectClip(clip.id);
                          onEditClip(clip);
                        }}
                        className="absolute top-2 right-2 rounded px-1.5 py-1 text-[10px] text-neutral-600 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-neutral-800 hover:text-neutral-300 focus:opacity-100"
                        aria-label={`Edit ${clip.name}`}
                      >
                        edit
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}

          <div className="px-2 pt-1 text-[10px] text-neutral-700">lane stop</div>
          {lanes.map((lane) => (
            <button
              key={lane.id}
              type="button"
              onClick={() => emit(stopLane(lane.id))}
              disabled={disabled || !activeByLane[lane.id]}
              className="rounded-md border border-neutral-900 py-2 text-[10px] text-neutral-600 hover:border-neutral-800 hover:bg-neutral-900 hover:text-neutral-400 disabled:opacity-25"
            >
              ■ stop {lane.name.toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-neutral-900 px-5 py-2 text-[10px] text-neutral-600">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/70" />
        Clip changes use the transport quantize setting. One clip plays per lane.
      </div>
    </section>
  );
}
