'use client';

import { useEffect, useState, useRef } from 'react';
import type { FieldDefinition } from '@/types';

interface FieldPopoverProps {
  field: FieldDefinition;
  position: { x: number; y: number };
  onUpdate: (id: string, updates: Partial<FieldDefinition>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function FieldPopover({ field, position, onUpdate, onDelete, onClose }: FieldPopoverProps) {
  const [name, setName] = useState(field.name);
  const popoverRef = useRef<HTMLDivElement>(null);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setName(newName);
    if (newName.trim()) {
      onUpdate(field.id, { name: newName.trim() });
    }
  };

  // 外側クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handleTypeChange = (type: 'text' | 'checkbox') => {
    if (type === field.type) return;
    const updates: Partial<FieldDefinition> = { type };
    if (type === 'text') {
      updates.width = 50;
      updates.height = 20;
    } else {
      updates.width = undefined;
      updates.height = undefined;
    }
    onUpdate(field.id, updates);
  };

  return (
    <div
      ref={popoverRef}
      className="absolute z-30 w-56 rounded-lg border border-bp-border bg-bp-panel p-3 shadow-lg"
      data-testid="field-popover"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <input
        type="text"
        value={name}
        onChange={handleNameChange}
        className="mb-2 w-full rounded border border-bp-border px-2 py-1 text-sm focus:border-bp-accent focus:outline-none"
        placeholder="フィールド名"
        data-testid="field-name-input"
      />
      <div className="mb-3 flex gap-3">
        <label className="flex items-center gap-1 text-xs cursor-pointer">
          <input
            type="radio"
            name={`field-type-${field.id}`}
            checked={field.type === 'text'}
            onChange={() => handleTypeChange('text')}
            className="h-3 w-3"
            data-testid="field-type-text"
          />
          テキスト
        </label>
        <label className="flex items-center gap-1 text-xs cursor-pointer">
          <input
            type="radio"
            name={`field-type-${field.id}`}
            checked={field.type === 'checkbox'}
            onChange={() => handleTypeChange('checkbox')}
            className="h-3 w-3"
            data-testid="field-type-checkbox"
          />
          チェック
        </label>
      </div>
      {field.type === 'text' && (
        <div className="mb-3 flex gap-1">
          {(['left', 'center', 'right'] as const).map((a) => (
            <button
              key={a}
              onClick={() => onUpdate(field.id, { align: a })}
              className={`flex-1 rounded px-1.5 py-0.5 text-[10px] transition-colors ${
                (field.align ?? 'left') === a
                  ? 'bg-bp-accent text-white'
                  : 'bg-bp-bg hover:bg-bp-border'
              }`}
            >
              {a === 'left' ? '左' : a === 'center' ? '中央' : '右'}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => {
          onDelete(field.id);
          onClose();
        }}
        className="w-full rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 transition-colors"
        data-testid="delete-field-button"
      >
        削除
      </button>
    </div>
  );
}
