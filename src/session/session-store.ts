import { create } from 'zustand';
import {
  DEFAULT_CLIPS,
  DEFAULT_LANES,
  DEFAULT_SCENES,
  activateScene,
  emptyActiveClips,
  toggleSessionClip,
  type ActiveClips,
  type SessionClip,
  type SessionLane,
  type SessionQuantize,
  type SessionScene,
} from './model';
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
  projects: ProjectSummary[];
  hydrated: boolean;
  persistenceStatus: PersistenceStatus;
  persistenceError: string | null;
  hydrate: () => Promise<void>;
  switchProject: (projectId: string) => Promise<void>;
  createProject: () => Promise<void>;
  duplicateProject: () => Promise<void>;
  deleteProject: () => Promise<void>;
  renameProject: (name: string) => void;
  setTempo: (tempo: number) => void;
  setLaunchQuantize: (quantize: SessionQuantize) => void;
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
  setPersistenceState: (status: PersistenceStatus, error?: string | null) => void;
  setProjectSummaries: (projects: ProjectSummary[]) => void;
}

function cloneDefaults() {
  return {
    lanes: DEFAULT_LANES.map((lane) => ({ ...lane })),
    clips: DEFAULT_CLIPS.map((clip) => ({ ...clip })),
    scenes: DEFAULT_SCENES.map((scene) => ({ ...scene, clipIds: { ...scene.clipIds } })),
    activeByLane: emptyActiveClips(DEFAULT_LANES),
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
    lanes: project.lanes,
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
  };
}

function stateFromProject(project: PersistedSessionProject) {
  return normalizeLoadedProject(project);
}

const initial = freshProject();

export const useSessionStore = create<SessionStore>((set, get) => ({
  ...stateFromProject(initial),
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
    set({ ...stateFromProject(activated), persistenceStatus: 'saved', persistenceError: null });
  },
  createProject: async () => {
    await saveProject(projectFromState(get()));
    const project = freshProject();
    await saveProject(project);
    set({
      ...stateFromProject(project),
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
      projects: await listProjects(),
      persistenceStatus: 'saved',
      persistenceError: null,
    });
  },
  renameProject: (projectName) => set({ projectName }),
  setTempo: (tempo) => set({ tempo: clampTempo(tempo) }),
  setLaunchQuantize: (launchQuantize) => set({ launchQuantize }),
  toggleClip: (clipId) => {
    const state = get();
    const clip = state.clips.find((candidate) => candidate.id === clipId);
    if (!clip) return state.activeByLane;
    const next = toggleSessionClip(state.activeByLane, clip);
    set({ activeByLane: next, selectedClipId: clipId });
    return next;
  },
  stopLane: (laneId) => {
    const next = { ...get().activeByLane, [laneId]: null };
    set({ activeByLane: next });
    return next;
  },
  launchScene: (sceneId) => {
    const state = get();
    const scene = state.scenes.find((candidate) => candidate.id === sceneId);
    if (!scene) return state.activeByLane;
    const next = activateScene(state.activeByLane, scene, state.lanes);
    set({ activeByLane: next });
    return next;
  },
  stopAll: () => {
    const next = emptyActiveClips(get().lanes);
    set({ activeByLane: next });
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
