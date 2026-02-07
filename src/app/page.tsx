'use client';

import { useEffect, useRef } from 'react';
import { usePdfEditor } from '@/hooks/usePdfEditor';
import { DropZone } from '@/components/DropZone';
import { EditorHeader } from '@/components/EditorHeader';
import { ViewControls } from '@/components/ViewControls';
import { FieldPopover } from '@/components/FieldPopover';
import { FieldList } from '@/components/FieldList';
import { DetectingOverlay } from '@/components/DetectingOverlay';

export default function PdfEditorPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const hasTriggeredDetection = useRef(false);
  const editor = usePdfEditor({ canvasRef, overlayRef });

  // pdfDocが設定されたら自動検出を実行
  useEffect(() => {
    if (editor.pdfDoc && editor.detectionAvailable && !hasTriggeredDetection.current) {
      hasTriggeredDetection.current = true;
      editor.runFieldDetection();
    }
  }, [editor.pdfDoc, editor.detectionAvailable]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    hasTriggeredDetection.current = false;
    editor.resetEditor();
  };

  // PDF未読み込み → ドロップゾーン表示
  if (!editor.pdfDoc) {
    return (
      <DropZone
        onFileSelect={editor.loadPdf}
        isLoading={editor.isLoading}
      />
    );
  }

  // 選択中フィールドのポップオーバー位置計算
  const selectedFieldData = editor.selectedField
    ? editor.fields.find((f) => f.id === editor.selectedField && f.page === editor.currentPage)
    : null;
  const popoverPos = selectedFieldData
    ? (() => {
        const canvas = editor.pdfToCanvas(selectedFieldData.x, selectedFieldData.y);
        return { x: canvas.x + 10, y: canvas.y + 10 };
      })()
    : null;

  return (
    <div className="flex h-screen flex-col bg-bp-bg">
      {/* ヘッダー */}
      <EditorHeader
        fileName={editor.pdfFileName}
        fieldCount={editor.fields.length}
        onExportFormPdf={editor.exportFormPdf}
        onClose={handleClose}
        showGrid={editor.showGrid}
        setShowGrid={editor.setShowGrid}
        gridSize={editor.gridSize}
        setGridSize={editor.setGridSize}
        snapEnabled={editor.snapEnabled}
        setSnapEnabled={editor.setSnapEnabled}
        scale={editor.scale}
        setScale={editor.setScale}
        detectionAvailable={editor.detectionAvailable}
        isDetecting={editor.isDetecting}
        onRunDetection={editor.runFieldDetection}
      />

      {/* エラーバナー */}
      {editor.detectionError && (
        <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          <span className="flex-1">フィールド検出エラー: {editor.detectionError}</span>
          <button
            onClick={editor.clearDetectionError}
            className="rounded px-2 py-0.5 text-red-500 transition-colors hover:bg-red-100 hover:text-red-700"
          >
            ✕
          </button>
        </div>
      )}

      {/* メインエリア */}
      <div className="flex flex-1 overflow-hidden">
        {/* PDFプレビュー */}
        <div className="relative flex min-w-0 flex-1 flex-col">
          <div className="flex flex-1 items-start justify-center overflow-auto p-4">
            {editor.isPdfLoading ? (
              <div className="flex h-full items-center justify-center text-bp-text/40">
                PDF読み込み中...
              </div>
            ) : (
              <div className="relative inline-block">
                <canvas ref={canvasRef} className="block" data-testid="pdf-canvas" />
                <canvas
                  ref={overlayRef}
                  onMouseDown={editor.handleMouseDown}
                  onMouseMove={editor.handleMouseMove}
                  onMouseUp={editor.handleMouseUp}
                  onMouseLeave={editor.handleMouseUp}
                  data-testid="overlay-canvas"
                  className={`absolute inset-0 ${editor.isDragging ? 'cursor-grabbing' : 'cursor-crosshair'}`}
                />
                {/* フィールド編集ポップオーバー */}
                {selectedFieldData && popoverPos && (
                  <FieldPopover
                    key={selectedFieldData.id}
                    field={selectedFieldData}
                    position={popoverPos}
                    onUpdate={editor.updateField}
                    onDelete={editor.deleteField}
                    onClose={() => editor.setSelectedField(null)}
                  />
                )}
              </div>
            )}
          </div>
          {/* 検出中オーバーレイ */}
          {editor.isDetecting && <DetectingOverlay />}
          {/* ビューコントロール */}
          <ViewControls
            currentPage={editor.currentPage}
            setCurrentPage={editor.setCurrentPage}
            totalPages={editor.totalPages}
          />
        </div>

        {/* 右パネル: フィールド一覧 */}
        <div className="w-64 shrink-0">
          <FieldList
            fields={editor.fields}
            currentPage={editor.currentPage}
            selectedField={editor.selectedField}
            onSelect={editor.setSelectedField}
            onPageChange={editor.setCurrentPage}
            onExport={editor.exportJson}
            onImport={editor.importJson}
          />
        </div>
      </div>
    </div>
  );
}
