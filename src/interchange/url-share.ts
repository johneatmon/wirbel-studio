import type { PersistedSessionProject } from '../session/persistence';
import type { SessionClip, SessionScene } from '../session/model';
import { migrateSharedProject } from './migrations';
import { utf8ToBase64 } from './export-session';

export const SHARE_PREFIX = 'p=1.';
export const SHARE_URL_MAX = 1800;

export type SharePayload =
  | {
      kind: 'project';
      project: Omit<PersistedSessionProject, 'id' | 'updatedAt'>;
    }
  | {
      kind: 'scene';
      name: string;
      tempo: number;
      scene: SessionScene;
      clips: SessionClip[];
    };

function base64UrlEncode(text: string): string {
  return encodeURIComponent(utf8ToBase64(text));
}

function base64UrlDecode(encoded: string): string {
  const binary = atob(decodeURIComponent(encoded));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeSharePayload(payload: SharePayload): string {
  return `${SHARE_PREFIX}${base64UrlEncode(JSON.stringify(payload))}`;
}

export function decodeSharePayload(encoded: string): SharePayload {
  const payload = encoded.startsWith(SHARE_PREFIX) ? encoded.slice(SHARE_PREFIX.length) : encoded;
  let parsed: unknown;
  try {
    parsed = JSON.parse(base64UrlDecode(payload));
  } catch {
    throw new Error('Could not decode share link');
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid share link payload');
  const value = parsed as Partial<SharePayload> & { kind?: string };
  if (value.kind === 'project' && value.project) {
    return { kind: 'project', project: migrateSharedProject(value.project) };
  }
  if (value.kind === 'scene' && value.scene && Array.isArray(value.clips)) {
    return {
      kind: 'scene',
      name: typeof value.name === 'string' ? value.name : value.scene.name,
      tempo: typeof value.tempo === 'number' ? value.tempo : 120,
      scene: value.scene,
      clips: value.clips,
    };
  }
  throw new Error('Unsupported share link payload');
}

export function buildShareUrl(
  payload: SharePayload,
  origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost',
  pathname = typeof window !== 'undefined' ? window.location.pathname || '/' : '/',
): string {
  return `${origin}${pathname}#${encodeSharePayload(payload)}`;
}

export function parseShareHash(hash = typeof window !== 'undefined' ? window.location.hash : ''): SharePayload | null {
  const trimmed = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!trimmed.startsWith(SHARE_PREFIX)) return null;
  try {
    return decodeSharePayload(trimmed);
  } catch {
    return null;
  }
}

export function shareUrlLength(payload: SharePayload): number {
  return buildShareUrl(payload, 'https://example.com', '/').length;
}

export function projectSharePayload(
  project: PersistedSessionProject,
): SharePayload {
  const { id: _id, updatedAt: _updatedAt, ...rest } = project;
  return { kind: 'project', project: rest };
}

export function sceneSharePayload(
  project: PersistedSessionProject,
  sceneId: string,
): SharePayload {
  const scene = project.scenes.find((candidate) => candidate.id === sceneId);
  if (!scene) throw new Error('Scene not found');
  const clipIds = new Set(Object.values(scene.clipIds));
  const clips = project.clips.filter((clip) => clipIds.has(clip.id));
  return {
    kind: 'scene',
    name: scene.name,
    tempo: project.tempo,
    scene: { ...scene, clipIds: { ...scene.clipIds } },
    clips: clips.map((clip) => ({ ...clip })),
  };
}

export function clearShareHash(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.hash = '';
  window.history.replaceState(null, '', url.toString());
}
