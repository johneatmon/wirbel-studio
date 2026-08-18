export function RiffPreview({
  code,
  error,
  loading,
  onAccept,
  onReject,
}: {
  code: string;
  error: string | null;
  loading: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-20 border-t border-emerald-900/50 bg-neutral-950/95 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.18em] text-emerald-600 uppercase">
            Riff preview
          </p>
          {loading ? (
            <p className="mt-1 text-xs text-neutral-500">Asking for a complementary layer…</p>
          ) : error ? (
            <p className="mt-1 text-xs text-red-400">{error}</p>
          ) : (
            <pre className="mt-1 max-h-28 overflow-auto font-mono text-[11px] leading-relaxed text-emerald-200/90">
              {code}
            </pre>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onReject}
            className="rounded px-2.5 py-1 text-xs text-neutral-400 hover:bg-neutral-800"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={onAccept}
            disabled={loading || Boolean(error) || !code}
            className="rounded bg-emerald-800 px-2.5 py-1 text-xs text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
