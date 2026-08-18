import { describe, expect, it } from 'vitest';
import { DEFAULT_CLIPS, DEFAULT_LANES, DEFAULT_SCENES, emptyActiveClips } from '../session/model';
import {
  buildShareUrl,
  decodeSharePayload,
  encodeSharePayload,
  projectSharePayload,
  sceneSharePayload,
} from './url-share';

describe('url share codec', () => {
  const project = {
    version: 1 as const,
    id: 'project-1',
    name: 'Shared jam',
    tempo: 122,
    launchQuantize: 'cycle' as const,
    lanes: DEFAULT_LANES.map((lane) => ({ ...lane })),
    clips: DEFAULT_CLIPS.slice(0, 5).map((clip) => ({ ...clip })),
    scenes: DEFAULT_SCENES.map((scene) => ({ ...scene, clipIds: { ...scene.clipIds } })),
    activeByLane: emptyActiveClips(DEFAULT_LANES),
    selectedClipId: null,
    updatedAt: 1,
  };

  it('round-trips a project payload', () => {
    const payload = projectSharePayload(project);
    const encoded = encodeSharePayload(payload);
    const decoded = decodeSharePayload(encoded);
    expect(decoded.kind).toBe('project');
    if (decoded.kind === 'project') {
      expect(decoded.project.name).toBe('Shared jam');
      expect(decoded.project.clips).toHaveLength(5);
    }
  });

  it('round-trips a scene payload', () => {
    const payload = sceneSharePayload(project, 'foundation');
    const decoded = decodeSharePayload(encodeSharePayload(payload));
    expect(decoded.kind).toBe('scene');
    if (decoded.kind === 'scene') {
      expect(decoded.scene.name).toBe('Foundation');
      expect(decoded.clips.length).toBeGreaterThan(0);
    }
  });

  it('builds a hash URL with the studio prefix', () => {
    const url = buildShareUrl(projectSharePayload(project), 'https://studio.test');
    expect(url.startsWith('https://studio.test/#p=1.')).toBe(true);
  });
});
