'use client';

import { useState } from 'react';

interface EditorHeaderProps {
  fileName: string;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  showGrid: boolean;
  setShowGrid: (v: boolean) => void;
  gridSize: number;
  setGridSize: (v: number) => void;
  snapEnabled: boolean;
  setSnapEnabled: (v: boolean) => void;
  scale: number;
  setScale: (v: number) => void;
}

export function EditorHeader({
  fileName,
  onExport,
  onImport,
  showGrid,
  setShowGrid,
  gridSize,
  setGridSize,
  snapEnabled,
  setSnapEnabled,
  scale,
  setScale,
}: EditorHeaderProps) {
  const [showGridPopover, setShowGridPopover] = useState(false);

  return (
    <div className="flex items-center justify-between border-b border-bp-border bg-bp-panel px-4 py-2">
      <div className="flex items-center gap-2">
        <span className="text-sm opacity-60">📄</span>
        <span className="text-sm font-medium font-mono">{fileName}</span>
      </div>

      {/* グリッド・ズーム設定 */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setShowGridPopover(!showGridPopover)}
            className={`rounded px-2 py-1 text-xs transition-colors ${
              snapEnabled ? 'bg-bp-accent text-white' : 'bg-bp-bg text-bp-text'
            }`}
          >
            グリッド {gridSize}pt
          </button>
          {showGridPopover && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowGridPopover(false)} />
              <div className="absolute top-full left-0 z-20 mt-1 w-48 rounded border border-bp-border bg-bp-panel p-3 shadow-lg">
                <label className="mb-2 flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showGrid}
                    onChange={(e) => setShowGrid(e.target.checked)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="text-xs">グリッド表示</span>
                </label>
                <label className="mb-2 flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={snapEnabled}
                    onChange={(e) => setSnapEnabled(e.target.checked)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="text-xs">スナップ</span>
                </label>
                <div className="grid grid-cols-5 gap-1">
                  {[5, 7.5, 10, 25, 50].map((size) => (
                    <button
                      key={size}
                      onClick={() => setGridSize(size)}
                      className={`rounded px-1.5 py-0.5 text-xs ${
                        gridSize === size ? 'bg-bp-accent text-white' : 'bg-bp-bg hover:bg-bp-border'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <select
          value={scale}
          onChange={(e) => setScale(Number(e.target.value))}
          className="rounded border border-bp-border bg-bp-panel px-2 py-1 text-xs font-mono"
        >
          <option value={1}>100%</option>
          <option value={1.5}>150%</option>
          <option value={2}>200%</option>
        </select>
      </div>

      {/* インポート・エクスポート */}
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
