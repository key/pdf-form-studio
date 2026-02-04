'use client';

import { useRef } from 'react';
import { usePdfEditor } from '@/hooks/usePdfEditor';
import { DropZone } from '@/components/DropZone';
import { EditorHeader } from '@/components/EditorHeader';
import { ViewControls } from '@/components/ViewControls';
import { FieldPopover } from '@/components/FieldPopover';
import { FieldList } from '@/components/FieldList';

export default function PdfEditorPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const editor = usePdfEditor({ canvasRef, overlayRef });

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
    ? editor.fields.find((f) => f.id === editor.selectedField)
    : null;
  const popoverPos = selectedFieldData
    ? (() => {
        const canvas = editor.pdfToCanvas(selectedFieldData.x, selectedFieldData.y);
        return { x: canvas.x + 10, y: canvas.y - 10 };
      })()
    : null;

  return (
    <div className="flex h-screen flex-col bg-bp-bg">
      {/* ヘッダー */}
      <EditorHeader
        fileName={editor.pdfFileName}
        onExport={editor.exportJson}
        onImport={editor.importJson}
      />

      {/* メインエリア */}
      <div className="flex flex-1 overflow-hidden">
        {/* PDFプレビュー */}
        <div className="flex flex-1 flex-col">
          <div className="flex-1 overflow-auto p-4">
            {editor.isPdfLoading ? (
              <div className="flex h-full items-center justify-center text-bp-text/40">
                PDF読み込み中...
              </div>
            ) : (
              <div className="relative inline-block">
                <canvas ref={canvasRef} className="block" />
                <canvas
                  ref={overlayRef}
                  onMouseDown={editor.handleMouseDown}
                  onMouseMove={editor.handleMouseMove}
                  onMouseUp={editor.handleMouseUp}
                  onMouseLeave={editor.handleMouseUp}
                  className={`absolute inset-0 ${editor.isDragging ? 'cursor-grabbing' : 'cursor-crosshair'}`}
                />
                {/* フィールド編集ポップオーバー */}
                {selectedFieldData && popoverPos && (
                  <FieldPopover
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
          {/* ビューコントロール */}
          <ViewControls
            showGrid={editor.showGrid}
            setShowGrid={editor.setShowGrid}
            gridSize={editor.gridSize}
            setGridSize={editor.setGridSize}
            snapEnabled={editor.snapEnabled}
            setSnapEnabled={editor.setSnapEnabled}
            scale={editor.scale}
            setScale={editor.setScale}
            currentPage={editor.currentPage}
            setCurrentPage={editor.setCurrentPage}
            totalPages={editor.totalPages}
          />
        </div>

        {/* 右パネル: フィールド一覧 */}
        <div className="w-64">
          <FieldList
            fields={editor.fields}
            currentPage={editor.currentPage}
            selectedField={editor.selectedField}
            onSelect={editor.setSelectedField}
            onAddText={() => editor.addFieldAtCenter('text')}
            onAddCheckbox={() => editor.addFieldAtCenter('checkbox')}
            onPageChange={editor.setCurrentPage}
          />
        </div>
      </div>
    </div>
  );
}
