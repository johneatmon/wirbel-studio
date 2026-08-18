import type { ActiveClips, SessionClip, SessionLane, SessionScene, SessionQuantize } from './model';

const DB_NAME = 'strudel-studio';
const DB_VERSION = 1;
const PROJECTS_STORE = 'projects';
const META_STORE = 'meta';
const ACTIVE_PROJECT_KEY = 'active-project-id';

export interface PersistedSessionProject {
  version: 1;
  id: string;
  name: string;
  tempo: number;
  launchQuantize: SessionQuantize;
  lanes: SessionLane[];
  clips: SessionClip[];
  scenes: SessionScene[];
  activeByLane: ActiveClips;
  selectedClipId: string | null;
  updatedAt: number;
}

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: number;
}

interface MetaRecord {
  key: string;
  value: string;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PROJECTS_STORE)) {
        database.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(META_STORE)) {
        database.createObjectStore(META_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open project database'));
  });
}

function isProject(value: unknown): value is PersistedSessionProject {
  if (!value || typeof value !== 'object') return false;
  const project = value as Partial<PersistedSessionProject>;
  return (
    project.version === 1 &&
    typeof project.id === 'string' &&
    typeof project.name === 'string' &&
    Array.isArray(project.lanes) &&
    Array.isArray(project.clips) &&
    Array.isArray(project.scenes) &&
    Boolean(project.activeByLane && typeof project.activeByLane === 'object')
  );
}

export async function saveProject(project: PersistedSessionProject): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction([PROJECTS_STORE, META_STORE], 'readwrite');
    transaction.objectStore(PROJECTS_STORE).put(project);
    transaction
      .objectStore(META_STORE)
      .put({ key: ACTIVE_PROJECT_KEY, value: project.id } satisfies MetaRecord);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export async function loadProject(id: string): Promise<PersistedSessionProject | null> {
  const database = await openDatabase();
  try {
    const value = await requestResult(
      database.transaction(PROJECTS_STORE).objectStore(PROJECTS_STORE).get(id),
    );
    return isProject(value) ? value : null;
  } finally {
    database.close();
  }
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const database = await openDatabase();
  try {
    const values = await requestResult(
      database.transaction(PROJECTS_STORE).objectStore(PROJECTS_STORE).getAll(),
    );
    return (values as unknown[])
      .filter(isProject)
      .map(({ id, name, updatedAt }) => ({ id, name, updatedAt }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } finally {
    database.close();
  }
}

export async function deleteProject(id: string): Promise<void> {
  const database = await openDatabase();
  try {
    const meta = (await requestResult(
      database.transaction(META_STORE).objectStore(META_STORE).get(ACTIVE_PROJECT_KEY),
    )) as MetaRecord | undefined;
    const transaction = database.transaction([PROJECTS_STORE, META_STORE], 'readwrite');
    transaction.objectStore(PROJECTS_STORE).delete(id);
    if (meta?.value === id) {
      transaction.objectStore(META_STORE).delete(ACTIVE_PROJECT_KEY);
    }
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export async function loadActiveProject(): Promise<PersistedSessionProject | null> {
  const database = await openDatabase();
  try {
    const meta = (await requestResult(
      database.transaction(META_STORE).objectStore(META_STORE).get(ACTIVE_PROJECT_KEY),
    )) as MetaRecord | undefined;
    if (meta?.value) {
      const active = await requestResult(
        database.transaction(PROJECTS_STORE).objectStore(PROJECTS_STORE).get(meta.value),
      );
      if (isProject(active)) return active;
    }
    const all = await requestResult(
      database.transaction(PROJECTS_STORE).objectStore(PROJECTS_STORE).getAll(),
    );
    return (
      (all as unknown[]).filter(isProject).sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null
    );
  } finally {
    database.close();
  }
}
