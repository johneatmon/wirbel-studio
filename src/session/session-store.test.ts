import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_CLIPS, DEFAULT_LANES, DEFAULT_SCENES, emptyActiveClips } from './model';
import type { PersistedSessionProject } from './persistence';
import { normalizeLoadedProject, useSessionStore } from './session-store';

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

describe('normalizeLoadedProject', () => {
  const baseProject = (): PersistedSessionProject => ({
    version: 1,
    id: 'project-1',
    name: 'Test',
    tempo: 120,
    launchQuantize: 'cycle',
    lanes: DEFAULT_LANES.map((lane) => ({ ...lane })),
    clips: DEFAULT_CLIPS.map((clip) => ({ ...clip })),
    scenes: DEFAULT_SCENES.map((scene) => ({ ...scene, clipIds: { ...scene.clipIds } })),
    activeByLane: emptyActiveClips(DEFAULT_LANES),
    selectedClipId: 'drums-909',
    updatedAt: 0,
  });

  it('falls back to defaults when lanes are missing', () => {
    const normalized = normalizeLoadedProject({ ...baseProject(), lanes: [], clips: [], scenes: [] });
    expect(normalized.lanes).toHaveLength(DEFAULT_LANES.length);
    expect(normalized.clips).toHaveLength(DEFAULT_CLIPS.length);
    expect(normalized.selectedClipId).toBeNull();
  });

  it('drops clips and scene refs for unknown lanes', () => {
    const project = baseProject();
    project.clips.push({
      id: 'orphan',
      laneId: 'missing-lane',
      name: 'Orphan',
      code: 's("bd")',
      color: '#fff',
    });
    project.scenes[0].clipIds['missing-lane'] = 'orphan';
    project.activeByLane['missing-lane'] = 'orphan';

    const normalized = normalizeLoadedProject(project);
    expect(normalized.clips.some((clip) => clip.id === 'orphan')).toBe(false);
    expect(normalized.scenes[0].clipIds['missing-lane']).toBeUndefined();
    expect(normalized.activeByLane['missing-lane']).toBeUndefined();
  });

  it('clears active and selected refs to deleted clips', () => {
    const project = baseProject();
    project.activeByLane.drums = 'drums-909';
    project.selectedClipId = 'drums-909';
    project.clips = project.clips.filter((clip) => clip.id !== 'drums-909');

    const normalized = normalizeLoadedProject(project);
    expect(normalized.activeByLane.drums).toBeNull();
    expect(normalized.selectedClipId).toBeNull();
  });

  it('clamps tempo and normalizes invalid quantize', () => {
    const normalized = normalizeLoadedProject({
      ...baseProject(),
      tempo: 9999,
      launchQuantize: 'invalid' as never,
    });
    expect(normalized.tempo).toBe(999);
    expect(normalized.launchQuantize).toBe('cycle');
  });
});
