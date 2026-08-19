const STORAGE_KEY = 'wirbel-onboarding-v1';

export function isOnboardingComplete(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'done';
  } catch {
    return false;
  }
}

export function completeOnboarding(): void {
  try {
    localStorage.setItem(STORAGE_KEY, 'done');
  } catch {
    // ignore storage failures
  }
}
