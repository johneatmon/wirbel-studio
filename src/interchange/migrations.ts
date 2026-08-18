import type { PersistedSessionProject } from '../session/persistence';
import { normalizeLoadedProject } from '../session/normalize-project';

export const CURRENT_PROJECT_VERSION = 1;

export function migrateSharedProject(raw: unknown): Omit<PersistedSessionProject, 'id' | 'updatedAt'> {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid shared project payload');
  const candidate = raw as Partial<PersistedSessionProject>;
  const version = candidate.version ?? 1;
  if (version !== 1) throw new Error(`Unsupported shared project version ${String(version)}`);
  const withVersion: PersistedSessionProject = {
    version: 1,
    id: 'share-import',
    name: typeof candidate.name === 'string' ? candidate.name : 'Shared session',
    tempo: typeof candidate.tempo === 'number' ? candidate.tempo : 120,
    launchQuantize: candidate.launchQuantize ?? 'cycle',
    lanes: Array.isArray(candidate.lanes) ? candidate.lanes : [],
    clips: Array.isArray(candidate.clips) ? candidate.clips : [],
    scenes: Array.isArray(candidate.scenes) ? candidate.scenes : [],
    activeByLane:
      candidate.activeByLane && typeof candidate.activeByLane === 'object'
        ? candidate.activeByLane
        : {},
    selectedClipId:
      typeof candidate.selectedClipId === 'string' ? candidate.selectedClipId : null,
    arrangement: candidate.arrangement,
    updatedAt: Date.now(),
  };
  const normalized = normalizeLoadedProject(withVersion);
  return {
    version: 1,
    name: normalized.projectName,
    tempo: normalized.tempo,
    launchQuantize: normalized.launchQuantize,
    lanes: normalized.lanes,
    clips: normalized.clips,
    scenes: normalized.scenes,
    activeByLane: normalized.activeByLane,
    selectedClipId: normalized.selectedClipId,
    arrangement: normalized.arrangement,
  };
}
