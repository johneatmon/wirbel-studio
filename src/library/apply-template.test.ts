import { describe, expect, it } from 'vitest';
import { DEFAULT_LANES } from '../session/model';
import { freshProjectFromPack, freshProjectFromPackId } from './apply-template';
import { DEFAULT_STARTER_PACK } from './starter-packs';

describe('starter packs', () => {
  it('builds a full project from the default pack', () => {
    const project = freshProjectFromPack(DEFAULT_STARTER_PACK, 'My jam');
    expect(project.name).toBe('My jam');
    expect(project.clips.length).toBeGreaterThanOrEqual(12);
    expect(project.scenes.length).toBeGreaterThanOrEqual(2);
    expect(project.lanes).toHaveLength(DEFAULT_LANES.length);
  });

  it('creates a minimal pack with one scene', () => {
    const project = freshProjectFromPackId('minimal');
    expect(project.scenes).toHaveLength(1);
    expect(project.clips).toHaveLength(5);
  });
});
