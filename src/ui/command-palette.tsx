import { useEffect, useMemo, useRef, useState } from 'react';

export interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  disabled?: boolean;
  run: () => void;
}

export function CommandPalette({
  items,
  onClose,
}: {
  items: CommandItem[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(needle) || item.hint?.toLowerCase().includes(needle),
    );
  }, [items, query]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const run = (item: CommandItem) => {
    if (item.disabled) return;
    item.run();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 p-4 pt-[12vh]"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-lg border border-neutral-700 bg-neutral-900 shadow-2xl"
        role="dialog"
        aria-label="Command palette"
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              onClose();
              return;
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActive((index) => Math.min(filtered.length - 1, index + 1));
              return;
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((index) => Math.max(0, index - 1));
              return;
            }
            if (event.key === 'Enter') {
              event.preventDefault();
              const item = filtered[active];
              if (item) run(item);
            }
          }}
          placeholder="Run a command…"
          className="w-full border-b border-neutral-800 bg-transparent px-3 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
        />
        <ul className="max-h-72 overflow-auto py-1">
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-xs text-neutral-600">No matching commands</li>
          )}
          {filtered.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                disabled={item.disabled}
                onMouseEnter={() => setActive(index)}
                onClick={() => run(item)}
                className={`flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm disabled:opacity-40 ${
                  index === active ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-300'
                }`}
              >
                <span>{item.label}</span>
                {item.hint && <span className="text-[10px] text-neutral-600">{item.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
