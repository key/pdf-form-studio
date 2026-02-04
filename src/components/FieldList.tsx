'use client';

import type { FieldDefinition } from '@/types';

interface FieldListProps {
  fields: FieldDefinition[];
  currentPage: number;
  selectedField: string | null;
  onSelect: (id: string) => void;
  onAddText: () => void;
  onAddCheckbox: () => void;
  onPageChange: (page: number) => void;
}

export function FieldList({
  fields,
  currentPage,
  selectedField,
  onSelect,
  onAddText,
  onAddCheckbox,
  onPageChange,
}: FieldListProps) {
  return (
    <div className="flex h-full flex-col border-l border-bp-border bg-bp-panel">
      {/* ヘッダー */}
      <div className="flex items-center justify-between border-b border-bp-border px-3 py-2">
        <span className="text-sm font-medium">
          フィールド ({fields.length})
        </span>
      </div>

      {/* フィールド一覧 */}
      <div className="flex-1 overflow-y-auto">
        {fields.length === 0 ? (
          <div className="p-4 text-center text-xs text-bp-text/40">
            PDFをクリックしてフィールドを追加
          </div>
        ) : (
          <div className="p-1">
            {fields.map((field) => (
              <button
                key={field.id}
                onClick={() => {
                  onSelect(field.id);
                  if (field.page !== currentPage) onPageChange(field.page);
                }}
                className={`w-full rounded px-2 py-1.5 text-left text-sm transition-colors ${
                  selectedField === field.id
                    ? 'bg-bp-accent/10 text-bp-accent'
                    : 'hover:bg-bp-bg'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-xs opacity-50">
                    {field.type === 'checkbox' ? '☑' : 'T'}
                  </span>
                  <span className="truncate">{field.name}</span>
                </div>
                <div className="font-mono text-[10px] text-bp-text/40 mt-0.5">
                  p{field.page} ({field.x}, {field.y})
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 追加ボタン */}
      <div className="flex gap-1 border-t border-bp-border p-2">
        <button
          onClick={onAddText}
          className="flex-1 rounded border border-bp-border px-2 py-1.5 text-xs hover:bg-bp-bg transition-colors"
        >
          + テキスト
        </button>
        <button
          onClick={onAddCheckbox}
          className="flex-1 rounded border border-bp-border px-2 py-1.5 text-xs hover:bg-bp-bg transition-colors"
        >
          + チェック
        </button>
      </div>
    </div>
  );
}
