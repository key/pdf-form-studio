'use client';

import { useCallback, useState } from 'react';

interface DropZoneProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
}

export function DropZone({ onFileSelect, isLoading }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const isPdfFile = (file: File): boolean => {
    if (file.type === 'application/pdf') return true;
    return file.name.toLowerCase().endsWith('.pdf');
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (!file) return;
      if (isPdfFile(file)) {
        onFileSelect(file);
      } else {
        alert('PDFファイルを選択してください');
      }
    },
    [onFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (isPdfFile(file)) {
        onFileSelect(file);
      } else {
        alert('PDFファイルを選択してください');
      }
    },
    [onFileSelect]
  );

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bp-bg">
        <p className="text-bp-text">読み込み中...</p>
      </div>
    );
  }

  return (
    <div
      className={`flex min-h-screen items-center justify-center bg-bp-bg p-8 transition-colors ${
        isDragOver ? 'bg-bp-grid/30' : ''
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      data-testid="dropzone"
    >
      <label
        className={`flex h-80 w-full max-w-2xl cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-colors ${
          isDragOver
            ? 'border-bp-accent bg-bp-accent/5'
            : 'border-bp-border bg-bp-panel hover:border-bp-accent/50'
        }`}
      >
        <div className="text-6xl mb-4 opacity-40">📄</div>
        <p className="text-lg font-medium text-bp-text mb-2">PDFをドロップ</p>
        <p className="text-sm text-bp-text/60">または クリックして選択</p>
        <input
          type="file"
          accept=".pdf"
          onChange={handleFileInput}
          className="hidden"
          data-testid="pdf-file-input"
        />
      </label>
    </div>
  );
}
