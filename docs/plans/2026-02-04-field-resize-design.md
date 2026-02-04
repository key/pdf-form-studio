# フィールドリサイズ機能 設計書

## 概要

既存フィールドのサイズ（width/height）をGUI上でドラッグ操作により変更できるようにする。

## 背景

- フィールドを埋め込んだ後、サイズを変更できない
- サイズを変えるには削除→再作成が必要で、名前を間違えるリスクがある

## 操作仕様

- フィールドを選択すると、右上に **リサイズハンドル（■）** が表示される
- ハンドルをドラッグすると width/height が変化
- **左下座標（x, y）は固定**
- グリッドスナップが有効な場合、サイズもグリッド単位にスナップ

```
        ■ ← 右上ハンドル（ドラッグでリサイズ）
    ┌───┐
    │   │  height ↑
    │   │
    └───┘
    ↑
  左下 (x, y) 固定

    width →
```

## 対象フィールド

- **テキストフィールド**: width/height 両方を変更可能
- **チェックボックス**: 固定サイズ（リサイズ非対応）

## 実装詳細

### 状態管理

```typescript
// 新規追加するstate
const [isResizing, setIsResizing] = useState(false);
const [resizeStartPos, setResizeStartPos] = useState<{ x: number; y: number } | null>(null);
const [resizeStartSize, setResizeStartSize] = useState<{ width: number; height: number } | null>(null);
```

### ハンドル判定関数

```typescript
const isOnResizeHandle = (canvasX: number, canvasY: number, field: FieldDefinition): boolean => {
  if (field.type !== 'text' || !field.width || !field.height) return false;

  const fieldCanvas = pdfToCanvas(field.x, field.y);
  const handleX = fieldCanvas.x + field.width * scale;
  const handleY = fieldCanvas.y - field.height * scale;
  const threshold = 10;

  return Math.abs(canvasX - handleX) < threshold && Math.abs(canvasY - handleY) < threshold;
};
```

### ハンドル描画（drawFieldMarkers関数に追加）

```typescript
// 選択中のテキストフィールドに右上ハンドルを描画
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
```

### handleMouseDown の変更

```typescript
const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
  // ... 既存のcanvas座標取得処理 ...

  // 選択中フィールドのリサイズハンドルをチェック
  if (selectedField) {
    const field = fields.find(f => f.id === selectedField);
    if (field && isOnResizeHandle(canvasX, canvasY, field)) {
      setIsResizing(true);
      setResizeStartPos({ x: canvasX, y: canvasY });
      setResizeStartSize({ width: field.width!, height: field.height! });
      return; // 他の処理をスキップ
    }
  }

  // ... 既存のフィールド選択・矩形選択処理 ...
};
```

### handleMouseMove の変更

```typescript
const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
  // ... 既存のcanvas座標取得処理 ...

  if (isResizing && selectedField && resizeStartPos && resizeStartSize) {
    // リサイズ中
    const dx = (canvasX - resizeStartPos.x) / scale;
    const dy = -(canvasY - resizeStartPos.y) / scale; // Y軸反転

    const newWidth = Math.max(10, resizeStartSize.width + dx);
    const newHeight = Math.max(10, resizeStartSize.height + dy);

    setFields(prev => prev.map(f =>
      f.id === selectedField
        ? { ...f, width: Math.round(newWidth), height: Math.round(newHeight) }
        : f
    ));
  } else if (isDragging && ...) {
    // ... 既存のドラッグ処理 ...
  }

  // カーソル変更（ハンドル上でリサイズカーソル表示）
  if (selectedField) {
    const field = fields.find(f => f.id === selectedField);
    if (field && isOnResizeHandle(canvasX, canvasY, field)) {
      overlayRef.current!.style.cursor = 'nesw-resize';
      return;
    }
  }
};
```

### handleMouseUp の変更

```typescript
const handleMouseUp = () => {
  // リサイズ終了時にグリッドスナップ適用
  if (isResizing && selectedField) {
    setFields(prev => prev.map(f =>
      f.id === selectedField
        ? { ...f, width: snapToGrid(f.width!), height: snapToGrid(f.height!) }
        : f
    ));
  }

  setIsResizing(false);
  setResizeStartPos(null);
  setResizeStartSize(null);

  // ... 既存の処理 ...
};
```

## 実装ステップ

1. 状態追加: `isResizing`, `resizeStartPos`, `resizeStartSize`
2. ハンドル判定関数: `isOnResizeHandle()` を追加
3. ハンドル描画: `drawFieldMarkers()` に右上ハンドル描画を追加
4. マウスイベント更新:
   - `handleMouseDown`: リサイズ開始判定
   - `handleMouseMove`: リサイズ中のサイズ更新 + カーソル変更
   - `handleMouseUp`: グリッドスナップ適用
5. 動作確認: テキストフィールドのリサイズ、スナップ動作
