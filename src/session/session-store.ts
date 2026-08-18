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
  type SessionScene,
} from './model';

interface SessionStore {
  lanes: SessionLane[];
  clips: SessionClip[];
  scenes: SessionScene[];
  activeByLane: ActiveClips;
  selectedClipId: string | null;
  toggleClip: (clipId: string) => ActiveClips;
  stopLane: (laneId: string) => ActiveClips;
  launchScene: (sceneId: string) => ActiveClips;
  stopAll: () => ActiveClips;
  selectClip: (clipId: string | null) => void;
  updateClipCode: (clipId: string, code: string) => void;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  lanes: DEFAULT_LANES,
  clips: DEFAULT_CLIPS,
  scenes: DEFAULT_SCENES,
  activeByLane: emptyActiveClips(DEFAULT_LANES),
  selectedClipId: null,
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
}));
