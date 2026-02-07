'use client';

interface ViewControlsProps {
  currentPage: number;
  setCurrentPage: (v: number) => void;
  totalPages: number;
}

export function ViewControls({
  currentPage,
  setCurrentPage,
  totalPages,
}: ViewControlsProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center border-t border-bp-border bg-bp-panel/80 px-3 py-1.5 text-sm">
      <div className="flex items-center gap-1">
        <button
          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="rounded px-1.5 py-0.5 text-xs hover:bg-bp-bg disabled:opacity-30"
          data-testid="prev-page-button"
        >
          ◀
        </button>
        <span className="font-mono text-xs" data-testid="page-indicator">
          {currentPage}/{totalPages}
        </span>
        <button
          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className="rounded px-1.5 py-0.5 text-xs hover:bg-bp-bg disabled:opacity-30"
          data-testid="next-page-button"
        >
          ▶
        </button>
      </div>
    </div>
  );
}
