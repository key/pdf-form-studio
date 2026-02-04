'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FieldDefinition, PDFDocumentProxy, RenderTask } from '@/types';

interface UsePdfEditorOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  overlayRef: React.RefObject<HTMLCanvasElement | null>;
}

export function usePdfEditor({ canvasRef, overlayRef }: UsePdfEditorOptions) {
  const renderTaskRef = useRef<RenderTask | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [pdfjsLib, setPdfjsLib] = useState<typeof import('pdfjs-dist') | null>(null);
  const [currentPage, setCurrentPageRaw] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [pdfDimensions, setPdfDimensions] = useState({ width: 0, height: 0 });
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [gridSize, setGridSize] = useState(7.5);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [dragStartFieldPos, setDragStartFieldPos] = useState<{ x: number; y: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ x: number; y: number } | null>(null);
  const [hoveredField, setHoveredField] = useState<string | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStartPos, setResizeStartPos] = useState<{ x: number; y: number } | null>(null);
  const [resizeStartSize, setResizeStartSize] = useState<{ width: number; height: number } | null>(null);
  const [pdfFileName, setPdfFileName] = useState('');

  // PDF.jsを動的にロード
  useEffect(() => {
    const loadPdfjs = async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
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

  // ページ変更時にフィールド選択をクリア
  const setCurrentPage = useCallback((page: number) => {
    setCurrentPageRaw(page);
    setSelectedField(null);
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
      setPdfFileName(file.name);
      console.log('PDF loaded:', pdf.numPages, 'pages');
    } catch (error) {
      console.error('Failed to load PDF:', error);
      alert(`PDFの読み込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsPdfLoading(false);
    }
  }, [pdfjsLib, setCurrentPage]);

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
  const snapToNextGrid = useCallback((currentValue: number, direction: 1 | -1): number => {
    if (!snapEnabled) return Math.max(0, currentValue + direction);
    const currentGrid = Math.floor(currentValue / gridSize) * gridSize;
    if (direction > 0) {
      return currentGrid + gridSize;
    } else {
      const next = currentValue === currentGrid ? currentGrid - gridSize : currentGrid;
      return Math.max(0, next);
    }
  }, [snapEnabled, gridSize]);

  // フィールドがクリック位置の近くにあるかチェック
  const findFieldAtPosition = (canvasX: number, canvasY: number): FieldDefinition | null => {
    for (const field of fields.filter((f) => f.page === currentPage)) {
      const fieldCanvas = pdfToCanvas(field.x, field.y);

      if (field.type === 'checkbox') {
        // チェックボックス: fontSizeベースの正方形で判定
        const boxSize = (field.fontSize || 10) * scale;
        if (
          canvasX >= fieldCanvas.x &&
          canvasX <= fieldCanvas.x + boxSize &&
          canvasY >= fieldCanvas.y - boxSize &&
          canvasY <= fieldCanvas.y
        ) {
          return field;
        }
      } else if (field.width && field.height) {
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
        const threshold = 15;
        const distance = Math.sqrt((canvasX - fieldCanvas.x) ** 2 + (canvasY - fieldCanvas.y) ** 2);
        if (distance < threshold) {
          return field;
        }
      }
    }
    return null;
  };

  // リサイズハンドル判定
  const isOnResizeHandle = (canvasX: number, canvasY: number, field: FieldDefinition): boolean => {
    if (field.type !== 'text' || !field.width || !field.height) return false;

    const fieldCanvas = pdfToCanvas(field.x, field.y);
    const handleX = fieldCanvas.x + field.width * scale;
    const handleY = fieldCanvas.y - field.height * scale;
    const threshold = 10;

    return Math.abs(canvasX - handleX) < threshold && Math.abs(canvasY - handleY) < threshold;
  };

  // グリッド描画（Blueprint風）
  const drawGrid = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, scale: number, pdfWidth: number, pdfHeight: number) => {
    // 方眼紙風の薄いグリッド
    ctx.strokeStyle = 'rgba(191, 219, 254, 0.5)'; // bp-grid
    ctx.lineWidth = 0.5;

    for (let pdfX = 0; pdfX <= pdfWidth; pdfX += gridSize) {
      const canvasX = pdfX * scale;
      if (canvasX > width) break;
      ctx.beginPath();
      ctx.moveTo(canvasX, 0);
      ctx.lineTo(canvasX, height);
      ctx.stroke();
    }
    for (let pdfY = 0; pdfY <= pdfHeight; pdfY += gridSize) {
      const canvasY = (pdfHeight - pdfY) * scale;
      if (canvasY < 0) break;
      ctx.beginPath();
      ctx.moveTo(0, canvasY);
      ctx.lineTo(width, canvasY);
      ctx.stroke();
    }

    // ルーラーラベル（モノスペース）
    ctx.font = '9px monospace';
    ctx.fillStyle = 'rgba(37, 99, 235, 0.4)'; // bp-accent 薄め
    for (let pdfX = 0; pdfX <= pdfWidth; pdfX += gridSize) {
      const canvasX = pdfX * scale;
      if (canvasX > width) break;
      ctx.fillText(`${pdfX}`, canvasX + 1, 9);
    }
    for (let pdfY = 0; pdfY <= pdfHeight; pdfY += gridSize) {
      const canvasY = (pdfHeight - pdfY) * scale;
      if (canvasY < 0) break;
      ctx.fillText(`${pdfY}`, 1, canvasY - 1);
    }
  }, [gridSize]);

  // フィールドマーカー描画（Blueprint風）
  const drawFieldMarkers = useCallback((ctx: CanvasRenderingContext2D, scale: number, pdfHeight: number) => {
    fields
      .filter((f) => f.page === currentPage)
      .forEach((field) => {
        const canvasX = field.x * scale;
        const canvasY = (pdfHeight - field.y) * scale;

        const isSelected = field.id === selectedField;
        const isHovered = field.id === hoveredField;
        const markerSize = isSelected ? 8 : isHovered ? 7 : 6;

        ctx.strokeStyle = isSelected ? '#2563eb' : isHovered ? '#3b82f6' : '#3b82f680';
        ctx.lineWidth = isSelected ? 2 : 1;

        if (field.type === 'checkbox') {
          // チェックボックス: fontSizeベースの正方形
          const boxSize = (field.fontSize || 10) * scale;
          ctx.fillStyle = isSelected
            ? 'rgba(37, 99, 235, 0.15)'
            : isHovered
              ? 'rgba(59, 130, 246, 0.1)'
              : 'rgba(59, 130, 246, 0.05)';
          ctx.fillRect(canvasX, canvasY - boxSize, boxSize, boxSize);
          ctx.strokeRect(canvasX, canvasY - boxSize, boxSize, boxSize);

          // チェックマーク
          ctx.beginPath();
          ctx.moveTo(canvasX + boxSize * 0.2, canvasY - boxSize * 0.5);
          ctx.lineTo(canvasX + boxSize * 0.45, canvasY - boxSize * 0.2);
          ctx.lineTo(canvasX + boxSize * 0.8, canvasY - boxSize * 0.75);
          ctx.stroke();
        } else {
          // テキストフィールドの矩形（破線）
          if (field.width && field.height) {
            const rectWidth = field.width * scale;
            const rectHeight = field.height * scale;

            ctx.fillStyle = isSelected
              ? 'rgba(37, 99, 235, 0.1)'
              : isHovered
                ? 'rgba(59, 130, 246, 0.08)'
                : 'rgba(59, 130, 246, 0.05)';
            ctx.fillRect(canvasX, canvasY - rectHeight, rectWidth, rectHeight);

            ctx.setLineDash(isSelected ? [] : [4, 3]);
            ctx.strokeRect(canvasX, canvasY - rectHeight, rectWidth, rectHeight);
            ctx.setLineDash([]);
          }

          // クロスヘア
          ctx.beginPath();
          ctx.moveTo(canvasX, canvasY - markerSize);
          ctx.lineTo(canvasX, canvasY + markerSize);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(canvasX - markerSize, canvasY);
          ctx.lineTo(canvasX + markerSize, canvasY);
          ctx.stroke();
        }

        // リサイズハンドル
        if (isSelected && field.type === 'text' && field.width && field.height) {
          const handleX = canvasX + field.width * scale;
          const handleY = canvasY - field.height * scale;
          ctx.fillStyle = '#2563eb';
          ctx.fillRect(handleX - 4, handleY - 4, 8, 8);
        }

        // ラベル（モノスペース）
        ctx.font = '10px monospace';
        const textWidth = ctx.measureText(field.name).width;
        ctx.fillStyle = isSelected ? '#2563eb' : isHovered ? '#3b82f6' : '#3b82f6cc';
        ctx.fillRect(canvasX + 4, canvasY - 14, textWidth + 6, 13);
        ctx.fillStyle = '#fff';
        ctx.fillText(field.name, canvasX + 7, canvasY - 4);
      });
  }, [fields, currentPage, selectedField, hoveredField]);

  // ページをレンダリング
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;

    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }

    try {
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const originalViewport = page.getViewport({ scale: 1 });
      setPdfDimensions({
        width: originalViewport.width,
        height: originalViewport.height,
      });

      const renderTask = page.render({
        canvasContext: context,
        viewport,
      });
      renderTaskRef.current = renderTask;
      await renderTask.promise;

      if (showGrid) {
        drawGrid(context, viewport.width, viewport.height, scale, originalViewport.width, originalViewport.height);
      }

      drawFieldMarkers(context, scale, originalViewport.height);

      const overlay = overlayRef.current;
      if (overlay) {
        overlay.width = canvas.width;
        overlay.height = canvas.height;
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Rendering cancelled')) {
        return;
      }
      console.error('Failed to render page:', error);
    }
  }, [pdfDoc, currentPage, scale, showGrid, canvasRef, overlayRef, drawGrid, drawFieldMarkers]);

  // オーバーレイに選択矩形を描画
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const ctx = overlay.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, overlay.width, overlay.height);

    if (!isSelecting || !selectionStart || !selectionEnd) return;

    let left = Math.min(selectionStart.x, selectionEnd.x);
    let right = Math.max(selectionStart.x, selectionEnd.x);
    let top = Math.min(selectionStart.y, selectionEnd.y);
    let bottom = Math.max(selectionStart.y, selectionEnd.y);

    if (snapEnabled && pdfDimensions.height > 0) {
      const pdfLeft = Math.round(left / scale);
      const pdfRight = Math.round(right / scale);
      const pdfTop = pdfDimensions.height - Math.round(top / scale);
      const pdfBottom = pdfDimensions.height - Math.round(bottom / scale);

      const snappedLeft = Math.round(pdfLeft / gridSize) * gridSize;
      const snappedRight = Math.round(pdfRight / gridSize) * gridSize;
      const snappedTop = Math.round(pdfTop / gridSize) * gridSize;
      const snappedBottom = Math.round(pdfBottom / gridSize) * gridSize;

      left = snappedLeft * scale;
      right = snappedRight * scale;
      top = (pdfDimensions.height - snappedTop) * scale;
      bottom = (pdfDimensions.height - snappedBottom) * scale;
    }

    const width = right - left;
    const height = bottom - top;

    ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
    ctx.fillRect(left, top, width, height);

    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(left, top, width, height);
    ctx.setLineDash([]);

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(left, top + height, 5, 0, Math.PI * 2);
    ctx.fill();

    const pdfWidth = Math.round(Math.abs(width) / scale);
    const pdfHeightVal = Math.round(Math.abs(height) / scale);
    ctx.fillStyle = '#000';
    ctx.font = '12px monospace';
    ctx.fillText(`${pdfWidth} × ${pdfHeightVal} pt`, left + 5, top + 15);
  }, [isSelecting, selectionStart, selectionEnd, scale, snapEnabled, gridSize, pdfDimensions, overlayRef]);

  // マウスダウン
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    if (selectedField) {
      const field = fields.find(f => f.id === selectedField);
      if (field && isOnResizeHandle(canvasX, canvasY, field)) {
        setIsResizing(true);
        setResizeStartPos({ x: canvasX, y: canvasY });
        setResizeStartSize({ width: field.width ?? 0, height: field.height ?? 0 });
        return;
      }
    }

    const clickedField = findFieldAtPosition(canvasX, canvasY);
    if (clickedField) {
      setSelectedField(clickedField.id);
      setIsDragging(true);
      setDragStartPos({ x: canvasX, y: canvasY });
      setDragStartFieldPos({ x: clickedField.x, y: clickedField.y });
      setSelectionStart(null);
      setSelectionEnd(null);
    } else {
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

    if (isResizing && selectedField && resizeStartPos && resizeStartSize) {
      const dx = (canvasX - resizeStartPos.x) / scale;
      const dy = -(canvasY - resizeStartPos.y) / scale;

      const newWidth = Math.max(10, resizeStartSize.width + dx);
      const newHeight = Math.max(10, resizeStartSize.height + dy);

      setFields((prev) =>
        prev.map((f) =>
          f.id === selectedField
            ? { ...f, width: snapToGrid(Math.round(newWidth)), height: snapToGrid(Math.round(newHeight)) }
            : f
        )
      );
    } else if (isDragging && selectedField && dragStartPos && dragStartFieldPos) {
      const dx = (canvasX - dragStartPos.x) / scale;
      const dy = -(canvasY - dragStartPos.y) / scale;

      const newX = snapToGrid(Math.round(dragStartFieldPos.x + dx));
      const newY = snapToGrid(Math.round(dragStartFieldPos.y + dy));

      setFields((prev) =>
        prev.map((f) =>
          f.id === selectedField ? { ...f, x: newX, y: newY } : f
        )
      );
    } else if (isSelecting && selectionStart) {
      setSelectionEnd({ x: canvasX, y: canvasY });
    } else {
      const hovered = findFieldAtPosition(canvasX, canvasY);
      setHoveredField(hovered?.id || null);

      if (selectedField && overlayRef.current) {
        const field = fields.find(f => f.id === selectedField);
        if (field && isOnResizeHandle(canvasX, canvasY, field)) {
          overlayRef.current.style.cursor = 'nesw-resize';
          return;
        }
        overlayRef.current.style.cursor = '';
      }
    }
  };

  // マウスアップ
  const handleMouseUp = () => {
    if (isSelecting && selectionStart && selectionEnd) {
      const left = Math.min(selectionStart.x, selectionEnd.x);
      const right = Math.max(selectionStart.x, selectionEnd.x);
      const top = Math.min(selectionStart.y, selectionEnd.y);
      const bottom = Math.max(selectionStart.y, selectionEnd.y);

      if (right - left < 5 && bottom - top < 5) {
        // ポイントクリック → フィールド即時作成
        const pdfPos = canvasToPdf(selectionStart.x, selectionStart.y);
        const id = crypto.randomUUID();
        setFields((prev) => [...prev, {
          id,
          name: `field_${prev.length + 1}`,
          type: 'text',
          page: currentPage,
          x: snapToGrid(pdfPos.x),
          y: snapToGrid(pdfPos.y),
          width: 200,
          height: 20,
          fontSize: 10,
        }]);
        setSelectedField(id);

      } else {
        // 矩形ドラッグ → 矩形サイズでフィールド即時作成
        const pdfPos = canvasToPdf(left, bottom);
        const width = Math.round((right - left) / scale);
        const height = Math.round((bottom - top) / scale);
        const id = crypto.randomUUID();
        setFields((prev) => [...prev, {
          id,
          name: `field_${prev.length + 1}`,
          type: 'text',
          page: currentPage,
          x: snapToGrid(pdfPos.x),
          y: snapToGrid(pdfPos.y),
          width: snapToGrid(width),
          height: snapToGrid(height),
          fontSize: 10,
        }]);
        setSelectedField(id);

      }
    }

    if (isResizing && selectedField) {
      setFields((prev) =>
        prev.map((f) =>
          f.id === selectedField
            ? { ...f, width: snapToGrid(f.width ?? 0), height: snapToGrid(f.height ?? 0) }
            : f
        )
      );
    }

    setIsResizing(false);
    setResizeStartPos(null);
    setResizeStartSize(null);
    setIsDragging(false);
    setDragStartPos(null);
    setDragStartFieldPos(null);
    setIsSelecting(false);
  };

  // フィールド削除
  const deleteField = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
    if (selectedField === id) setSelectedField(null);
  };

  // フィールド更新（部分更新）
  const updateField = (id: string, updates: Partial<FieldDefinition>) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  // キーボードイベント
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedField) return;
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'SELECT' || activeTag === 'TEXTAREA') return;
      if ((document.activeElement as HTMLElement)?.isContentEditable) return;

      const step = e.shiftKey ? 10 : 1;
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
  }, [selectedField, snapEnabled, gridSize, snapToNextGrid]);

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
    a.download = pdfFileName ? pdfFileName.replace(/\.pdf$/i, '') + '.json' : 'pdf_field_mapping.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // JSONインポート
  const importJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (!Array.isArray(data.fields)) {
          alert('JSONにfieldsフィールドがないか、配列ではありません');
          return;
        }
        setFields(
          data.fields.map((f: Omit<FieldDefinition, 'id'>, i: number) => ({
            ...f,
            id: crypto.randomUUID(),
          }))
        );
      } catch (error) {
        alert(`JSONの読み込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
      }
    };
    reader.onerror = () => {
      alert('ファイルの読み込みに失敗しました');
    };
    reader.readAsText(file);
  };

  // エディターリセット（DropZoneに戻る）
  const resetEditor = useCallback(() => {
    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch (error) {
        console.error('Failed to cancel render task:', error);
      }
      renderTaskRef.current = null;
    }
    if (pdfDoc) {
      pdfDoc.destroy();
    }
    setPdfDoc(null);
    setPdfFileName('');
    setFields([]);
    setSelectedField(null);
    setCurrentPageRaw(1);
    setTotalPages(0);
    setPdfDimensions({ width: 0, height: 0 });
    setHoveredField(null);
  }, [pdfDoc]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  return {
    // PDF状態
    pdfDoc,
    currentPage,
    setCurrentPage,
    totalPages,
    scale,
    setScale,
    pdfDimensions,
    isLoading,
    isPdfLoading,
    loadPdf,
    pdfFileName,

    // フィールド状態
    fields,
    setFields,
    selectedField,
    setSelectedField,
    hoveredField,

    // フィールド操作
    deleteField,
    updateField,

    // グリッド
    showGrid,
    setShowGrid,
    gridSize,
    setGridSize,
    snapEnabled,
    setSnapEnabled,

    // マウスイベント
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    isDragging,

    // エクスポート/インポート
    exportJson,
    importJson,

    // リセット
    resetEditor,

    // 座標変換
    pdfToCanvas,
    snapToGrid,
    snapToNextGrid,
  };
}
