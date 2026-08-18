import { STARTER_PACKS } from '../library/starter-packs';

export function LibraryPanel({
  onClose,
  onCreateFromPack,
}: {
  onClose: () => void;
  onCreateFromPack: (packId: string) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 p-4 pt-[12vh]"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-lg border border-neutral-700 bg-neutral-900 shadow-2xl"
        role="dialog"
        aria-label="Starter library"
      >
        <div className="flex items-start justify-between gap-4 border-b border-neutral-800 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-neutral-100">Starter library</h2>
            <p className="mt-1 text-xs text-neutral-500">
              Pick a template when starting a new project. Your current project stays saved.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
            aria-label="Close library"
          >
            ×
          </button>
        </div>
        <ul className="max-h-96 overflow-auto py-2">
          {STARTER_PACKS.map((pack) => (
            <li key={pack.id}>
              <button
                type="button"
                onClick={() => {
                  onCreateFromPack(pack.id);
                  onClose();
                }}
                className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-neutral-800/70"
              >
                <span className="text-sm text-neutral-100">{pack.name}</span>
                <span className="text-xs leading-relaxed text-neutral-500">{pack.description}</span>
                <span className="text-[10px] text-neutral-600">
                  {pack.clips.length} clips · {pack.scenes.length}{' '}
                  {pack.scenes.length === 1 ? 'scene' : 'scenes'} · {pack.tempo} bpm
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
