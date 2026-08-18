import { create } from 'zustand';
import {
  DEFAULT_CLIPS,
  DEFAULT_LANES,
  DEFAULT_SCENES,
  activateScene,
  clampLaneGain,
  emptyActiveClips,
  normalizeLane,
  toggleSessionClip,
  type ActiveClips,
  type SessionClip,
  type SessionLane,
  type SessionQuantize,
  type SessionScene,
} from './model';
import { currentCycleNow } from '../store/clock-store';
import {
  applyArrangementAction,
  clampSectionStart,
  defaultSections,
  emptyArrangement,
  eventsDue,
  normalizeArrangement,
  type Arrangement,
  type ArrangementAction,
} from './arrangement';
import {
  deleteProject as deleteProjectRecord,
  listProjects,
  loadActiveProject,
  loadProject,
  saveProject,
  type PersistedSessionProject,
  type ProjectSummary,
} from './persistence';

export type PersistenceStatus = 'loading' | 'saved' | 'saving' | 'error';

interface SessionStore {
  projectId: string;
  projectName: string;
  tempo: number;
  launchQuantize: SessionQuantize;
  lanes: SessionLane[];
  clips: SessionClip[];
  scenes: SessionScene[];
  activeByLane: ActiveClips;
  selectedClipId: string | null;
  arrangement: Arrangement;
  capturing: boolean;
  playingArrangement: boolean;
  captureOriginCycle: number;
  playbackOriginCycle: number;
  nextEventIndex: number;
  projects: ProjectSummary[];
  hydrated: boolean;
  persistenceStatus: PersistenceStatus;
  persistenceError: string | null;
  lastGoodByClipId: Record<string, string>;
  laneErrors: Record<string, string>;
  hydrate: () => Promise<void>;
  switchProject: (projectId: string) => Promise<void>;
  createProject: () => Promise<void>;
  duplicateProject: () => Promise<void>;
  deleteProject: () => Promise<void>;
  renameProject: (name: string) => void;
  setTempo: (tempo: number) => void;
  setLaunchQuantize: (quantize: SessionQuantize) => void;
  setLaneGain: (laneId: string, gain: number) => void;
  toggleLaneMute: (laneId: string) => void;
  toggleLaneSolo: (laneId: string) => void;
  setLaneErrors: (laneErrors: Record<string, string>) => void;
  mergeLastGood: (updates: Record<string, string>) => void;
  clearRuntimeState: () => void;
  toggleClip: (clipId: string) => ActiveClips;
  stopLane: (laneId: string) => ActiveClips;
  launchScene: (sceneId: string) => ActiveClips;
  stopAll: () => ActiveClips;
  selectClip: (clipId: string | null) => void;
  updateClipCode: (clipId: string, code: string) => void;
  renameClip: (clipId: string, name: string) => void;
  createClip: (laneId: string, sceneId: string) => SessionClip | null;
  duplicateClip: (clipId: string) => SessionClip | null;
  deleteClip: (clipId: string) => void;
  addScene: () => string;
  renameScene: (sceneId: string, name: string) => void;
  startCapture: () => void;
  stopCapture: () => void;
  playArrangement: () => boolean;
  stopArrangementPlayback: () => void;
  applyArrangementUntil: (untilCycle: number) => boolean;
  moveSection: (sectionId: string, startCycle: number) => void;
  clearArrangement: () => void;
  importMidiScene: (parts: { laneId: string; name: string; code: string }[], tempo?: number) => string | null;
  importProjectFile: (project: PersistedSessionProject) => Promise<void>;
  setPersistenceState: (status: PersistenceStatus, error?: string | null) => void;
  setProjectSummaries: (projects: ProjectSummary[]) => void;
}

function cloneDefaults() {
  const lanes = DEFAULT_LANES.map((lane) => ({ ...lane }));
  return {
    lanes,
    clips: DEFAULT_CLIPS.map((clip) => ({ ...clip })),
    scenes: DEFAULT_SCENES.map((scene) => ({ ...scene, clipIds: { ...scene.clipIds } })),
    activeByLane: emptyActiveClips(DEFAULT_LANES),
    arrangement: emptyArrangement(lanes),
  };
}

function makeId(prefix: string): string {
  const id =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${id}`;
}

function freshProject(name = 'Untitled session'): PersistedSessionProject {
  return {
    version: 1,
    id: makeId('project'),
    name,
    tempo: 120,
    launchQuantize: 'cycle',
    ...cloneDefaults(),
    selectedClipId: null,
    updatedAt: Date.now(),
  };
}

function projectFromState(state: SessionStore): PersistedSessionProject {
  return {
    version: 1,
    id: state.projectId,
    name: state.projectName,
    tempo: state.tempo,
    launchQuantize: state.launchQuantize,
    lanes: state.lanes,
    clips: state.clips,
    scenes: state.scenes,
    activeByLane: state.activeByLane,
    selectedClipId: state.selectedClipId,
    arrangement: {
      events: [...state.arrangement.events],
      sections: state.arrangement.sections.map((section) => ({ ...section })),
      lengthCycles: state.arrangement.lengthCycles,
      originActive: { ...state.arrangement.originActive },
      originMuted: { ...state.arrangement.originMuted },
    },
    updatedAt: Date.now(),
  };
}

const VALID_QUANTIZE: SessionQuantize[] = ['immediate', 'beat', 'cycle'];

function clampTempo(tempo: number): number {
  if (!Number.isFinite(tempo)) return 120;
  return Math.min(999, Math.max(20, Math.round(tempo)));
}

function validQuantize(value: SessionQuantize): SessionQuantize {
  return VALID_QUANTIZE.includes(value) ? value : 'cycle';
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
    arrangement: normalizeArrangement(project.arrangement, project.lanes.map(normalizeLane), clips, scenes),
  };
}

function stateFromProject(project: PersistedSessionProject) {
  return normalizeLoadedProject(project);
}

const initial = freshProject();

const runtimeDefaults = {
  lastGoodByClipId: {} as Record<string, string>,
  laneErrors: {} as Record<string, string>,
  capturing: false,
  playingArrangement: false,
  captureOriginCycle: 0,
  playbackOriginCycle: 0,
  nextEventIndex: 0,
};

function endArrangementPlayback(
  get: () => SessionStore,
  set: (partial: Partial<SessionStore>) => void,
) {
  if (get().playingArrangement) set({ playingArrangement: false });
}

function noteCapture(
  get: () => SessionStore,
  set: (partial: Partial<SessionStore>) => void,
  action: ArrangementAction,
) {
  const state = get();
  if (!state.capturing || state.playingArrangement) return;
  set({
    arrangement: {
      ...state.arrangement,
      events: [
        ...state.arrangement.events,
        { cycle: Math.max(0, currentCycleNow() - state.captureOriginCycle), action },
      ],
    },
  });
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  ...stateFromProject(initial),
  ...runtimeDefaults,
  projects: [],
  hydrated: false,
  persistenceStatus: 'loading',
  persistenceError: null,
  hydrate: async () => {
    try {
      const saved = await loadActiveProject();
      const project = saved ?? initial;
      if (!saved) await saveProject(project);
      set({
        ...stateFromProject(project),
        ...runtimeDefaults,
        projects: await listProjects(),
        hydrated: true,
        persistenceStatus: 'saved',
        persistenceError: null,
      });
    } catch (error) {
      set({
        hydrated: true,
        persistenceStatus: 'error',
        persistenceError: error instanceof Error ? error.message : String(error),
      });
    }
  },
  switchProject: async (projectId) => {
    const current = get();
    if (projectId === current.projectId) return;
    await saveProject(projectFromState(current));
    const project = await loadProject(projectId);
    if (!project) return;
    const activated = { ...project, updatedAt: Date.now() };
    await saveProject(activated);
    set({
      ...stateFromProject(activated),
      ...runtimeDefaults,
      persistenceStatus: 'saved',
      persistenceError: null,
    });
  },
  createProject: async () => {
    await saveProject(projectFromState(get()));
    const project = freshProject();
    await saveProject(project);
    set({
      ...stateFromProject(project),
      ...runtimeDefaults,
      projects: await listProjects(),
      persistenceStatus: 'saved',
      persistenceError: null,
    });
  },
  duplicateProject: async () => {
    const current = projectFromState(get());
    await saveProject(current);
    const duplicate: PersistedSessionProject = {
      ...current,
      id: makeId('project'),
      name: `${current.name} copy`,
      lanes: current.lanes.map((lane) => ({ ...lane })),
      clips: current.clips.map((clip) => ({ ...clip })),
      scenes: current.scenes.map((scene) => ({ ...scene, clipIds: { ...scene.clipIds } })),
      activeByLane: { ...current.activeByLane },
      updatedAt: Date.now(),
    };
    await saveProject(duplicate);
    set({
      ...stateFromProject(duplicate),
      ...runtimeDefaults,
      projects: await listProjects(),
      persistenceStatus: 'saved',
      persistenceError: null,
    });
  },
  deleteProject: async () => {
    const { projectId } = get();
    const others = (await listProjects()).filter((project) => project.id !== projectId);
    await deleteProjectRecord(projectId);
    if (others.length === 0) {
      const project = freshProject();
      await saveProject(project);
      set({
        ...stateFromProject(project),
        ...runtimeDefaults,
        projects: await listProjects(),
        persistenceStatus: 'saved',
        persistenceError: null,
      });
      return;
    }
    const next = await loadProject(others[0].id);
    if (!next) return;
    const activated = { ...next, updatedAt: Date.now() };
    await saveProject(activated);
    set({
      ...stateFromProject(activated),
      ...runtimeDefaults,
      persistenceStatus: 'saved',
      persistenceError: null,
    });
  },
  renameProject: (projectName) => set({ projectName }),
  setTempo: (tempo) => set({ tempo: clampTempo(tempo) }),
  setLaunchQuantize: (launchQuantize) => set({ launchQuantize }),
  setLaneGain: (laneId, gain) =>
    set((state) => ({
      lanes: state.lanes.map((lane) =>
        lane.id === laneId ? { ...lane, gain: clampLaneGain(gain) } : lane,
      ),
    })),
  toggleLaneMute: (laneId) => {
    endArrangementPlayback(get, set);
    const muted = !get().lanes.find((lane) => lane.id === laneId)?.muted;
    set((state) => ({
      lanes: state.lanes.map((lane) => (lane.id === laneId ? { ...lane, muted } : lane)),
    }));
    noteCapture(get, set, { type: 'mute', laneId, muted });
  },
  toggleLaneSolo: (laneId) =>
    set((state) => ({
      lanes: state.lanes.map((lane) =>
        lane.id === laneId ? { ...lane, solo: !lane.solo } : lane,
      ),
    })),
  setLaneErrors: (laneErrors) => set({ laneErrors }),
  mergeLastGood: (updates) =>
    set((state) => ({
      lastGoodByClipId: Object.keys(updates).length
        ? { ...state.lastGoodByClipId, ...updates }
        : state.lastGoodByClipId,
    })),
  clearRuntimeState: () => set(runtimeDefaults),
  toggleClip: (clipId) => {
    endArrangementPlayback(get, set);
    const state = get();
    const clip = state.clips.find((candidate) => candidate.id === clipId);
    if (!clip) return state.activeByLane;
    const next = toggleSessionClip(state.activeByLane, clip);
    set({ activeByLane: next, selectedClipId: clipId });
    noteCapture(
      get,
      set,
      next[clip.laneId] === clip.id
        ? { type: 'launch', laneId: clip.laneId, clipId: clip.id }
        : { type: 'stop', laneId: clip.laneId },
    );
    return next;
  },
  stopLane: (laneId) => {
    endArrangementPlayback(get, set);
    const next = { ...get().activeByLane, [laneId]: null };
    set({ activeByLane: next });
    noteCapture(get, set, { type: 'stop', laneId });
    return next;
  },
  launchScene: (sceneId) => {
    endArrangementPlayback(get, set);
    const state = get();
    const scene = state.scenes.find((candidate) => candidate.id === sceneId);
    if (!scene) return state.activeByLane;
    const next = activateScene(state.activeByLane, scene, state.lanes);
    set({ activeByLane: next });
    noteCapture(get, set, { type: 'scene', sceneId });
    return next;
  },
  stopAll: () => {
    endArrangementPlayback(get, set);
    const next = emptyActiveClips(get().lanes);
    set({ activeByLane: next });
    noteCapture(get, set, { type: 'stop-all' });
    return next;
  },
  selectClip: (selectedClipId) => set({ selectedClipId }),
  updateClipCode: (clipId, code) =>
    set((state) => ({
      clips: state.clips.map((clip) => (clip.id === clipId ? { ...clip, code } : clip)),
    })),
  renameClip: (clipId, name) =>
    set((state) => ({
      clips: state.clips.map((clip) => (clip.id === clipId ? { ...clip, name } : clip)),
    })),
  createClip: (laneId, sceneId) => {
    const state = get();
    const lane = state.lanes.find((candidate) => candidate.id === laneId);
    const scene = state.scenes.find((candidate) => candidate.id === sceneId);
    if (!lane || !scene) return null;
    const clip: SessionClip = {
      id: makeId('clip'),
      laneId,
      name: `New ${lane.name.toLowerCase()} clip`,
      code: 's("~")',
      color: '#737373',
    };
    set({
      clips: [...state.clips, clip],
      scenes: state.scenes.map((candidate) =>
        candidate.id === sceneId
          ? { ...candidate, clipIds: { ...candidate.clipIds, [laneId]: clip.id } }
          : candidate,
      ),
      selectedClipId: clip.id,
    });
    return clip;
  },
  duplicateClip: (clipId) => {
    const state = get();
    const source = state.clips.find((clip) => clip.id === clipId);
    if (!source) return null;
    let targetScene = state.scenes.find((scene) => !scene.clipIds[source.laneId]);
    let scenes = state.scenes;
    if (!targetScene) {
      targetScene = { id: makeId('scene'), name: `Scene ${scenes.length + 1}`, clipIds: {} };
      scenes = [...scenes, targetScene];
    }
    const duplicate: SessionClip = {
      ...source,
      id: makeId('clip'),
      name: `${source.name} copy`,
    };
    scenes = scenes.map((scene) =>
      scene.id === targetScene.id
        ? { ...scene, clipIds: { ...scene.clipIds, [source.laneId]: duplicate.id } }
        : scene,
    );
    set({ clips: [...state.clips, duplicate], scenes, selectedClipId: duplicate.id });
    return duplicate;
  },
  deleteClip: (clipId) => {
    const state = get();
    const clip = state.clips.find((candidate) => candidate.id === clipId);
    if (!clip) return;
    const nextActive =
      state.activeByLane[clip.laneId] === clipId
        ? { ...state.activeByLane, [clip.laneId]: null }
        : state.activeByLane;
    set({
      clips: state.clips.filter((candidate) => candidate.id !== clipId),
      scenes: state.scenes.map((scene) => {
        if (scene.clipIds[clip.laneId] !== clipId) return scene;
        const clipIds = { ...scene.clipIds };
        delete clipIds[clip.laneId];
        return { ...scene, clipIds };
      }),
      activeByLane: nextActive,
      selectedClipId: state.selectedClipId === clipId ? null : state.selectedClipId,
    });
  },
  addScene: () => {
    const state = get();
    const id = makeId('scene');
    set({
      scenes: [...state.scenes, { id, name: `Scene ${state.scenes.length + 1}`, clipIds: {} }],
    });
    return id;
  },
  renameScene: (sceneId, name) =>
    set((state) => ({
      scenes: state.scenes.map((scene) => (scene.id === sceneId ? { ...scene, name } : scene)),
    })),
  startCapture: () => {
    const state = get();
    endArrangementPlayback(get, set);
    set({
      capturing: true,
      captureOriginCycle: currentCycleNow(),
      arrangement: {
        events: [],
        sections: [{ id: 'section-A', name: 'A', startCycle: 0 }],
        lengthCycles: 0,
        originActive: { ...state.activeByLane },
        originMuted: Object.fromEntries(state.lanes.map((lane) => [lane.id, lane.muted])),
      },
    });
  },
  stopCapture: () => {
    const state = get();
    if (!state.capturing) return;
    const elapsed = Math.max(0, currentCycleNow() - state.captureOriginCycle);
    const lastEvent = state.arrangement.events.at(-1)?.cycle ?? 0;
    const lengthCycles = Math.max(elapsed, lastEvent, 1);
    set({
      capturing: false,
      arrangement: {
        ...state.arrangement,
        lengthCycles,
        sections: defaultSections(lengthCycles),
      },
    });
  },
  playArrangement: () => {
    const state = get();
    if (state.capturing) get().stopCapture();
    const arrangement = get().arrangement;
    if (arrangement.lengthCycles <= 0 && arrangement.events.length === 0) return false;
    set({
      capturing: false,
      playingArrangement: true,
      playbackOriginCycle: currentCycleNow(),
      nextEventIndex: 0,
      activeByLane: { ...arrangement.originActive },
      lanes: get().lanes.map((lane) => ({
        ...lane,
        muted: arrangement.originMuted[lane.id] ?? lane.muted,
      })),
    });
    get().applyArrangementUntil(0);
    return true;
  },
  stopArrangementPlayback: () => set({ playingArrangement: false }),
  applyArrangementUntil: (untilCycle) => {
    const state = get();
    if (!state.playingArrangement) return false;
    const { applied, nextIndex } = eventsDue(
      state.arrangement.events,
      state.nextEventIndex,
      untilCycle,
    );
    if (!applied.length) return false;
    let activeByLane = state.activeByLane;
    let lanes = state.lanes;
    for (const event of applied) {
      const next = applyArrangementAction(activeByLane, lanes, event.action, state.scenes);
      activeByLane = next.activeByLane;
      lanes = next.lanes;
    }
    set({ activeByLane, lanes, nextEventIndex: nextIndex });
    return true;
  },
  moveSection: (sectionId, startCycle) =>
    set((state) => ({
      arrangement: {
        ...state.arrangement,
        sections: clampSectionStart(
          state.arrangement.sections,
          sectionId,
          startCycle,
          state.arrangement.lengthCycles,
        ),
      },
    })),
  clearArrangement: () =>
    set((state) => ({
      capturing: false,
      playingArrangement: false,
      arrangement: emptyArrangement(state.lanes),
    })),
  importMidiScene: (parts, tempo) => {
    if (!parts.length) return null;
    const sceneId = get().addScene();
    get().renameScene(sceneId, 'MIDI import');
    if (tempo !== undefined) get().setTempo(tempo);
    for (const part of parts) {
      const lanes = get().lanes;
      const laneId = lanes.some((lane) => lane.id === part.laneId) ? part.laneId : lanes[0]?.id;
      if (!laneId) continue;
      const clip = get().createClip(laneId, sceneId);
      if (!clip) continue;
      get().renameClip(clip.id, part.name);
      get().updateClipCode(clip.id, part.code);
    }
    return sceneId;
  },
  importProjectFile: async (project) => {
    await saveProject(projectFromState(get()));
    const imported: PersistedSessionProject = {
      ...project,
      id: makeId('project'),
      updatedAt: Date.now(),
    };
    await saveProject(imported);
    set({
      ...stateFromProject(imported),
      ...runtimeDefaults,
      projects: await listProjects(),
      persistenceStatus: 'saved',
      persistenceError: null,
    });
  },
  setPersistenceState: (persistenceStatus, persistenceError = null) =>
    set({ persistenceStatus, persistenceError }),
  setProjectSummaries: (projects) => set({ projects }),
}));

let saveTimer: number | null = null;

/** Hydrate once, then debounce project writes without coupling persistence to
 * every individual store action. */
export function startSessionPersistence(): () => void {
  let previousSnapshot = '';
  let readyToSave = false;
  void useSessionStore
    .getState()
    .hydrate()
    .then(() => {
      previousSnapshot = JSON.stringify({
        ...projectFromState(useSessionStore.getState()),
        updatedAt: 0,
      });
      readyToSave = true;
    });

  const unsubscribe = useSessionStore.subscribe((state) => {
    if (!state.hydrated || !readyToSave) return;
    const project = projectFromState(state);
    const snapshot = JSON.stringify({ ...project, updatedAt: 0 });
    if (snapshot === previousSnapshot) return;
    previousSnapshot = snapshot;
    if (saveTimer !== null) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      saveTimer = null;
      useSessionStore.getState().setPersistenceState('saving');
      void saveProject(project)
        .then(async () => {
          useSessionStore.getState().setProjectSummaries(await listProjects());
          useSessionStore.getState().setPersistenceState('saved');
        })
        .catch((error: unknown) => {
          useSessionStore
            .getState()
            .setPersistenceState('error', error instanceof Error ? error.message : String(error));
        });
    }, 800);
  });

  return () => {
    unsubscribe();
    if (saveTimer !== null) window.clearTimeout(saveTimer);
    saveTimer = null;
  };
}

export function snapshotProject(): PersistedSessionProject {
  return projectFromState(useSessionStore.getState());
}
