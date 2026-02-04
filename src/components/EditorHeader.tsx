'use client';

interface EditorHeaderProps {
  fileName: string;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function EditorHeader({ fileName, onExport, onImport }: EditorHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-bp-border bg-bp-panel px-4 py-2">
      <div className="flex items-center gap-2">
        <span className="text-sm opacity-60">📄</span>
        <span className="text-sm font-medium font-mono">{fileName}</span>
      </div>
      <div className="flex items-center gap-2">
        <label className="cursor-pointer rounded border border-bp-border px-3 py-1 text-sm hover:bg-bp-bg transition-colors">
          インポート
          <input
            type="file"
            accept=".json"
            onChange={onImport}
            className="hidden"
          />
        </label>
        <button
          onClick={onExport}
          className="rounded bg-bp-accent px-3 py-1 text-sm text-white hover:bg-bp-accent/90 transition-colors"
        >
          エクスポート
        </button>
      </div>
    </div>
  );
}
