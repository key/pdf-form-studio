'use client';

import { useEffect, useState } from 'react';

interface EditorHeaderProps {
  fileName: string;
  fieldCount: number;
  onExportFormPdf: () => void;
  onClose: () => void;
  showGrid: boolean;
  setShowGrid: (v: boolean) => void;
  gridSize: number;
  setGridSize: (v: number) => void;
  snapEnabled: boolean;
  setSnapEnabled: (v: boolean) => void;
  scale: number;
  setScale: (v: number) => void;
  detectionAvailable?: boolean;
  isDetecting?: boolean;
  onRunDetection?: () => void;
}

export function EditorHeader({
  fileName,
  fieldCount,
  onExportFormPdf,
  onClose,
  showGrid,
  setShowGrid,
  gridSize,
  setGridSize,
  snapEnabled,
  setSnapEnabled,
  scale,
  setScale,
  detectionAvailable,
  isDetecting,
  onRunDetection,
}: EditorHeaderProps) {
  const [showGridPopover, setShowGridPopover] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);

  const handleRunDetection = () => {
    if (!onRunDetection) return;
    if (fieldCount > 0) {
      if (!window.confirm('既存のフィールドが上書きされます。AI検出を実行しますか？')) return;
    }
    onRunDetection();
  };

  useEffect(() => {
    if (!showCloseDialog) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowCloseDialog(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showCloseDialog]);

  const handleClose = () => {
    if (fieldCount > 0) {
      setShowCloseDialog(true);
    } else {
      onClose();
    }
  };

  const confirmClose = () => {
    onClose();
    setShowCloseDialog(false);
  };

  return (
    <>
      <div className="flex items-center justify-between border-b border-bp-border bg-bp-panel px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm opacity-60">📄</span>
          <span className="text-sm font-medium font-mono" data-testid="file-name">{fileName}</span>
          <button
            onClick={handleClose}
            className="flex h-[22px] w-[22px] items-center justify-center rounded text-bp-text opacity-35 transition-all hover:bg-red-50 hover:text-red-600 hover:opacity-100"
            title="PDFを閉じる"
            data-testid="close-button"
          >
            ✕
          </button>
        </div>

        {/* グリッド・ズーム設定 */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowGridPopover(!showGridPopover)}
              className={`rounded px-2 py-1 text-xs transition-colors ${
                snapEnabled ? 'bg-bp-accent text-white' : 'bg-bp-bg text-bp-text'
              }`}
              data-testid="grid-button"
            >
              グリッド {gridSize}pt
            </button>
            {showGridPopover && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowGridPopover(false)} data-testid="grid-popover-overlay" />
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
            data-testid="zoom-select"
          >
            <option value={1}>100%</option>
            <option value={1.5}>150%</option>
            <option value={2}>200%</option>
          </select>
        </div>

        {/* フォームPDF出力 */}
        <div className="flex items-center gap-2">
          {detectionAvailable && (
            <button
              onClick={handleRunDetection}
              disabled={isDetecting}
              className={`rounded px-3 py-1 text-sm transition-colors ${
                isDetecting
                  ? 'bg-bp-border text-bp-text/40 cursor-not-allowed'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              }`}
              title="AIでフォームフィールドを自動検出"
            >
              {isDetecting ? 'AI検出中...' : 'AI検出'}
            </button>
          )}
          <button
            onClick={onExportFormPdf}
            disabled={fieldCount === 0}
            className={`rounded px-3 py-1 text-sm transition-colors ${
              fieldCount === 0
                ? 'bg-bp-border text-bp-text/40 cursor-not-allowed'
                : 'bg-bp-accent text-white hover:bg-bp-accent/90'
            }`}
            title={fieldCount === 0 ? 'フィールドを作成してください' : 'AcroFormフィールド付きPDFをダウンロード'}
            data-testid="export-form-pdf-button"
          >
            フォームPDFを出力
          </button>
        </div>
      </div>

      {/* 確認ダイアログ */}
      {showCloseDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-bp-text/40 backdrop-blur-sm"
          onClick={() => setShowCloseDialog(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="close-dialog-title"
          data-testid="close-confirm-dialog"
        >
          <div
            className="w-[380px] rounded-xl border border-bp-border bg-bp-panel p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[10px] border border-red-200 bg-red-50 text-lg" role="img" aria-label="警告">
              ⚠️
            </div>
            <h3 id="close-dialog-title" className="mb-2 text-base font-semibold text-bp-text">PDFを閉じますか？</h3>
            <p className="mb-5 text-[13px] leading-relaxed text-bp-text/65">
              <span className="inline-flex items-center gap-1 rounded border border-bp-border bg-bp-bg px-2 py-0.5 font-mono text-xs font-medium text-bp-accent">
                {fieldCount} 件
              </span>
              {' '}のフィールドが定義されていますがダウンロードされていません。閉じると編集内容が失われます。
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCloseDialog(false)}
                className="rounded-md border border-bp-border px-4 py-2 text-[13px] font-medium text-bp-text transition-colors hover:bg-bp-bg"
                data-testid="cancel-close-button"
              >
                キャンセル
              </button>
              <button
                onClick={confirmClose}
                className="rounded-md border border-red-600 bg-red-600 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-red-700"
                data-testid="confirm-close-button"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
