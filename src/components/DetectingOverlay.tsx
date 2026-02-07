export function DetectingOverlay() {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-bp-text/30 backdrop-blur-sm">
      <div className="w-72 rounded-xl border border-bp-border bg-bp-panel p-6 shadow-lg">
        <div className="mb-3 text-center text-2xl">
          <span role="img" aria-label="検出中">🔍</span>
        </div>
        <p className="mb-3 text-center text-sm font-medium text-bp-text">
          フィールドを検出中...
        </p>
        <div className="mb-3 h-2 overflow-hidden rounded-full bg-bp-bg">
          <div className="h-full w-1/2 rounded-full bg-bp-accent shimmer-bar" />
        </div>
        <p className="text-center text-xs text-bp-text/60">
          AIがPDFのフォームフィールドを分析しています
        </p>
      </div>
    </div>
  );
}
