import { describe, expect, it } from 'vitest';
import {
  applyArrangementAction,
  clampSectionStart,
  defaultSections,
  deriveLaneSpans,
  eventsDue,
  type ArrangementEvent,
} from './arrangement';
import type { SessionLane, SessionScene } from './model';

const lanes: SessionLane[] = [
  { id: 'drums', name: 'Drums', role: 'drums', gain: 1, muted: false, solo: false },
  { id: 'bass', name: 'Bass', role: 'bass', gain: 1, muted: false, solo: false },
];
const scenes: SessionScene[] = [
  { id: 'foundation', name: 'Foundation', clipIds: { drums: 'drums-a', bass: 'bass-a' } },
];

describe('applyArrangementAction', () => {
  it('launches, stops, and mutes without losing other lanes', () => {
    let active = { drums: null, bass: 'bass-a' };
    let next = applyArrangementAction(active, lanes, { type: 'launch', laneId: 'drums', clipId: 'drums-a' }, scenes);
    expect(next.activeByLane).toEqual({ drums: 'drums-a', bass: 'bass-a' });
    next = applyArrangementAction(next.activeByLane, lanes, { type: 'stop', laneId: 'bass' }, scenes);
    expect(next.activeByLane.bass).toBeNull();
    next = applyArrangementAction(next.activeByLane, next.lanes, { type: 'mute', laneId: 'drums', muted: true }, scenes);
    expect(next.lanes[0].muted).toBe(true);
  });

  it('applies a scene atomically', () => {
    const next = applyArrangementAction(
      { drums: null, bass: null },
      lanes,
      { type: 'scene', sceneId: 'foundation' },
      scenes,
    );
    expect(next.activeByLane).toEqual({ drums: 'drums-a', bass: 'bass-a' });
  });
});

describe('eventsDue', () => {
  const events: ArrangementEvent[] = [
    { cycle: 0, action: { type: 'launch', laneId: 'drums', clipId: 'drums-a' } },
    { cycle: 4, action: { type: 'launch', laneId: 'bass', clipId: 'bass-a' } },
    { cycle: 8, action: { type: 'stop', laneId: 'drums' } },
  ];

  it('replays the same events between two cycle cursors', () => {
    const first = eventsDue(events, 0, 0);
    expect(first.applied).toHaveLength(1);
    const mid = eventsDue(events, first.nextIndex, 7.9);
    expect(mid.applied.map((event) => event.cycle)).toEqual([4]);
    const rest = eventsDue(events, mid.nextIndex, 32);
    expect(rest.applied).toHaveLength(1);
    expect(rest.nextIndex).toBe(3);
  });
});

describe('deriveLaneSpans', () => {
  it('turns origin plus launch/stop events into closed lane intervals', () => {
    const spans = deriveLaneSpans(
      { drums: 'drums-a', bass: null },
      [
        { cycle: 4, action: { type: 'launch', laneId: 'bass', clipId: 'bass-a' } },
        { cycle: 8, action: { type: 'stop', laneId: 'drums' } },
        { cycle: 16, action: { type: 'stop-all' } },
      ],
      32,
      ['drums', 'bass'],
      scenes,
    );
    expect(spans).toEqual([
      { laneId: 'drums', clipId: 'drums-a', from: 0, to: 8 },
      { laneId: 'bass', clipId: 'bass-a', from: 4, to: 16 },
    ]);
  });
});

describe('sections', () => {
  it('places an 8-cycle grid across a 32-cycle take', () => {
    expect(defaultSections(32).map((section) => section.startCycle)).toEqual([0, 8, 16, 24]);
  });

  it('clamps a dragged section between its neighbors', () => {
    const moved = clampSectionStart(defaultSections(32), 'section-B', 99, 32);
    expect(moved[1].startCycle).toBe(15.75);
    expect(clampSectionStart(defaultSections(32), 'section-A', 4, 32)[0].startCycle).toBe(0);
  });
});
