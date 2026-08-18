import { useMemo, useRef } from 'react';
import { currentCycleNow, useClockStore } from '../store/clock-store';
import { deriveLaneSpans } from './arrangement';
import { useSessionStore } from './session-store';

export function ArrangementTimeline() {
  const lanes = useSessionStore((state) => state.lanes);
  const clips = useSessionStore((state) => state.clips);
  const scenes = useSessionStore((state) => state.scenes);
  const arrangement = useSessionStore((state) => state.arrangement);
  const capturing = useSessionStore((state) => state.capturing);
  const playingArrangement = useSessionStore((state) => state.playingArrangement);
  const captureOriginCycle = useSessionStore((state) => state.captureOriginCycle);
  const playbackOriginCycle = useSessionStore((state) => state.playbackOriginCycle);
  const moveSection = useSessionStore((state) => state.moveSection);
  const cycle = useClockStore((state) => state.cycle);
  const phase = useClockStore((state) => state.phase);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<string | null>(null);

  const elapsed = capturing ? Math.max(0, cycle + phase - captureOriginCycle) : 0;
  const length = capturing ? Math.max(elapsed, 8) : Math.max(arrangement.lengthCycles, 1);
  const playhead = capturing
    ? elapsed
    : playingArrangement
      ? Math.max(0, currentCycleNow() - playbackOriginCycle)
      : null;

  const spans = useMemo(
    () =>
      deriveLaneSpans(
        arrangement.originActive,
        arrangement.events,
        capturing ? elapsed : arrangement.lengthCycles,
        lanes.map((lane) => lane.id),
        scenes,
      ),
    [arrangement, capturing, elapsed, lanes, scenes],
  );

  const cycleFromPointer = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return ((clientX - rect.left) / rect.width) * length;
  };

  if (!capturing && arrangement.lengthCycles <= 0 && arrangement.events.length === 0) {
    return (
      <div className="border-t border-neutral-900 px-5 py-2 text-[10px] text-neutral-600">
        ⌘⇧R captures a jam to this timeline · replay uses the scheduler clock, not wall time
      </div>
    );
  }

  return (
    <div className="border-t border-neutral-900 px-5 py-2" aria-label="Arrangement timeline">
      <div className="flex gap-2">
        <div className="flex w-14 shrink-0 flex-col justify-end gap-0.5 pb-0">
          {lanes.map((lane) => (
            <div key={lane.id} className="h-3.5 truncate text-[10px] leading-none text-neutral-600">
              {lane.name}
            </div>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative mb-1 h-4">
            {arrangement.sections.map((section, index) => (
              <div
                key={section.id}
                className="absolute top-0 text-[10px] text-neutral-500"
                style={{ left: `${(section.startCycle / length) * 100}%` }}
              >
                {index > 0 && (
                  <button
                    type="button"
                    aria-label={`Move section ${section.name}`}
                    className="absolute top-0 -left-1 h-4 w-2 cursor-ew-resize rounded-sm bg-neutral-700"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.currentTarget.setPointerCapture(event.pointerId);
                      dragRef.current = section.id;
                    }}
                    onPointerMove={(event) => {
                      if (!dragRef.current) return;
                      moveSection(dragRef.current, cycleFromPointer(event.clientX));
                    }}
                    onPointerUp={() => {
                      dragRef.current = null;
                    }}
                  />
                )}
                <span className="ml-1.5">{section.name}</span>
              </div>
            ))}
            <span className="absolute top-0 right-0 text-[10px] text-neutral-700">
              {length.toFixed(0)}c{capturing ? ' · rec' : playingArrangement ? ' · replay' : ''}
            </span>
          </div>
          <div ref={trackRef} className="relative space-y-0.5">
            {lanes.map((lane) => (
              <div key={lane.id} className="relative h-3.5 rounded-sm bg-neutral-900">
                {spans
                  .filter((span) => span.laneId === lane.id)
                  .map((span) => {
                    const clip = clips.find((candidate) => candidate.id === span.clipId);
                    return (
                      <div
                        key={`${span.clipId}-${span.from}`}
                        title={`${clip?.name ?? span.clipId} ${span.from.toFixed(1)}–${span.to.toFixed(1)}`}
                        className="absolute inset-y-0 rounded-sm"
                        style={{
                          left: `${(span.from / length) * 100}%`,
                          width: `${((span.to - span.from) / length) * 100}%`,
                          backgroundColor: clip?.color ?? '#525252',
                          opacity: 0.85,
                        }}
                      />
                    );
                  })}
              </div>
            ))}
            {playhead !== null && (
              <div
                className="pointer-events-none absolute inset-y-0 z-10 w-px bg-white/60"
                style={{ left: `${(playhead / length) * 100}%` }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
