'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface FieldDefinition {
  id: string;
  name: string;
  type: 'text' | 'checkbox';
  page: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  fontSize?: number;
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';
}

// PDF.jsの型定義
type PDFDocumentProxy = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PDFPageProxy>;
};

type PDFPageProxy = {
  getViewport: (params: { scale: number }) => { width: number; height: number };
  render: (params: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> };
};

export default function PdfEditorPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [pdfjsLib, setPdfjsLib] = useState<typeof import('pdfjs-dist') | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [pdfDimensions, setPdfDimensions] = useState({ width: 0, height: 0 });
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<'text' | 'checkbox'>('text');
  const [clickedPosition, setClickedPosition] = useState<{ x: number; y: number; width?: number; height?: number } | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [gridSize, setGridSize] = useState(10);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [showGridPopover, setShowGridPopover] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ x: number; y: number } | null>(null);
  const [hoveredField, setHoveredField] = useState<string | null>(null);

  // PDF.jsを動的にロード
  useEffect(() => {
    const loadPdfjs = async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        // ローカルのworkerファイルを使用
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        setPdfjsLib(pdfjs);
        console.log('PDF.js loaded, version:', pdfjs.version);
      } catch (error) {
        console.error('Failed to load PDF.js:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadPdfjs();
  }, []);

  // PDFファイルを読み込む
  const loadPdf = useCallback(async (file: File) => {
    if (!pdfjsLib) {
      console.error('PDF.js not loaded yet');
      return;
    }
    setIsPdfLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      setPdfDoc(pdf as unknown as PDFDocumentProxy);
      setTotalPages(pdf.numPages);
      setCurrentPage(1);
      console.log('PDF loaded:', pdf.numPages, 'pages');
    } catch (error) {
      console.error('Failed to load PDF:', error);
      alert(`PDFの読み込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsPdfLoading(false);
    }
  }, [pdfjsLib]);

  // ページをレンダリング
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;

    try {
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // PDF座標系の寸法を保存（スケールなし）
      const originalViewport = page.getViewport({ scale: 1 });
      setPdfDimensions({
        width: originalViewport.width,
        height: originalViewport.height,
      });

      await page.render({
        canvasContext: context,
        viewport,
      }).promise;

      // グリッド描画
      if (showGrid) {
        drawGrid(context, viewport.width, viewport.height, scale, originalViewport.height);
      }

      // フィールドマーカー描画
      drawFieldMarkers(context, scale, originalViewport.height);

      // 選択済み矩形を描画（オーバーレイではなくメインキャンバスに）
      if (clickedPosition?.width && clickedPosition?.height && !isSelecting) {
        const left = clickedPosition.x * scale;
        const bottom = (originalViewport.height - clickedPosition.y) * scale;
        const width = clickedPosition.width * scale;
        const height = clickedPosition.height * scale;

        context.fillStyle = 'rgba(59, 130, 246, 0.15)';
        context.fillRect(left, bottom - height, width, height);
        context.strokeStyle = '#3b82f6';
        context.lineWidth = 2;
        context.setLineDash([5, 5]);
        context.strokeRect(left, bottom - height, width, height);
        context.setLineDash([]);

        // 左下マーカー
        context.fillStyle = '#ef4444';
        context.beginPath();
        context.arc(left, bottom, 5, 0, Math.PI * 2);
        context.fill();
      }

      // オーバーレイサイズをPDFキャンバスに合わせる
      const overlay = overlayRef.current;
      if (overlay) {
        overlay.width = canvas.width;
        overlay.height = canvas.height;
      }
    } catch (error) {
      console.error('Failed to render page:', error);
    }
  }, [pdfDoc, currentPage, scale, showGrid, gridSize, fields, selectedField, hoveredField, clickedPosition, isSelecting]);

  // オーバーレイに選択矩形を描画
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const ctx = overlay.getContext('2d');
    if (!ctx) return;

    // クリア
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    if (!isSelecting || !selectionStart || !selectionEnd) return;

    let left = Math.min(selectionStart.x, selectionEnd.x);
    let right = Math.max(selectionStart.x, selectionEnd.x);
    let top = Math.min(selectionStart.y, selectionEnd.y);
    let bottom = Math.max(selectionStart.y, selectionEnd.y);

    // スナップ有効時はグリッドに合わせて描画
    if (snapEnabled && pdfDimensions.height > 0) {
      // Canvas座標をPDF座標に変換してスナップ
      const pdfLeft = Math.round(left / scale);
      const pdfRight = Math.round(right / scale);
      const pdfTop = pdfDimensions.height - Math.round(top / scale);
      const pdfBottom = pdfDimensions.height - Math.round(bottom / scale);

      const snappedLeft = Math.round(pdfLeft / gridSize) * gridSize;
      const snappedRight = Math.round(pdfRight / gridSize) * gridSize;
      const snappedTop = Math.round(pdfTop / gridSize) * gridSize;
      const snappedBottom = Math.round(pdfBottom / gridSize) * gridSize;

      // Canvas座標に戻す
      left = snappedLeft * scale;
      right = snappedRight * scale;
      top = (pdfDimensions.height - snappedTop) * scale;
      bottom = (pdfDimensions.height - snappedBottom) * scale;
    }

    const width = right - left;
    const height = bottom - top;

    // 半透明の塗り
    ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
    ctx.fillRect(left, top, width, height);

    // 枠線
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(left, top, width, height);
    ctx.setLineDash([]);

    // 左下マーカー（PDF座標の起点）
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(left, top + height, 5, 0, Math.PI * 2);
    ctx.fill();

    // サイズ表示
    const pdfWidth = Math.round(Math.abs(width) / scale);
    const pdfHeight = Math.round(Math.abs(height) / scale);
    ctx.fillStyle = '#000';
    ctx.font = '12px monospace';
    ctx.fillText(`${pdfWidth} × ${pdfHeight} pt`, left + 5, top + 15);
  }, [isSelecting, selectionStart, selectionEnd, scale, snapEnabled, gridSize, pdfDimensions]);

  // グリッド描画（PDF座標系に合わせて下からグリッド線を描画）
  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number, scale: number, pdfHeight: number) => {
    ctx.strokeStyle = 'rgba(180, 180, 180, 0.4)';
    ctx.lineWidth = 1;
    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(120, 120, 120, 0.6)';

    const gridSizeScaled = gridSize * scale;
    // X軸: PDF座標 0, gridSize, 2*gridSize, ... に対応
    for (let pdfX = 0; pdfX <= pdfHeight; pdfX += gridSize) {
      const canvasX = pdfX * scale;
      if (canvasX > width) break;
      ctx.beginPath();
      ctx.moveTo(canvasX, 0);
      ctx.lineTo(canvasX, height);
      ctx.stroke();
      ctx.fillText(`${pdfX}`, canvasX + 2, 12);
    }
    // Y軸: PDF座標 0, gridSize, 2*gridSize, ... に対応（Canvas座標は下から上）
    for (let pdfY = 0; pdfY <= pdfHeight; pdfY += gridSize) {
      const canvasY = (pdfHeight - pdfY) * scale;
      if (canvasY < 0) break;
      ctx.beginPath();
      ctx.moveTo(0, canvasY);
      ctx.lineTo(width, canvasY);
      ctx.stroke();
      ctx.fillText(`${pdfY}`, 2, canvasY - 2);
    }
  };

  // フィールドマーカー描画
  const drawFieldMarkers = (ctx: CanvasRenderingContext2D, scale: number, pdfHeight: number) => {
    fields
      .filter((f) => f.page === currentPage)
      .forEach((field) => {
        const canvasX = field.x * scale;
        // PDF座標をcanvas座標に変換（Y軸反転）
        const canvasY = (pdfHeight - field.y) * scale;

        const isSelected = field.id === selectedField;
        const isHovered = field.id === hoveredField;
        const markerSize = isSelected ? 8 : isHovered ? 7 : 6;

        // フィールドに幅・高さがある場合は矩形を描画
        if (field.width && field.height) {
          const rectWidth = field.width * scale;
          const rectHeight = field.height * scale;

          if (isSelected || isHovered) {
            ctx.fillStyle = isSelected ? 'rgba(34, 197, 94, 0.15)' : 'rgba(251, 191, 36, 0.2)';
            ctx.fillRect(canvasX, canvasY - rectHeight, rectWidth, rectHeight);
            ctx.strokeStyle = isSelected ? '#22c55e' : '#f59e0b';
            ctx.lineWidth = isSelected ? 2 : 1;
            ctx.strokeRect(canvasX, canvasY - rectHeight, rectWidth, rectHeight);
          }
        }

        // クロスヘア（十字線）を描画
        ctx.strokeStyle = isSelected ? '#22c55e' : isHovered ? '#f59e0b' : '#3b82f6';
        ctx.lineWidth = isSelected ? 2 : 1;

        // 縦線
        ctx.beginPath();
        ctx.moveTo(canvasX, canvasY - markerSize);
        ctx.lineTo(canvasX, canvasY + markerSize);
        ctx.stroke();

        // 横線
        ctx.beginPath();
        ctx.moveTo(canvasX - markerSize, canvasY);
        ctx.lineTo(canvasX + markerSize, canvasY);
        ctx.stroke();

        // チェックボックスは四角で囲む
        if (field.type === 'checkbox') {
          ctx.strokeRect(canvasX - 6, canvasY - 6, 12, 12);
        }

        // ラベル（背景付き）
        ctx.font = '11px sans-serif';
        const textWidth = ctx.measureText(field.name).width;
        ctx.fillStyle = isSelected ? 'rgba(34, 197, 94, 0.9)' : isHovered ? 'rgba(245, 158, 11, 0.9)' : 'rgba(59, 130, 246, 0.9)';
        ctx.fillRect(canvasX + 4, canvasY - 16, textWidth + 6, 14);
        ctx.fillStyle = '#fff';
        ctx.fillText(field.name, canvasX + 7, canvasY - 5);
      });
  };

  // 座標変換ヘルパー
  const canvasToPdf = (canvasX: number, canvasY: number) => ({
    x: Math.round(canvasX / scale),
    y: Math.round(pdfDimensions.height - canvasY / scale),
  });

  const pdfToCanvas = (pdfX: number, pdfY: number) => ({
    x: pdfX * scale,
    y: (pdfDimensions.height - pdfY) * scale,
  });

  // グリッドスナップヘルパー
  const snapToGrid = (value: number): number => {
    if (!snapEnabled) return value;
    return Math.round(value / gridSize) * gridSize;
  };

  // 次のグリッド線までの移動（矢印キー用）
  const snapToNextGrid = (currentValue: number, direction: 1 | -1): number => {
    if (!snapEnabled) return Math.max(0, currentValue + direction);
    const currentGrid = Math.floor(currentValue / gridSize) * gridSize;
    if (direction > 0) {
      return currentGrid + gridSize;
    } else {
      // 現在位置がグリッド線上なら1つ前へ、そうでなければ現在のグリッド線へ
      const next = currentValue === currentGrid ? currentGrid - gridSize : currentGrid;
      return Math.max(0, next); // 負の値を防ぐ
    }
  };

  // フィールドがクリック位置の近くにあるかチェック
  const findFieldAtPosition = (canvasX: number, canvasY: number): FieldDefinition | null => {
    for (const field of fields.filter((f) => f.page === currentPage)) {
      const fieldCanvas = pdfToCanvas(field.x, field.y);

      // 幅・高さがある場合は矩形内かチェック
      if (field.width && field.height) {
        const rectWidth = field.width * scale;
        const rectHeight = field.height * scale;
        if (
          canvasX >= fieldCanvas.x &&
          canvasX <= fieldCanvas.x + rectWidth &&
          canvasY >= fieldCanvas.y - rectHeight &&
          canvasY <= fieldCanvas.y
        ) {
          return field;
        }
      } else {
        // ポイントの近傍チェック
        const threshold = 15;
        const distance = Math.sqrt((canvasX - fieldCanvas.x) ** 2 + (canvasY - fieldCanvas.y) ** 2);
        if (distance < threshold) {
          return field;
        }
      }
    }
    return null;
  };

  // マウスダウン
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    // 既存フィールドをクリックしたかチェック
    const clickedField = findFieldAtPosition(canvasX, canvasY);
    if (clickedField) {
      setSelectedField(clickedField.id);
      setIsDragging(true);
      setDragStartPos({ x: canvasX, y: canvasY });
      setClickedPosition(null);
      setSelectionStart(null);
      setSelectionEnd(null);
    } else {
      // 矩形選択開始
      setIsSelecting(true);
      setSelectionStart({ x: canvasX, y: canvasY });
      setSelectionEnd({ x: canvasX, y: canvasY });
      setSelectedField(null);
    }
  };

  // マウス移動
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    if (isDragging && selectedField && dragStartPos) {
      // フィールドをドラッグ中（スナップはドラッグ終了時に適用）
      const dx = (canvasX - dragStartPos.x) / scale;
      const dy = -(canvasY - dragStartPos.y) / scale; // Y軸反転

      setFields((prev) =>
        prev.map((f) =>
          f.id === selectedField ? { ...f, x: Math.round(f.x + dx), y: Math.round(f.y + dy) } : f
        )
      );
      setDragStartPos({ x: canvasX, y: canvasY });
    } else if (isSelecting && selectionStart) {
      // 矩形選択中
      setSelectionEnd({ x: canvasX, y: canvasY });
    } else {
      // ホバー検出
      const hovered = findFieldAtPosition(canvasX, canvasY);
      setHoveredField(hovered?.id || null);
    }
  };

  // マウスアップ
  const handleMouseUp = () => {
    if (isSelecting && selectionStart && selectionEnd) {
      // 矩形選択完了 - 左下をPDF座標として設定
      const left = Math.min(selectionStart.x, selectionEnd.x);
      const right = Math.max(selectionStart.x, selectionEnd.x);
      const top = Math.min(selectionStart.y, selectionEnd.y);
      const bottom = Math.max(selectionStart.y, selectionEnd.y);

      // 選択範囲が小さすぎる場合はポイント選択として扱う
      if (right - left < 5 && bottom - top < 5) {
        const pdfPos = canvasToPdf(selectionStart.x, selectionStart.y);
        setClickedPosition({ x: snapToGrid(pdfPos.x), y: snapToGrid(pdfPos.y) });
      } else {
        // 矩形の左下をPDF座標に変換
        const pdfPos = canvasToPdf(left, bottom);
        const width = Math.round((right - left) / scale);
        const height = Math.round((bottom - top) / scale);
        setClickedPosition({
          x: snapToGrid(pdfPos.x),
          y: snapToGrid(pdfPos.y),
          width: snapToGrid(width),
          height: snapToGrid(height),
        });
      }
    }

    // ドラッグ終了時にスナップを適用
    if (isDragging && selectedField) {
      setFields((prev) =>
        prev.map((f) =>
          f.id === selectedField ? { ...f, x: snapToGrid(f.x), y: snapToGrid(f.y) } : f
        )
      );
    }

    setIsDragging(false);
    setDragStartPos(null);
    setIsSelecting(false);
  };

  // フィールド追加
  const addField = () => {
    if (!clickedPosition || !newFieldName.trim()) return;

    const pos = clickedPosition as { x: number; y: number; width?: number; height?: number };
    const newField: FieldDefinition = {
      id: `field_${Date.now()}`,
      name: newFieldName.trim(),
      type: newFieldType,
      page: currentPage,
      x: pos.x,
      y: pos.y,
      width: pos.width || (newFieldType === 'text' ? 200 : undefined),
      height: pos.height || (newFieldType === 'text' ? 20 : undefined),
      fontSize: 10,
    };

    setFields([...fields, newField]);
    setNewFieldName('');
    setClickedPosition(null);
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  // フィールド削除
  const deleteField = (id: string) => {
    setFields(fields.filter((f) => f.id !== id));
    if (selectedField === id) setSelectedField(null);
  };

  // フィールド座標更新
  const updateFieldPosition = (id: string, dx: number, dy: number) => {
    setFields(fields.map((f) => (f.id === id ? { ...f, x: f.x + dx, y: f.y + dy } : f)));
  };

  // フィールド座標を直接設定
  const setFieldPosition = (id: string, x: number, y: number) => {
    setFields(fields.map((f) => (f.id === id ? { ...f, x, y } : f)));
  };

  // キーボードイベント
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedField) return;
      // 入力フィールドにフォーカスがある場合はスキップ
      if (document.activeElement?.tagName === 'INPUT') return;

      const step = e.shiftKey ? 10 : 1; // Shift押してると10pt移動（スナップOFF時）
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          setFields((prev) => prev.map((f) => (f.id === selectedField ? { ...f, y: snapEnabled ? snapToNextGrid(f.y, 1) : f.y + step } : f)));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setFields((prev) => prev.map((f) => (f.id === selectedField ? { ...f, y: snapEnabled ? snapToNextGrid(f.y, -1) : f.y - step } : f)));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setFields((prev) => prev.map((f) => (f.id === selectedField ? { ...f, x: snapEnabled ? snapToNextGrid(f.x, -1) : f.x - step } : f)));
          break;
        case 'ArrowRight':
          e.preventDefault();
          setFields((prev) => prev.map((f) => (f.id === selectedField ? { ...f, x: snapEnabled ? snapToNextGrid(f.x, 1) : f.x + step } : f)));
          break;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          setFields((prev) => prev.filter((f) => f.id !== selectedField));
          setSelectedField(null);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedField, snapEnabled, gridSize]);

  // JSONエクスポート
  const exportJson = () => {
    const exportData = {
      fields: fields.map(({ id, ...rest }) => rest),
      pdfDimensions,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pdf_field_mapping.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // JSONインポート
  const importJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.fields) {
          setFields(
            data.fields.map((f: Omit<FieldDefinition, 'id'>, i: number) => ({
              ...f,
              id: `field_${Date.now()}_${i}`,
            }))
          );
        }
      } catch {
        alert('JSONの読み込みに失敗しました');
      }
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  if (isLoading) {
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
            onChange={(e) => e.target.files?.[0] && loadPdf(e.target.files[0])}
            className="rounded border px-2 py-1"
          />
          {/* グリッド設定ポップオーバー */}
          <div className="relative">
            <button
              onClick={() => setShowGridPopover(!showGridPopover)}
              className={`rounded px-3 py-1 ${snapEnabled ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >
              グリッド ▼
            </button>
            {showGridPopover && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowGridPopover(false)} />
                <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border bg-white p-4 shadow-lg">
                  <h3 className="mb-3 text-sm font-bold">グリッド設定</h3>
                  <label className="mb-3 flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showGrid}
                      onChange={(e) => setShowGrid(e.target.checked)}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">グリッド表示</span>
                  </label>
                  <label className="mb-3 flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={snapEnabled}
                      onChange={(e) => setSnapEnabled(e.target.checked)}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">スナップ</span>
                  </label>
                  <div className="mb-2 text-xs text-gray-500">グリッド幅</div>
                  <div className="grid grid-cols-5 gap-1">
                    {[5, 7.5, 10, 25, 50].map((size) => (
                      <button
                        key={size}
                        onClick={() => setGridSize(size)}
                        className={`rounded px-2 py-1 text-sm ${
                          gridSize === size ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-gray-400">現在: {gridSize}pt</p>
                </div>
              </>
            )}
          </div>
          <select value={scale} onChange={(e) => setScale(Number(e.target.value))} className="rounded border px-2 py-1">
            <option value={1}>100%</option>
            <option value={1.5}>150%</option>
            <option value={2}>200%</option>
          </select>
          {pdfDoc && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                className="rounded bg-gray-200 px-2 py-1 disabled:opacity-50"
              >
                ←
              </button>
              <span>
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages}
                className="rounded bg-gray-200 px-2 py-1 disabled:opacity-50"
              >
                →
              </button>
            </div>
          )}
          <button onClick={exportJson} className="rounded bg-green-500 px-3 py-1 text-white">
            JSONエクスポート
          </button>
          <label className="cursor-pointer rounded bg-yellow-500 px-3 py-1 text-white">
            JSONインポート
            <input type="file" accept=".json" onChange={importJson} className="hidden" />
          </label>
        </div>

        <div className="flex gap-4">
          {/* PDFキャンバス */}
          <div className="flex-1 overflow-auto rounded bg-white p-4 shadow">
            {isPdfLoading ? (
              <div className="flex h-96 items-center justify-center text-gray-500">
                PDF読み込み中...
              </div>
            ) : pdfDoc ? (
              <div className="relative inline-block">
                <canvas
                  ref={canvasRef}
                  className="border border-gray-300 block"
                />
                <canvas
                  ref={overlayRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  className={`absolute inset-0 ${isDragging ? 'cursor-grabbing' : 'cursor-crosshair'}`}
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
              {clickedPosition ? (
                <>
                  <p className="mb-1 font-mono text-sm">
                    x: {clickedPosition.x}, y: {clickedPosition.y}
                  </p>
                  {clickedPosition.width && clickedPosition.height && (
                    <p className="mb-2 font-mono text-xs text-gray-500">
                      サイズ: {clickedPosition.width} × {clickedPosition.height} pt
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
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
                className="mb-2 w-full rounded border px-2 py-1"
                disabled={!clickedPosition}
              />
              <div className="mb-2 flex gap-2">
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    checked={newFieldType === 'text'}
                    onChange={() => setNewFieldType('text')}
                  />
                  テキスト
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    checked={newFieldType === 'checkbox'}
                    onChange={() => setNewFieldType('checkbox')}
                  />
                  チェック
                </label>
              </div>
              <button
                onClick={addField}
                disabled={!clickedPosition || !newFieldName.trim()}
                className="w-full rounded bg-blue-500 py-1 text-white disabled:opacity-50"
              >
                フィールド追加
              </button>
            </div>

            {/* スクロール可能なエリア */}
            <div className="flex-1 overflow-y-auto space-y-4 mt-4">
            {/* 選択中フィールド編集 */}
            {selectedField && (() => {
              const field = fields.find((f) => f.id === selectedField);
              if (!field) return null;
              return (
                <div className="rounded bg-white p-4 shadow">
                  <h3 className="mb-2 font-bold">📝 {field.name}</h3>
                  {/* タイプ選択 */}
                  <div className="mb-2 flex gap-2">
                    <label className="flex items-center gap-1">
                      <input
                        type="radio"
                        checked={field.type === 'text'}
                        onChange={() => {
                          if (field.type === 'text') return;
                          const updates: Partial<FieldDefinition> = { type: 'text' };
                          if (!field.width) {
                            updates.width = 200;
                            updates.height = 20;
                          }
                          setFields(fields.map(f => f.id === field.id ? {...f, ...updates} : f));
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
                          setFields(fields.map(f => f.id === field.id ? {...f, type: 'checkbox'} : f));
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
                        onChange={(e) => setFieldPosition(field.id, Number(e.target.value), field.y)}
                        className="w-20 rounded border px-2 py-1 font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Y</label>
                      <input
                        type="number"
                        value={field.y}
                        onChange={(e) => setFieldPosition(field.id, field.x, Number(e.target.value))}
                        className="w-20 rounded border px-2 py-1 font-mono text-sm"
                      />
                    </div>
                  </div>
                  {/* アライメント */}
                  {field.width && field.height && (
                    <div className="mb-2">
                      <label className="text-xs text-gray-500">配置</label>
                      <div className="flex gap-1 mt-1">
                        <button
                          onClick={() => setFields(fields.map(f => f.id === field.id ? {...f, align: 'left'} : f))}
                          className={`rounded px-2 py-1 text-xs ${field.align === 'left' || !field.align ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                        >
                          左
                        </button>
                        <button
                          onClick={() => setFields(fields.map(f => f.id === field.id ? {...f, align: 'center'} : f))}
                          className={`rounded px-2 py-1 text-xs ${field.align === 'center' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                        >
                          中央
                        </button>
                        <button
                          onClick={() => setFields(fields.map(f => f.id === field.id ? {...f, align: 'right'} : f))}
                          className={`rounded px-2 py-1 text-xs ${field.align === 'right' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                        >
                          右
                        </button>
                      </div>
                      <div className="flex gap-1 mt-1">
                        <button
                          onClick={() => setFields(fields.map(f => f.id === field.id ? {...f, valign: 'top'} : f))}
                          className={`rounded px-2 py-1 text-xs ${field.valign === 'top' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                        >
                          上
                        </button>
                        <button
                          onClick={() => setFields(fields.map(f => f.id === field.id ? {...f, valign: 'middle'} : f))}
                          className={`rounded px-2 py-1 text-xs ${field.valign === 'middle' || !field.valign ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                        >
                          中央
                        </button>
                        <button
                          onClick={() => setFields(fields.map(f => f.id === field.id ? {...f, valign: 'bottom'} : f))}
                          className={`rounded px-2 py-1 text-xs ${field.valign === 'bottom' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                        >
                          下
                        </button>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-gray-500">
                    {snapEnabled ? `矢印キー/ボタン: ${gridSize}pt移動` : '矢印キー: 1pt移動 / Shift+矢印: 10pt移動'}
                  </p>
                  <div className="mt-2 flex gap-1">
                    <button
                      onClick={() => setFieldPosition(field.id, field.x, snapToNextGrid(field.y, 1))}
                      className="rounded bg-gray-200 px-2 py-1 text-xs"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => setFieldPosition(field.id, field.x, snapToNextGrid(field.y, -1))}
                      className="rounded bg-gray-200 px-2 py-1 text-xs"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => setFieldPosition(field.id, snapToNextGrid(field.x, -1), field.y)}
                      className="rounded bg-gray-200 px-2 py-1 text-xs"
                    >
                      ←
                    </button>
                    <button
                      onClick={() => setFieldPosition(field.id, snapToNextGrid(field.x, 1), field.y)}
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
              <h3 className="mb-2 font-bold">フィールド一覧 ({fields.length})</h3>
              <div className="max-h-96 space-y-1 overflow-auto">
                {fields.map((field) => (
                  <div
                    key={field.id}
                    className={`flex cursor-pointer items-center justify-between rounded p-2 text-sm ${
                      selectedField === field.id ? 'bg-blue-100' : 'hover:bg-gray-100'
                    }`}
                    onClick={() => {
                      setSelectedField(field.id);
                      if (field.page !== currentPage) setCurrentPage(field.page);
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
                        deleteField(field.id);
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
            {pdfDimensions.width > 0 && (
              <div className="rounded bg-white p-4 shadow">
                <h3 className="mb-2 font-bold">PDF情報</h3>
                <p className="font-mono text-sm">
                  サイズ: {Math.round(pdfDimensions.width)} × {Math.round(pdfDimensions.height)} pt
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
              <div className="mt-2 flex flex-wrap gap-2 items-center">
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block w-3 h-3 bg-blue-500 rounded-full"></span>
                  <span>通常</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block w-3 h-3 bg-amber-500 rounded-full"></span>
                  <span>ホバー</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block w-3 h-3 bg-green-500 rounded-full"></span>
                  <span>選択</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block w-3 h-3 bg-red-500 rounded-full"></span>
                  <span>座標</span>
                </span>
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
