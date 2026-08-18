import { emptyActiveClips } from '../session/model';
import { emptyArrangement } from '../session/arrangement';
import type { PersistedSessionProject } from '../session/persistence';
import { DEFAULT_STARTER_PACK, starterPackById } from './starter-packs';
import type { StarterPack, StarterProjectSlice } from './types';

function makeId(prefix: string): string {
  const id =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${id}`;
}

export function projectSliceFromPack(pack: StarterPack, name = pack.name): StarterProjectSlice {
  return {
    name,
    tempo: pack.tempo,
    launchQuantize: pack.launchQuantize,
    lanes: pack.lanes.map((lane) => ({ ...lane })),
    clips: pack.clips.map((clip) => ({ ...clip })),
    scenes: pack.scenes.map((scene) => ({
      ...scene,
      clipIds: { ...scene.clipIds },
    })),
  };
}

export function freshProjectFromPack(
  pack: StarterPack = DEFAULT_STARTER_PACK,
  name = pack.name,
): PersistedSessionProject {
  const slice = projectSliceFromPack(pack, name);
  const lanes = slice.lanes;
  return {
    version: 1,
    id: makeId('project'),
    name: slice.name,
    tempo: slice.tempo,
    launchQuantize: slice.launchQuantize,
    lanes,
    clips: slice.clips.map((clip) => ({ ...clip })),
    scenes: slice.scenes.map((scene) => ({ ...scene, clipIds: { ...scene.clipIds } })),
    activeByLane: emptyActiveClips(lanes),
    selectedClipId: null,
    arrangement: emptyArrangement(lanes),
    updatedAt: Date.now(),
  };
}

export function freshProjectFromPackId(packId: string, name?: string): PersistedSessionProject {
  const pack = starterPackById(packId) ?? DEFAULT_STARTER_PACK;
  return freshProjectFromPack(pack, name ?? pack.name);
}
