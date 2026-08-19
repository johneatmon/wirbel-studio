import { describe, expect, it } from 'vitest';
import {
  activateScene,
  compileSession,
  emptyActiveClips,
  toggleSessionClip,
  type SessionClip,
  type SessionLane,
  type SessionScene,
} from './model';

const lanes: SessionLane[] = [
  { id: 'drums', name: 'Drums', role: 'drums', gain: 1, muted: false, solo: false },
  { id: 'bass', name: 'Bass', role: 'bass', gain: 0.5, muted: false, solo: false },
];
const clips: SessionClip[] = [
  { id: 'drums-a', laneId: 'drums', name: 'Beat A', code: 's("bd*4");', color: '#fff' },
  { id: 'bass-a', laneId: 'bass', name: 'Bass A', code: 'note("c2")', color: '#fff' },
];

describe('session launch state', () => {
  it('keeps one active clip per lane and toggles the active clip off', () => {
    const empty = emptyActiveClips(lanes);
    const playing = toggleSessionClip(empty, clips[0]);
    expect(playing).toEqual({ drums: 'drums-a', bass: null });
    expect(toggleSessionClip(playing, clips[0])).toEqual(empty);
  });

  it('launches a scene atomically while preserving unspecified lanes', () => {
    const scene: SessionScene = {
      id: 'scene-a',
      name: 'Scene A',
      clipIds: { drums: 'drums-a' },
    };
    expect(activateScene({ drums: null, bass: 'bass-a' }, scene, lanes)).toEqual({
      drums: 'drums-a',
      bass: 'bass-a',
    });
  });
});

describe('compileSession', () => {
  it('returns null when no clips are active', () => {
    expect(compileSession(lanes, clips, emptyActiveClips(lanes))).toBeNull();
  });

  it('emits portable stack code in lane order and applies lane gain', () => {
    const code = compileSession(lanes, clips, { drums: 'drums-a', bass: 'bass-a' });
    expect(code).toContain('stack(');
    expect(code).toContain('(s("bd*4")).tag("studio-lane:drums")');
    expect(code).toContain('((note("c2")).gain(0.5)).tag("studio-lane:bass")');
    expect(code?.indexOf('bd*4')).toBeLessThan(code?.indexOf('c2') ?? 0);
  });

  it('omits muted lanes', () => {
    const muted = lanes.map((lane) => (lane.id === 'drums' ? { ...lane, muted: true } : lane));
    const code = compileSession(muted, clips, { drums: 'drums-a', bass: 'bass-a' });
    expect(code).not.toContain('bd*4');
    expect(code).toContain('c2');
  });

  it('plays only soloed lanes when any lane is soloed', () => {
    const soloed = lanes.map((lane) =>
      lane.id === 'bass' ? { ...lane, solo: true } : { ...lane, solo: false },
    );
    const code = compileSession(soloed, clips, { drums: 'drums-a', bass: 'bass-a' });
    expect(code).not.toContain('bd*4');
    expect(code).toContain('c2');
  });

  it('wraps clip motion around source without rewriting it', () => {
    const moving: SessionClip[] = [
      {
        ...clips[1],
        motion: { lpf: { min: 180, max: 1100, cycles: 8 } },
      },
    ];
    const code = compileSession(lanes, moving, { drums: null, bass: 'bass-a' });
    expect(moving[0].code).toBe('note("c2")');
    expect(code).toContain('(note("c2")).lpf(sine.range(180, 1100).slow(8))');
  });
});
