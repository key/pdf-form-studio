'use client';

import type { FieldDefinition } from '@/types';

interface FieldListProps {
  fields: FieldDefinition[];
  currentPage: number;
  selectedField: string | null;
  onSelect: (id: string) => void;
  onPageChange: (page: number) => void;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function FieldList({
  fields,
  currentPage,
  selectedField,
  onSelect,
  onPageChange,
  onExport,
  onImport,
}: FieldListProps) {
  return (
    <div className="flex h-full flex-col border-l border-bp-border bg-bp-panel" data-testid="field-list">
      {/* ヘッダー */}
      <div className="flex items-center justify-between border-b border-bp-border px-3 py-2">
        <span className="text-sm font-medium">
          フィールド ({fields.length})
        </span>
      </div>

      {/* フィールド一覧 */}
      <div className="flex-1 overflow-y-auto">
        {fields.length === 0 ? (
          <div className="p-4 text-xs text-bp-text/40 leading-relaxed">
            <p className="mb-2 text-bp-text/60 font-medium">フィールドの作成方法</p>
            <ul className="list-none space-y-1.5">
              <li>クリック → テキストフィールド作成</li>
              <li>ドラッグ → 矩形サイズで作成</li>
              <li>ポップオーバーでタイプ変更・削除</li>
            </ul>
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

      {/* マッピングデータ */}
      <div className="border-t border-bp-border p-3">
        <div className="mb-2 text-xs font-medium text-bp-text/60">
          マッピングデータ
        </div>
        <div className="flex gap-2">
          <label className="flex-1 cursor-pointer rounded border border-bp-border px-2 py-1.5 text-center text-xs transition-colors hover:bg-bp-bg">
            インポート
            <input
              type="file"
              accept=".json"
              onChange={onImport}
              className="hidden"
              data-testid="import-json-input"
            />
          </label>
          <button
            onClick={onExport}
            className="flex-1 rounded border border-bp-border px-2 py-1.5 text-xs transition-colors hover:bg-bp-bg"
            data-testid="export-json-button"
          >
            エクスポート
          </button>
        </div>
      </div>

    </div>
  );
}
