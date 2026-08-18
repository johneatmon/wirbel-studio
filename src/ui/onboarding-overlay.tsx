import { completeOnboarding } from './onboarding-state';

export function OnboardingOverlay({
  sceneCount,
  onLaunchFirst,
  onDismiss,
}: {
  sceneCount: number;
  onLaunchFirst: () => void;
  onDismiss: () => void;
}) {
  const dismiss = () => {
    completeOnboarding();
    onDismiss();
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-24 z-20 flex justify-center px-4">
      <div
        className="pointer-events-auto max-w-md rounded-lg border border-emerald-900/50 bg-neutral-950/95 p-4 shadow-2xl backdrop-blur-sm"
        role="dialog"
        aria-label="Getting started"
      >
        <p className="text-sm font-medium text-neutral-100">Make your first jam</p>
        <ol className="mt-2 space-y-1.5 text-xs leading-relaxed text-neutral-400">
          <li>
            Press <kbd className="rounded bg-neutral-800 px-1.5 py-0.5 text-neutral-200">1</kbd>
            {sceneCount > 1 ? (
              <>
                {' '}
                or <kbd className="rounded bg-neutral-800 px-1.5 py-0.5 text-neutral-200">2</kbd>
              </>
            ) : null}{' '}
            to launch a scene, or hit Launch.
          </li>
          <li>
            Click any clip to select it —{' '}
            <kbd className="rounded bg-neutral-800 px-1.5 py-0.5 text-neutral-200">Space</kbd>{' '}
            toggles launch,{' '}
            <kbd className="rounded bg-neutral-800 px-1.5 py-0.5 text-neutral-200">⇧Space</kbd>{' '}
            stops its lane.
          </li>
          <li>
            Open <span className="text-neutral-300">Share</span> to copy Strudel, save a link, or
            download your project.
          </li>
        </ol>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => {
              onLaunchFirst();
              dismiss();
            }}
            className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600"
          >
            Launch first scene
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="rounded px-3 py-1.5 text-xs text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
