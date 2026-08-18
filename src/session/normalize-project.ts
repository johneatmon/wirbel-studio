import {
  DEFAULT_CLIPS,
  DEFAULT_LANES,
  DEFAULT_SCENES,
  emptyActiveClips,
  normalizeLane,
  type SessionQuantize,
} from './model';
import { normalizeArrangement } from './arrangement';
import type { PersistedSessionProject } from './persistence';

const VALID_QUANTIZE: SessionQuantize[] = ['immediate', 'beat', 'cycle'];

function clampTempo(tempo: number): number {
  if (!Number.isFinite(tempo)) return 120;
  return Math.min(999, Math.max(20, Math.round(tempo)));
}

function validQuantize(value: SessionQuantize): SessionQuantize {
  return VALID_QUANTIZE.includes(value) ? value : 'cycle';
}

function cloneDefaults() {
  const lanes = DEFAULT_LANES.map((lane) => ({ ...lane }));
  return {
    lanes,
    clips: DEFAULT_CLIPS.map((clip) => ({ ...clip })),
    scenes: DEFAULT_SCENES.map((scene) => ({ ...scene, clipIds: { ...scene.clipIds } })),
    activeByLane: emptyActiveClips(DEFAULT_LANES),
    arrangement: normalizeArrangement(undefined, lanes, DEFAULT_CLIPS, DEFAULT_SCENES),
  };
}

/** Normalize persisted project data before hydrating store state. */
export function normalizeLoadedProject(project: PersistedSessionProject) {
  const base = {
    projectId: project.id,
    projectName: project.name,
    tempo: clampTempo(project.tempo),
    launchQuantize: validQuantize(project.launchQuantize),
  };

  if (!project.lanes.length) {
    return { ...base, ...cloneDefaults(), selectedClipId: null };
  }

  const laneIds = new Set(project.lanes.map((lane) => lane.id));
  const clips = project.clips.filter((clip) => laneIds.has(clip.laneId));
  const clipIds = new Set(clips.map((clip) => clip.id));
  const scenes = project.scenes.map((scene) => ({
    ...scene,
    clipIds: Object.fromEntries(
      Object.entries(scene.clipIds).filter(
        ([laneId, clipId]) => laneIds.has(laneId) && clipIds.has(clipId),
      ),
    ),
  }));

  return {
    ...base,
    lanes: project.lanes.map(normalizeLane),
    clips,
    scenes,
    activeByLane: Object.fromEntries(
      project.lanes.map((lane) => {
        const active = project.activeByLane[lane.id];
        return [lane.id, active && clipIds.has(active) ? active : null];
      }),
    ),
    selectedClipId:
      project.selectedClipId && clipIds.has(project.selectedClipId) ? project.selectedClipId : null,
    arrangement: normalizeArrangement(
      project.arrangement,
      project.lanes.map(normalizeLane),
      clips,
      scenes,
    ),
  };
}
