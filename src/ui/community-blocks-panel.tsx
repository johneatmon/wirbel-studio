import { useMemo, useRef, useState } from 'react';
import { allBlocks, refreshCommunityRegistry } from '../blocks/registry';
import {
  exportCommunityBlock,
  importCommunityBlockJson,
  isBundledCommunityBlock,
  listCommunityCatalog,
  removeUserCommunityBlock,
} from '../blocks/community/store';
import { blockDefFromSerializable } from '../blocks/community/template-body';

export function CommunityBlocksPanel({
  onClose,
  onBlocksChanged,
}: {
  onClose: () => void;
  onBlocksChanged: () => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const catalog = useMemo(() => listCommunityCatalog(), [message]);

  const refresh = () => {
    refreshCommunityRegistry();
    onBlocksChanged();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end bg-black/45 p-4"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="mt-10 flex w-full max-w-md flex-col gap-4 rounded-lg border border-neutral-700 bg-neutral-900 p-4 shadow-2xl"
        role="dialog"
        aria-label="Community blocks"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-neutral-100">Community blocks</h2>
            <p className="mt-1 text-xs leading-relaxed text-neutral-500">
              Browse shared block templates, import JSON definitions, or export your own to share.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
            aria-label="Close community blocks"
          >
            ×
          </button>
        </div>

        <ul className="max-h-48 space-y-2 overflow-auto text-xs">
          {catalog.map((block) => (
            <li
              key={block.id}
              className="rounded border border-neutral-800 bg-neutral-950/60 px-3 py-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-neutral-200">
                    {block.name}{' '}
                    <span className="text-neutral-600">· {block.category}</span>
                  </p>
                  <p className="mt-0.5 text-neutral-500">{block.description}</p>
                  {block.author && (
                    <p className="mt-1 text-[10px] text-neutral-600">by {block.author}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={async () => {
                      const def = blockDefFromSerializable(block);
                      await navigator.clipboard.writeText(exportCommunityBlock(block));
                      setMessage(`Copied JSON for “${def.name}”. Share it or open a PR for the manifest.`);
                    }}
                    className="rounded bg-neutral-800 px-2 py-1 text-[10px] text-neutral-300 hover:bg-neutral-700"
                  >
                    Copy JSON
                  </button>
                  {block.source === 'user' && !isBundledCommunityBlock(block.id) && (
                    <button
                      type="button"
                      onClick={() => {
                        removeUserCommunityBlock(block.id);
                        refresh();
                        setMessage(`Removed “${block.name}” from your blocks.`);
                      }}
                      className="rounded px-2 py-1 text-[10px] text-red-400 hover:bg-red-950/40"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="space-y-2">
          <label className="block text-xs text-neutral-400">
            Import block JSON
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={5}
              placeholder='{"id":"my-block","name":"My Block",...}'
              className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-2.5 py-2 font-mono text-[11px] text-neutral-200 outline-none focus:border-emerald-700"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!draft.trim()}
              onClick={() => {
                try {
                  const block = importCommunityBlockJson(draft);
                  setDraft('');
                  refresh();
                  setMessage(`Added “${block.name}” to your block list.`);
                } catch (reason) {
                  setMessage(reason instanceof Error ? reason.message : String(reason));
                }
              }}
              className="rounded bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700 disabled:opacity-40"
            >
              Import JSON
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700"
            >
              Import file
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (!file) return;
              void file.text().then((text) => {
                try {
                  const block = importCommunityBlockJson(text);
                  refresh();
                  setMessage(`Added “${block.name}” from file.`);
                } catch (reason) {
                  setMessage(reason instanceof Error ? reason.message : String(reason));
                }
              });
            }}
          />
        </div>

        <p className="text-[10px] leading-relaxed text-neutral-600">
          Built-in blocks: {allBlocks().filter((def) => !catalog.some((c) => c.id === def.id)).length}{' '}
          · Community catalog: {catalog.length}. To add to the bundled list, copy JSON and open a PR
          against <code className="text-neutral-500">src/blocks/community/manifest.ts</code>.
        </p>

        {message && <p className="text-xs text-neutral-300">{message}</p>}
      </div>
    </div>
  );
}
