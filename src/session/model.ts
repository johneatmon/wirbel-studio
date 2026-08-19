import { STARTER_CLIPS } from '../library/starter-clips';
import { DEFAULT_SCENE_TEMPLATES } from '../library/starter-scenes';

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
  /** Time-varying controls compiled around the clip, not written into source. */
  motion?: ClipMotion;
}

export interface ClipLfo {
  min: number;
  max: number;
  cycles: number;
}

export interface ClipMotion {
  lpf?: ClipLfo;
}

export function defaultLpfMotion(laneId: string): ClipLfo {
  if (laneId === 'bass') return { min: 180, max: 1100, cycles: 8 };
  if (laneId === 'harmony') return { min: 500, max: 2400, cycles: 16 };
  if (laneId === 'melody') return { min: 900, max: 3600, cycles: 4 };
  return { min: 400, max: 2000, cycles: 8 };
}

export function applyClipMotion(code: string, motion?: ClipMotion): string {
  let expr = code.trim().replace(/;+$/, '');
  const lpf = motion?.lpf;
  if (
    lpf &&
    Number.isFinite(lpf.min) &&
    Number.isFinite(lpf.max) &&
    Number.isFinite(lpf.cycles)
  ) {
    const min = Math.min(18000, Math.max(20, lpf.min));
    const max = Math.min(18000, Math.max(20, lpf.max));
    const cycles = Math.min(64, Math.max(0.25, lpf.cycles));
    expr = `(${expr}).lpf(sine.range(${Math.min(min, max)}, ${Math.max(min, max)}).slow(${cycles}))`;
  }
  return expr;
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

export const DEFAULT_CLIPS: SessionClip[] = STARTER_CLIPS.map((clip) => ({ ...clip }));

export const DEFAULT_SCENES: SessionScene[] = DEFAULT_SCENE_TEMPLATES.map((scene) => ({
  id: scene.id,
  name: scene.name,
  clipIds: { ...scene.clipIds },
}));

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
  const voiced = applyClipMotion(clip.code, clip.motion);
  const gained = lane.gain === 1 ? voiced : `(${voiced}).gain(${lane.gain})`;
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
