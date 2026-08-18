export type LaneRole = 'drums' | 'bass' | 'harmony' | 'melody' | 'texture' | 'fx';
export type SessionQuantize = 'immediate' | 'beat' | 'cycle';

export interface SessionLane {
  id: string;
  name: string;
  role: LaneRole;
  gain: number;
  muted: boolean;
  solo: boolean;
}

export interface SessionClip {
  id: string;
  laneId: string;
  name: string;
  code: string;
  color: string;
}

export interface SessionScene {
  id: string;
  name: string;
  clipIds: Record<string, string>;
}

export type ActiveClips = Record<string, string | null>;

export const DEFAULT_LANES: SessionLane[] = [
  { id: 'drums', name: 'Drums', role: 'drums', gain: 1, muted: false, solo: false },
  { id: 'bass', name: 'Bass', role: 'bass', gain: 1, muted: false, solo: false },
  { id: 'harmony', name: 'Harmony', role: 'harmony', gain: 1, muted: false, solo: false },
  { id: 'melody', name: 'Melody', role: 'melody', gain: 1, muted: false, solo: false },
  { id: 'texture', name: 'Texture', role: 'texture', gain: 1, muted: false, solo: false },
];

export function clampLaneGain(gain: number): number {
  if (!Number.isFinite(gain)) return 1;
  return Math.min(1, Math.max(0, gain));
}

export function normalizeLane(lane: SessionLane): SessionLane {
  return {
    ...lane,
    gain: clampLaneGain(lane.gain),
    muted: lane.muted ?? false,
    solo: lane.solo ?? false,
  };
}

/** Whether a lane contributes to the compiled mix (mute/solo aware). */
export function laneAudible(lane: SessionLane, lanes: SessionLane[]): boolean {
  if (lane.muted) return false;
  const anySolo = lanes.some((candidate) => candidate.solo);
  if (anySolo) return lane.solo;
  return true;
}

export const DEFAULT_CLIPS: SessionClip[] = [
  {
    id: 'drums-909',
    laneId: 'drums',
    name: '909 Foundation',
    color: '#fb7185',
    code: 's("bd*4, ~ cp ~ cp, hh*8").bank("RolandTR909").gain(0.55)',
  },
  {
    id: 'drums-broken',
    laneId: 'drums',
    name: 'Broken Beat',
    color: '#f97316',
    code: 's("bd ~ [bd bd] ~, ~ sd ~ sd, hh*8").bank("RolandTR808").gain(0.5)',
  },
  {
    id: 'bass-acid',
    laneId: 'bass',
    name: 'Acid Pulse',
    color: '#34d399',
    code: 'note("c2 [c2 c3]*2 c2 [~ c2]")\n  .s("sawtooth").lpf(650).lpq(14).gain(0.35)',
  },
  {
    id: 'bass-sub',
    laneId: 'bass',
    name: 'Sub Steps',
    color: '#2dd4bf',
    code: 'note("<c2 c2 eb2 bb1>")\n  .s("triangle").lpf(900).release(0.2).gain(0.4)',
  },
  {
    id: 'harmony-warm',
    laneId: 'harmony',
    name: 'Warm Pad',
    color: '#a78bfa',
    code: 'note("<c4,e4,g4> <a3,c4,e4>")\n  .s("triangle").slow(2).lpf(1400).room(0.45).gain(0.22)',
  },
  {
    id: 'harmony-stabs',
    laneId: 'harmony',
    name: 'Soft Stabs',
    color: '#c084fc',
    code: 'note("<c4 eb4 g4 bb4>*2")\n  .s("square").lpf(1800).release(0.12).gain(0.16)',
  },
  {
    id: 'melody-glass',
    laneId: 'melody',
    name: 'Glass Arp',
    color: '#60a5fa',
    code: 'note("<c5 eb5 g5 bb5>*2")\n  .s("sine").delay(0.25).gain(0.25)',
  },
  {
    id: 'melody-motif',
    laneId: 'melody',
    name: 'Night Motif',
    color: '#38bdf8',
    code: 'note("c5 ~ eb5 g5 ~ bb5 g5 eb5")\n  .s("triangle").lpf(2200).gain(0.24)',
  },
  {
    id: 'texture-dust',
    laneId: 'texture',
    name: 'High Dust',
    color: '#fbbf24',
    code: 's("hh*16").hpf(7000).gain("[0.04 0.09]*8")',
  },
  {
    id: 'texture-swell',
    laneId: 'texture',
    name: 'Slow Swell',
    color: '#facc15',
    code: 'note("<c6 g5>")\n  .s("sine").slow(4).attack(0.5).release(1).room(0.8).gain(0.1)',
  },
];

export const DEFAULT_SCENES: SessionScene[] = [
  {
    id: 'foundation',
    name: 'Foundation',
    clipIds: {
      drums: 'drums-909',
      bass: 'bass-acid',
      harmony: 'harmony-warm',
      melody: 'melody-glass',
      texture: 'texture-dust',
    },
  },
  {
    id: 'lift',
    name: 'Lift',
    clipIds: {
      drums: 'drums-broken',
      bass: 'bass-sub',
      harmony: 'harmony-stabs',
      melody: 'melody-motif',
      texture: 'texture-swell',
    },
  },
];

export function emptyActiveClips(lanes: SessionLane[]): ActiveClips {
  return Object.fromEntries(lanes.map((lane) => [lane.id, null]));
}

export function toggleSessionClip(active: ActiveClips, clip: SessionClip): ActiveClips {
  return {
    ...active,
    [clip.laneId]: active[clip.laneId] === clip.id ? null : clip.id,
  };
}

export function activateScene(
  active: ActiveClips,
  scene: SessionScene,
  lanes: SessionLane[],
): ActiveClips {
  return Object.fromEntries(
    lanes.map((lane) => [lane.id, scene.clipIds[lane.id] ?? active[lane.id] ?? null]),
  );
}

export function indentExpression(code: string): string {
  return code
    .trim()
    .replace(/;+$/, '')
    .split('\n')
    .map((line, index) => `${index === 0 ? '  ' : '    '}${line}`)
    .join('\n');
}

export const STUDIO_LANE_TAG_PREFIX = 'studio-lane:';

export function studioLaneTag(laneId: string): string {
  return `${STUDIO_LANE_TAG_PREFIX}${laneId}`;
}

export function compileLaneExpression(lane: SessionLane, clip: SessionClip): string {
  const trimmed = clip.code.trim().replace(/;+$/, '');
  const gained = lane.gain === 1 ? trimmed : `(${trimmed}).gain(${lane.gain})`;
  return `(${gained}).tag(${JSON.stringify(studioLaneTag(lane.id))})`;
}

export interface SessionCompilePart {
  laneId: string;
  laneName: string;
  clipId: string;
  expression: string;
}

export function compileSessionParts(
  lanes: SessionLane[],
  clips: SessionClip[],
  active: ActiveClips,
): SessionCompilePart[] {
  const parts: SessionCompilePart[] = [];
  for (const lane of lanes) {
    if (!laneAudible(lane, lanes)) continue;
    const clipId = active[lane.id];
    const clip = clips.find((candidate) => candidate.id === clipId && candidate.laneId === lane.id);
    if (!clip?.code.trim()) continue;
    parts.push({
      laneId: lane.id,
      laneName: lane.name,
      clipId: clip.id,
      expression: compileLaneExpression(lane, clip),
    });
  }
  return parts;
}

export function buildSessionStack(expressions: string[]): string | null {
  if (!expressions.length) return null;
  const indented = expressions.map(indentExpression);
  return `// Generated from the active Strudel Studio session\nstack(\n${indented.join(',\n')}\n)`;
}

/** Compile current launch state into the exact portable Strudel program sent
 * to the evaluator. Returns null when nothing is active. */
export function compileSession(
  lanes: SessionLane[],
  clips: SessionClip[],
  active: ActiveClips,
): string | null {
  return buildSessionStack(
    compileSessionParts(lanes, clips, active).map((part) => part.expression),
  );
}
