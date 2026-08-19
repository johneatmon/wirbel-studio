export const AI_FEATURES_VISIBLE = false;

export interface GhostSettings {
  enabled: boolean;
  apiKey: string;
  model: string;
  endpoint: string;
}

const STORAGE_KEY = 'strudel-studio:ghost-settings';

export const DEFAULT_GHOST_SETTINGS: GhostSettings = {
  enabled: false,
  apiKey: '',
  model: 'claude-3-5-haiku-20241022',
  endpoint: 'https://api.anthropic.com/v1/messages',
};

export function loadGhostSettings(): GhostSettings {
  if (typeof window === 'undefined') return DEFAULT_GHOST_SETTINGS;
  try {
    const saved = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? '{}',
    ) as Partial<GhostSettings>;
    return {
      enabled: AI_FEATURES_VISIBLE && saved.enabled === true,
      apiKey: typeof saved.apiKey === 'string' ? saved.apiKey : '',
      model:
        typeof saved.model === 'string' && saved.model ? saved.model : DEFAULT_GHOST_SETTINGS.model,
      endpoint:
        typeof saved.endpoint === 'string' && saved.endpoint
          ? saved.endpoint
          : DEFAULT_GHOST_SETTINGS.endpoint,
    };
  } catch {
    return DEFAULT_GHOST_SETTINGS;
  }
}

export function saveGhostSettings(settings: GhostSettings): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
