'use client';

import { useRef } from 'react';
import { usePdfEditor } from '@/hooks/usePdfEditor';

export default function PdfEditorPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const editor = usePdfEditor({ canvasRef, overlayRef });

  if (editor.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-4 text-2xl font-bold">PDF座標エディタ</h1>

        {/* ツールバー */}
        <div className="mb-4 flex flex-wrap gap-2 rounded bg-white p-4 shadow">
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => e.target.files?.[0] && editor.loadPdf(e.target.files[0])}
            className="rounded border px-2 py-1"
          />
          {/* グリッド設定ポップオーバー */}
          <div className="relative">
            <button
              onClick={() => editor.setShowGrid(!editor.showGrid)}
              className={`rounded px-3 py-1 ${editor.snapEnabled ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >
              グリッド ▼
            </button>
          </div>
          <select value={editor.scale} onChange={(e) => editor.setScale(Number(e.target.value))} className="rounded border px-2 py-1">
            <option value={1}>100%</option>
            <option value={1.5}>150%</option>
            <option value={2}>200%</option>
          </select>
          {editor.pdfDoc && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => editor.setCurrentPage(Math.max(1, editor.currentPage - 1))}
                disabled={editor.currentPage <= 1}
                className="rounded bg-gray-200 px-2 py-1 disabled:opacity-50"
              >
                ←
              </button>
              <span>
                {editor.currentPage} / {editor.totalPages}
              </span>
              <button
                onClick={() => editor.setCurrentPage(Math.min(editor.totalPages, editor.currentPage + 1))}
                disabled={editor.currentPage >= editor.totalPages}
                className="rounded bg-gray-200 px-2 py-1 disabled:opacity-50"
              >
                →
              </button>
            </div>
          )}
          <button onClick={editor.exportJson} className="rounded bg-green-500 px-3 py-1 text-white">
            JSONエクスポート
          </button>
          <label className="cursor-pointer rounded bg-yellow-500 px-3 py-1 text-white">
            JSONインポート
            <input type="file" accept=".json" onChange={editor.importJson} className="hidden" />
          </label>
        </div>

        <div className="flex gap-4">
          {/* PDFキャンバス */}
          <div className="flex-1 overflow-auto rounded bg-white p-4 shadow">
            {editor.isPdfLoading ? (
              <div className="flex h-96 items-center justify-center text-gray-500">
                PDF読み込み中...
              </div>
            ) : editor.pdfDoc ? (
              <div className="relative inline-block">
                <canvas
                  ref={canvasRef}
                  className="border border-gray-300 block"
                />
                <canvas
                  ref={overlayRef}
                  onMouseDown={editor.handleMouseDown}
                  onMouseMove={editor.handleMouseMove}
                  onMouseUp={editor.handleMouseUp}
                  onMouseLeave={editor.handleMouseUp}
                  className={`absolute inset-0 ${editor.isDragging ? 'cursor-grabbing' : 'cursor-crosshair'}`}
                />
              </div>
            ) : (
              <div className="flex h-96 items-center justify-center text-gray-500">
                PDFファイルを選択してください
              </div>
            )}
          </div>

          {/* サイドパネル */}
          <div className="w-80 sticky top-4 self-start flex flex-col max-h-[calc(100vh-2rem)]">
            {/* 選択位置（常に表示・固定） */}
            <div className="flex-shrink-0 rounded bg-white p-4 shadow">
              <h3 className="mb-2 font-bold">📍 選択位置（左下）</h3>
              {editor.clickedPosition ? (
                <>
                  <p className="mb-1 font-mono text-sm">
                    x: {editor.clickedPosition.x}, y: {editor.clickedPosition.y}
                  </p>
                  {editor.clickedPosition.width && editor.clickedPosition.height && (
                    <p className="mb-2 font-mono text-xs text-gray-500">
                      サイズ: {editor.clickedPosition.width} × {editor.clickedPosition.height} pt
                    </p>
                  )}
                </>
              ) : (
                <p className="mb-2 text-sm text-gray-400">
                  PDFをクリックまたはドラッグで選択
                </p>
              )}
              <input
                type="text"
                placeholder="フィールド名"
                value={editor.newFieldName}
                onChange={(e) => editor.setNewFieldName(e.target.value)}
                className="mb-2 w-full rounded border px-2 py-1"
                disabled={!editor.clickedPosition}
              />
              <div className="mb-2 flex gap-2">
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    checked={editor.newFieldType === 'text'}
                    onChange={() => editor.setNewFieldType('text')}
                  />
                  テキスト
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    checked={editor.newFieldType === 'checkbox'}
                    onChange={() => editor.setNewFieldType('checkbox')}
                  />
                  チェック
                </label>
              </div>
              <button
                onClick={editor.addField}
                disabled={!editor.clickedPosition || !editor.newFieldName.trim()}
                className="w-full rounded bg-blue-500 py-1 text-white disabled:opacity-50"
              >
                フィールド追加
              </button>
            </div>

            {/* スクロール可能なエリア */}
            <div className="flex-1 overflow-y-auto space-y-4 mt-4">
            {/* 選択中フィールド編集 */}
            {editor.selectedField && (() => {
              const field = editor.fields.find((f) => f.id === editor.selectedField);
              if (!field) return null;
              return (
                <div className="rounded bg-white p-4 shadow">
                  <h3 className="mb-2 font-bold">📝 {field.name}</h3>
                  <div className="mb-2 flex gap-2">
                    <label className="flex items-center gap-1">
                      <input
                        type="radio"
                        checked={field.type === 'text'}
                        onChange={() => {
                          if (field.type === 'text') return;
                          const updates: Partial<typeof field> = { type: 'text' };
                          if (!field.width) {
                            updates.width = 200;
                            updates.height = 20;
                          }
                          editor.setFields(editor.fields.map(f => f.id === field.id ? {...f, ...updates} : f));
                        }}
                      />
                      テキスト
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="radio"
                        checked={field.type === 'checkbox'}
                        onChange={() => {
                          if (field.type === 'checkbox') return;
                          editor.setFields(editor.fields.map(f => f.id === field.id ? {...f, type: 'checkbox' as const} : f));
                        }}
                      />
                      チェック
                    </label>
                  </div>
                  <div className="mb-2 flex gap-2">
                    <div>
                      <label className="text-xs text-gray-500">X</label>
                      <input
                        type="number"
                        value={field.x}
                        onChange={(e) => editor.setFieldPosition(field.id, Number(e.target.value), field.y)}
                        className="w-20 rounded border px-2 py-1 font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Y</label>
                      <input
                        type="number"
                        value={field.y}
                        onChange={(e) => editor.setFieldPosition(field.id, field.x, Number(e.target.value))}
                        className="w-20 rounded border px-2 py-1 font-mono text-sm"
                      />
                    </div>
                  </div>
                  {field.width && field.height && (
                    <div className="mb-2">
                      <label className="text-xs text-gray-500">配置</label>
                      <div className="flex gap-1 mt-1">
                        <button
                          onClick={() => editor.setFields(editor.fields.map(f => f.id === field.id ? {...f, align: 'left' as const} : f))}
                          className={`rounded px-2 py-1 text-xs ${field.align === 'left' || !field.align ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                        >
                          左
                        </button>
                        <button
                          onClick={() => editor.setFields(editor.fields.map(f => f.id === field.id ? {...f, align: 'center' as const} : f))}
                          className={`rounded px-2 py-1 text-xs ${field.align === 'center' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                        >
                          中央
                        </button>
                        <button
                          onClick={() => editor.setFields(editor.fields.map(f => f.id === field.id ? {...f, align: 'right' as const} : f))}
                          className={`rounded px-2 py-1 text-xs ${field.align === 'right' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                        >
                          右
                        </button>
                      </div>
                      <div className="flex gap-1 mt-1">
                        <button
                          onClick={() => editor.setFields(editor.fields.map(f => f.id === field.id ? {...f, valign: 'top' as const} : f))}
                          className={`rounded px-2 py-1 text-xs ${field.valign === 'top' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                        >
                          上
                        </button>
                        <button
                          onClick={() => editor.setFields(editor.fields.map(f => f.id === field.id ? {...f, valign: 'middle' as const} : f))}
                          className={`rounded px-2 py-1 text-xs ${field.valign === 'middle' || !field.valign ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                        >
                          中央
                        </button>
                        <button
                          onClick={() => editor.setFields(editor.fields.map(f => f.id === field.id ? {...f, valign: 'bottom' as const} : f))}
                          className={`rounded px-2 py-1 text-xs ${field.valign === 'bottom' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                        >
                          下
                        </button>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-gray-500">
                    {editor.snapEnabled ? `矢印キー/ボタン: ${editor.gridSize}pt移動` : '矢印キー: 1pt移動 / Shift+矢印: 10pt移動'}
                  </p>
                  <div className="mt-2 flex gap-1">
                    <button
                      onClick={() => editor.setFieldPosition(field.id, field.x, editor.snapToNextGrid(field.y, 1))}
                      className="rounded bg-gray-200 px-2 py-1 text-xs"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => editor.setFieldPosition(field.id, field.x, editor.snapToNextGrid(field.y, -1))}
                      className="rounded bg-gray-200 px-2 py-1 text-xs"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => editor.setFieldPosition(field.id, editor.snapToNextGrid(field.x, -1), field.y)}
                      className="rounded bg-gray-200 px-2 py-1 text-xs"
                    >
                      ←
                    </button>
                    <button
                      onClick={() => editor.setFieldPosition(field.id, editor.snapToNextGrid(field.x, 1), field.y)}
                      className="rounded bg-gray-200 px-2 py-1 text-xs"
                    >
                      →
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* フィールド一覧 */}
            <div className="rounded bg-white p-4 shadow">
              <h3 className="mb-2 font-bold">フィールド一覧 ({editor.fields.length})</h3>
              <div className="max-h-96 space-y-1 overflow-auto">
                {editor.fields.map((field) => (
                  <div
                    key={field.id}
                    className={`flex cursor-pointer items-center justify-between rounded p-2 text-sm ${
                      editor.selectedField === field.id ? 'bg-blue-100' : 'hover:bg-gray-100'
                    }`}
                    onClick={() => {
                      editor.setSelectedField(field.id);
                      if (field.page !== editor.currentPage) editor.setCurrentPage(field.page);
                    }}
                  >
                    <div>
                      <span className="font-medium">{field.name}</span>
                      <span className="ml-1 text-xs text-gray-500">
                        ({field.type === 'checkbox' ? '☑' : 'T'})
                      </span>
                      <div className="font-mono text-xs text-gray-400">
                        p{field.page}: ({field.x}, {field.y})
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        editor.deleteField(field.id);
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* PDF情報 */}
            {editor.pdfDimensions.width > 0 && (
              <div className="rounded bg-white p-4 shadow">
                <h3 className="mb-2 font-bold">PDF情報</h3>
                <p className="font-mono text-sm">
                  サイズ: {Math.round(editor.pdfDimensions.width)} × {Math.round(editor.pdfDimensions.height)} pt
                </p>
              </div>
            )}

            {/* 操作ヒント */}
            <div className="rounded bg-gray-50 p-3 text-xs text-gray-600">
              <p className="font-bold mb-1">操作方法</p>
              <ul className="space-y-1">
                <li>• クリック: 位置を設定</li>
                <li>• ドラッグ: 矩形選択（左下が座標）</li>
                <li>• マーカーをドラッグ: 移動</li>
                <li>• 矢印キー: 1pt移動</li>
                <li>• Shift+矢印: 10pt移動</li>
                <li>• Delete: 削除</li>
              </ul>
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
