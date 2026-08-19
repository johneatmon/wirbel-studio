import { isProject, type PersistedSessionProject } from '../session/persistence';

export function serializeProject(project: PersistedSessionProject): string {
  return `${JSON.stringify(project, null, 2)}\n`;
}

export function parseProjectFile(text: string): PersistedSessionProject {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('Not a valid JSON project file');
  }
  if (!isProject(value)) throw new Error('Not a Wirbel project file');
  return value;
}
