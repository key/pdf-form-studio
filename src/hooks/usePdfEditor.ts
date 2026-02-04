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
  const [gridSize, setGridSize] = useState(7.5);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
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
  }, [pdfjsLib]);

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
      const next = currentValue === currentGrid ? currentGrid - gridSize : currentGrid;
      return Math.max(0, next);
    }
  };

  // フィールドがクリック位置の近くにあるかチェック
  const findFieldAtPosition = (canvasX: number, canvasY: number): FieldDefinition | null => {
    for (const field of fields.filter((f) => f.page === currentPage)) {
      const fieldCanvas = pdfToCanvas(field.x, field.y);

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

  // グリッド描画
  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number, scale: number, pdfHeight: number) => {
    ctx.strokeStyle = 'rgba(180, 180, 180, 0.4)';
    ctx.lineWidth = 1;
    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(120, 120, 120, 0.6)';

    for (let pdfX = 0; pdfX <= pdfHeight; pdfX += gridSize) {
      const canvasX = pdfX * scale;
      if (canvasX > width) break;
      ctx.beginPath();
      ctx.moveTo(canvasX, 0);
      ctx.lineTo(canvasX, height);
      ctx.stroke();
      ctx.fillText(`${pdfX}`, canvasX + 2, 12);
    }
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
        const canvasY = (pdfHeight - field.y) * scale;

        const isSelected = field.id === selectedField;
        const isHovered = field.id === hoveredField;
        const markerSize = isSelected ? 8 : isHovered ? 7 : 6;

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

        ctx.strokeStyle = isSelected ? '#22c55e' : isHovered ? '#f59e0b' : '#3b82f6';
        ctx.lineWidth = isSelected ? 2 : 1;

        ctx.beginPath();
        ctx.moveTo(canvasX, canvasY - markerSize);
        ctx.lineTo(canvasX, canvasY + markerSize);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(canvasX - markerSize, canvasY);
        ctx.lineTo(canvasX + markerSize, canvasY);
        ctx.stroke();

        if (field.type === 'checkbox') {
          ctx.strokeRect(canvasX - 6, canvasY - 6, 12, 12);
        }

        if (isSelected && field.type === 'text' && field.width && field.height) {
          const handleX = canvasX + field.width * scale;
          const handleY = canvasY - field.height * scale;
          const handleSize = 8;

          ctx.fillStyle = '#22c55e';
          ctx.fillRect(
            handleX - handleSize / 2,
            handleY - handleSize / 2,
            handleSize,
            handleSize
          );
        }

        ctx.font = '11px sans-serif';
        const textWidth = ctx.measureText(field.name).width;
        ctx.fillStyle = isSelected ? 'rgba(34, 197, 94, 0.9)' : isHovered ? 'rgba(245, 158, 11, 0.9)' : 'rgba(59, 130, 246, 0.9)';
        ctx.fillRect(canvasX + 4, canvasY - 16, textWidth + 6, 14);
        ctx.fillStyle = '#fff';
        ctx.fillText(field.name, canvasX + 7, canvasY - 5);
      });
  };

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
        drawGrid(context, viewport.width, viewport.height, scale, originalViewport.height);
      }

      drawFieldMarkers(context, scale, originalViewport.height);

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

        context.fillStyle = '#ef4444';
        context.beginPath();
        context.arc(left, bottom, 5, 0, Math.PI * 2);
        context.fill();
      }

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
  }, [pdfDoc, currentPage, scale, showGrid, gridSize, fields, selectedField, hoveredField, clickedPosition, isSelecting]);

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
  }, [isSelecting, selectionStart, selectionEnd, scale, snapEnabled, gridSize, pdfDimensions]);

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
        setResizeStartSize({ width: field.width!, height: field.height! });
        return;
      }
    }

    const clickedField = findFieldAtPosition(canvasX, canvasY);
    if (clickedField) {
      setSelectedField(clickedField.id);
      setIsDragging(true);
      setDragStartPos({ x: canvasX, y: canvasY });
      setClickedPosition(null);
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
    } else if (isDragging && selectedField && dragStartPos) {
      const dx = (canvasX - dragStartPos.x) / scale;
      const dy = -(canvasY - dragStartPos.y) / scale;

      setFields((prev) =>
        prev.map((f) =>
          f.id === selectedField ? { ...f, x: Math.round(f.x + dx), y: Math.round(f.y + dy) } : f
        )
      );
      setDragStartPos({ x: canvasX, y: canvasY });
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
        const pdfPos = canvasToPdf(selectionStart.x, selectionStart.y);
        setClickedPosition({ x: snapToGrid(pdfPos.x), y: snapToGrid(pdfPos.y) });
      } else {
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

    if (isResizing && selectedField) {
      setFields((prev) =>
        prev.map((f) =>
          f.id === selectedField
            ? { ...f, width: snapToGrid(f.width!), height: snapToGrid(f.height!) }
            : f
        )
      );
    }

    if (isDragging && selectedField) {
      setFields((prev) =>
        prev.map((f) =>
          f.id === selectedField ? { ...f, x: snapToGrid(f.x), y: snapToGrid(f.y) } : f
        )
      );
    }

    setIsResizing(false);
    setResizeStartPos(null);
    setResizeStartSize(null);
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

  // フィールド更新（部分更新）
  const updateField = (id: string, updates: Partial<FieldDefinition>) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  // フィールドをPDF中央に追加
  const addFieldAtCenter = (type: 'text' | 'checkbox') => {
    const centerX = Math.round(pdfDimensions.width / 2);
    const centerY = Math.round(pdfDimensions.height / 2);
    const newField: FieldDefinition = {
      id: `field_${Date.now()}`,
      name: `field_${fields.length + 1}`,
      type,
      page: currentPage,
      x: snapToGrid(centerX),
      y: snapToGrid(centerY),
      width: type === 'text' ? 200 : undefined,
      height: type === 'text' ? 20 : undefined,
      fontSize: type === 'text' ? 10 : undefined,
    };
    setFields((prev) => [...prev, newField]);
    setSelectedField(newField.id);
  };

  // キーボードイベント
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedField) return;
      if (document.activeElement?.tagName === 'INPUT') return;

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
    clickedPosition,
    setClickedPosition,

    // フィールド操作
    addField,
    deleteField,
    updateField,
    addFieldAtCenter,
    setFieldPosition,
    updateFieldPosition,

    // 新規フィールドフォーム
    newFieldName,
    setNewFieldName,
    newFieldType,
    setNewFieldType,

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

    // 座標変換
    pdfToCanvas,
    snapToGrid,
    snapToNextGrid,
  };
}
