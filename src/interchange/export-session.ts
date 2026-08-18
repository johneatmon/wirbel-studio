import { tempoToCps } from '../audio/tempo';
import { compileSession, type ActiveClips, type SessionClip, type SessionLane } from '../session/model';
import { useSessionStore } from '../session/session-store';

export function portableSessionCode(
  lanes: SessionLane[],
  clips: SessionClip[],
  active: ActiveClips,
  tempo: number,
): string | null {
  const compiled = compileSession(lanes, clips, active);
  if (!compiled) return null;
  return `setcps(${tempoToCps(tempo)})\n${compiled}`;
}

export function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function strudelShareUrl(code: string): string {
  return `https://strudel.cc/#${encodeURIComponent(utf8ToBase64(code))}`;
}

export function sessionPortableCode(): string | null {
  const state = useSessionStore.getState();
  return portableSessionCode(state.lanes, state.clips, state.activeByLane, state.tempo);
}
