import {
  activateScene,
  emptyActiveClips,
  type ActiveClips,
  type SessionClip,
  type SessionLane,
  type SessionScene,
} from './model';

export type ArrangementAction =
  | { type: 'launch'; laneId: string; clipId: string }
  | { type: 'stop'; laneId: string }
  | { type: 'stop-all' }
  | { type: 'scene'; sceneId: string }
  | { type: 'mute'; laneId: string; muted: boolean };

export interface ArrangementEvent {
  cycle: number;
  action: ArrangementAction;
}

export interface ArrangementSection {
  id: string;
  name: string;
  startCycle: number;
}

export interface Arrangement {
  events: ArrangementEvent[];
  sections: ArrangementSection[];
  lengthCycles: number;
  originActive: ActiveClips;
  originMuted: Record<string, boolean>;
}

export interface LaneSpan {
  laneId: string;
  clipId: string;
  from: number;
  to: number;
}

export function emptyArrangement(lanes: SessionLane[] = []): Arrangement {
  return {
    events: [],
    sections: [{ id: 'section-A', name: 'A', startCycle: 0 }],
    lengthCycles: 0,
    originActive: emptyActiveClips(lanes),
    originMuted: Object.fromEntries(lanes.map((lane) => [lane.id, lane.muted])),
  };
}

export function defaultSections(lengthCycles: number): ArrangementSection[] {
  const names = 'ABCDEFGH';
  const step = 8;
  const sections: ArrangementSection[] = [];
  let index = 0;
  for (let start = 0; start < Math.max(lengthCycles, 0.001) && index < names.length; start += step) {
    sections.push({
      id: `section-${names[index]}`,
      name: names[index],
      startCycle: start,
    });
    index += 1;
  }
  return sections.length ? sections : [{ id: 'section-A', name: 'A', startCycle: 0 }];
}

export function applyArrangementAction(
  active: ActiveClips,
  lanes: SessionLane[],
  action: ArrangementAction,
  scenes: SessionScene[],
): { activeByLane: ActiveClips; lanes: SessionLane[] } {
  switch (action.type) {
    case 'launch':
      return { activeByLane: { ...active, [action.laneId]: action.clipId }, lanes };
    case 'stop':
      return { activeByLane: { ...active, [action.laneId]: null }, lanes };
    case 'stop-all':
      return { activeByLane: emptyActiveClips(lanes), lanes };
    case 'scene': {
      const scene = scenes.find((candidate) => candidate.id === action.sceneId);
      return {
        activeByLane: scene ? activateScene(active, scene, lanes) : active,
        lanes,
      };
    }
    case 'mute':
      return {
        activeByLane: active,
        lanes: lanes.map((lane) =>
          lane.id === action.laneId ? { ...lane, muted: action.muted } : lane,
        ),
      };
  }
}

export function eventsDue(
  events: ArrangementEvent[],
  startIndex: number,
  untilCycle: number,
): { applied: ArrangementEvent[]; nextIndex: number } {
  let nextIndex = startIndex;
  while (nextIndex < events.length && events[nextIndex].cycle <= untilCycle) nextIndex += 1;
  return { applied: events.slice(startIndex, nextIndex), nextIndex };
}

export function deriveLaneSpans(
  originActive: ActiveClips,
  events: ArrangementEvent[],
  lengthCycles: number,
  laneIds: string[],
  scenes: SessionScene[],
): LaneSpan[] {
  const spans: LaneSpan[] = [];
  const open = new Map<string, { clipId: string; from: number }>();
  const active: ActiveClips = { ...originActive };

  const close = (laneId: string, at: number) => {
    const current = open.get(laneId);
    if (!current) return;
    if (at > current.from) {
      spans.push({ laneId, clipId: current.clipId, from: current.from, to: at });
    }
    open.delete(laneId);
  };

  const setLane = (laneId: string, clipId: string | null, at: number) => {
    close(laneId, at);
    active[laneId] = clipId;
    if (clipId) open.set(laneId, { clipId, from: at });
  };

  for (const laneId of laneIds) {
    const clipId = originActive[laneId];
    if (clipId) open.set(laneId, { clipId, from: 0 });
  }

  for (const event of events) {
    const at = event.cycle;
    const action = event.action;
    switch (action.type) {
      case 'launch':
        setLane(action.laneId, action.clipId, at);
        break;
      case 'stop':
        setLane(action.laneId, null, at);
        break;
      case 'stop-all':
        for (const laneId of laneIds) setLane(laneId, null, at);
        break;
      case 'scene': {
        const scene = scenes.find((candidate) => candidate.id === action.sceneId);
        if (!scene) break;
        for (const laneId of laneIds) {
          const clipId = scene.clipIds[laneId] ?? active[laneId] ?? null;
          setLane(laneId, clipId, at);
        }
        break;
      }
      case 'mute':
        break;
    }
  }

  const end = Math.max(lengthCycles, 0);
  for (const laneId of laneIds) close(laneId, end);
  return spans;
}

export function clampSectionStart(
  sections: ArrangementSection[],
  sectionId: string,
  startCycle: number,
  lengthCycles: number,
): ArrangementSection[] {
  const index = sections.findIndex((section) => section.id === sectionId);
  if (index <= 0) return sections;
  const prev = sections[index - 1].startCycle + 0.25;
  const next = (sections[index + 1]?.startCycle ?? lengthCycles) - 0.25;
  const clamped = Math.min(next, Math.max(prev, startCycle));
  return sections.map((section, i) => (i === index ? { ...section, startCycle: clamped } : section));
}

export function normalizeArrangement(
  value: Partial<Arrangement> | undefined,
  lanes: SessionLane[],
  clips: SessionClip[],
  scenes: SessionScene[],
): Arrangement {
  const empty = emptyArrangement(lanes);
  if (!value) return empty;
  const clipIds = new Set(clips.map((clip) => clip.id));
  const laneIds = new Set(lanes.map((lane) => lane.id));
  const sceneIds = new Set(scenes.map((scene) => scene.id));
  const events = (Array.isArray(value.events) ? value.events : [])
    .filter((event) => event && typeof event.cycle === 'number' && Number.isFinite(event.cycle))
    .filter((event) => isValidAction(event.action, clipIds, laneIds, sceneIds))
    .sort((a, b) => a.cycle - b.cycle);
  const lengthCycles = Math.max(
    0,
    Number.isFinite(value.lengthCycles) ? Number(value.lengthCycles) : 0,
    events.at(-1)?.cycle ?? 0,
  );
  const sections = (Array.isArray(value.sections) ? value.sections : [])
    .filter(
      (section) =>
        section &&
        typeof section.id === 'string' &&
        typeof section.name === 'string' &&
        Number.isFinite(section.startCycle),
    )
    .sort((a, b) => a.startCycle - b.startCycle);
  return {
    events,
    sections: sections.length ? sections : defaultSections(lengthCycles),
    lengthCycles,
    originActive: Object.fromEntries(
      lanes.map((lane) => {
        const active = value.originActive?.[lane.id];
        return [lane.id, active && clipIds.has(active) ? active : null];
      }),
    ),
    originMuted: Object.fromEntries(
      lanes.map((lane) => [lane.id, Boolean(value.originMuted?.[lane.id])]),
    ),
  };
}

function isValidAction(
  action: ArrangementAction | undefined,
  clipIds: Set<string>,
  laneIds: Set<string>,
  sceneIds: Set<string>,
): action is ArrangementAction {
  if (!action || typeof action !== 'object') return false;
  switch (action.type) {
    case 'launch':
      return laneIds.has(action.laneId) && clipIds.has(action.clipId);
    case 'stop':
    case 'mute':
      return laneIds.has(action.laneId);
    case 'stop-all':
      return true;
    case 'scene':
      return sceneIds.has(action.sceneId);
    default:
      return false;
  }
}
