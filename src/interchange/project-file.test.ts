import { describe, expect, it } from 'vitest';
import { DEFAULT_CLIPS, DEFAULT_LANES, DEFAULT_SCENES, emptyActiveClips } from '../session/model';
import type { PersistedSessionProject } from '../session/persistence';
import { parseProjectFile, serializeProject } from './project-file';

function project(): PersistedSessionProject {
  return {
    version: 1,
    id: 'project-1',
    name: 'Portable',
    tempo: 118,
    launchQuantize: 'cycle',
    lanes: DEFAULT_LANES.map((lane) => ({ ...lane })),
    clips: DEFAULT_CLIPS.map((clip) => ({ ...clip })),
    scenes: DEFAULT_SCENES.map((scene) => ({ ...scene, clipIds: { ...scene.clipIds } })),
    activeByLane: emptyActiveClips(DEFAULT_LANES),
    selectedClipId: null,
    updatedAt: 1,
  };
}

describe('project files', () => {
  it('round-trips a versioned project', () => {
    const restored = parseProjectFile(serializeProject(project()));
    expect(restored.name).toBe('Portable');
    expect(restored.tempo).toBe(118);
    expect(restored.lanes).toHaveLength(DEFAULT_LANES.length);
  });

  it('rejects non-project JSON', () => {
    expect(() => parseProjectFile('{"hello":true}')).toThrow(/project file/);
    expect(() => parseProjectFile('not json')).toThrow(/JSON/);
  });
});
