import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_CLIPS, DEFAULT_LANES, DEFAULT_SCENES, emptyActiveClips } from './model';
import { useSessionStore } from './session-store';

beforeEach(() => {
  useSessionStore.setState({
    projectId: 'test-project',
    projectName: 'Test project',
    lanes: DEFAULT_LANES.map((lane) => ({ ...lane })),
    clips: DEFAULT_CLIPS.map((clip) => ({ ...clip })),
    scenes: DEFAULT_SCENES.map((scene) => ({ ...scene, clipIds: { ...scene.clipIds } })),
    activeByLane: emptyActiveClips(DEFAULT_LANES),
    selectedClipId: null,
  });
});

describe('session clip editing', () => {
  it('creates a clip in an empty scene slot', () => {
    const sceneId = useSessionStore.getState().addScene();
    const clip = useSessionStore.getState().createClip('drums', sceneId);
    expect(clip?.code).toBe('s("~")');
    expect(useSessionStore.getState().scenes.at(-1)?.clipIds.drums).toBe(clip?.id);
    expect(useSessionStore.getState().selectedClipId).toBe(clip?.id);
  });

  it('duplicates a clip into an available scene slot', () => {
    const sceneId = useSessionStore.getState().addScene();
    const duplicate = useSessionStore.getState().duplicateClip('bass-acid');
    expect(duplicate?.name).toBe('Acid Pulse copy');
    expect(duplicate?.code).toBe(DEFAULT_CLIPS.find((clip) => clip.id === 'bass-acid')?.code);
    expect(
      useSessionStore.getState().scenes.find((scene) => scene.id === sceneId)?.clipIds.bass,
    ).toBe(duplicate?.id);
  });

  it('deleting an active clip clears launch and scene references', () => {
    useSessionStore.getState().toggleClip('drums-909');
    useSessionStore.getState().deleteClip('drums-909');
    const state = useSessionStore.getState();
    expect(state.activeByLane.drums).toBeNull();
    expect(state.clips.some((clip) => clip.id === 'drums-909')).toBe(false);
    expect(state.scenes.some((scene) => scene.clipIds.drums === 'drums-909')).toBe(false);
  });
});
