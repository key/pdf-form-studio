# 既存PDFへのAcroFormフィールド追加機能 設計書

## 概要

既存PDFに対して、pdf-coordinate-editorで定義した座標情報を元にAcroFormフィールドを追加する機能を実装する。

## 目的

- 任意のPDFにテキストフィールド・チェックボックスを追加できるようにする
- 作成したフォーム付きPDFは、Python側（PyPDFForm）で値入力できる形式で出力する

## 技術選定

| 項目 | 選定 | 理由 |
|-----|-----|-----|
| ライブラリ | pdf-lib | 既存PDF編集 + AcroForm作成が可能な唯一のPure JSライブラリ |
| 実行環境 | ブラウザ | 既存エディタと同じクライアントサイド完結 |
| フォーム形式 | AcroForm | PyPDFFormとの互換性確保 |

### 検討したライブラリ

| ライブラリ | 既存PDF読込 | フォームフィールド作成 | ブラウザ動作 | 評価 |
|-----------|------------|---------------------|------------|-----|
| pdf-lib | OK | OK | OK | 採用 |
| jsPDF | NG | OK（新規のみ） | OK | 不採用 |
| pdfmake | NG | NG | OK | 不採用 |

## スコープ

**含む:**

- テキストフィールドの作成
- チェックボックスの作成
- 座標・サイズの指定
- フォーム付きPDFのダウンロード

**含まない:**

- 値の入力（Python側で実施）
- ドロップダウン、ラジオボタン等（将来拡張）

## アーキテクチャ

### 処理フロー

```
┌─────────────────────────────────────────────────────────────┐
│                  pdf-coordinate-editor                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   [PDF読込]  →  [座標定義]  →  [フォーム生成]  →  [DL]      │
│      ↓            ↓              ↓                          │
│   pdfjs-dist   GUI操作        pdf-lib                       │
│                    ↓              ↓                          │
│              FieldDefinition[]   AcroForm付きPDF             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                                    ↓
                         [Pythonウェブアプリ]
                                    ↓
                              PyPDFForm で値入力
```

### データ構造

現在の `FieldDefinition` をそのまま活用:

```typescript
interface FieldDefinition {
  id: string;
  name: string;           // → AcroFormのフィールド名
  type: 'text' | 'checkbox';
  page: number;
  x: number;              // PDF座標系
  y: number;
  width?: number;         // テキストフィールド用
  height?: number;
  fontSize?: number;
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';
}
```

### 新規追加するモジュール

| ファイル | 役割 |
|---------|-----|
| `src/lib/pdfFormGenerator.ts` | pdf-libでフォーム生成するロジック |

## API設計

### メイン関数

```typescript
// src/lib/pdfFormGenerator.ts

import { PDFDocument } from 'pdf-lib';

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
}

/**
 * 既存PDFにフォームフィールドを追加する
 * @param pdfBytes - 元のPDFバイナリ
 * @param fields - フィールド定義の配列
 * @returns フォーム付きPDFのバイナリ
 */
export async function addFormFields(
  pdfBytes: ArrayBuffer,
  fields: FieldDefinition[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const form = pdfDoc.getForm();
  const pages = pdfDoc.getPages();

  for (const field of fields) {
    const page = pages[field.page - 1]; // 1-indexed → 0-indexed

    if (field.type === 'text') {
      const textField = form.createTextField(field.name);
      textField.addToPage(page, {
        x: field.x,
        y: field.y,
        width: field.width ?? 100,
        height: field.height ?? 20,
      });
    } else if (field.type === 'checkbox') {
      const checkBox = form.createCheckBox(field.name);
      checkBox.addToPage(page, {
        x: field.x,
        y: field.y,
        width: 15,
        height: 15,
      });
    }
  }

  return pdfDoc.save();
}
```

### UI側の呼び出し

```typescript
// page.tsx から呼び出すイメージ

const handleExportWithForm = async () => {
  if (!pdfFile) return;

  const pdfBytes = await pdfFile.arrayBuffer();
  const formPdfBytes = await addFormFields(pdfBytes, fields);

  // ダウンロード
  const blob = new Blob([formPdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  // ... download処理
};
```

## 座標系

pdf-libもPDF標準の座標系（左下原点、Y軸上向き）を使用する。

| ツール | 座標系 | 原点 |
|--------|--------|------|
| pdf-coordinate-editor | PDF座標系 | 左下 |
| pdf-lib | PDF座標系 | 左下 |

→ 変換不要でそのまま使える。

## エラーハンドリング

```typescript
export async function addFormFields(
  pdfBytes: ArrayBuffer,
  fields: FieldDefinition[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const form = pdfDoc.getForm();
  const pages = pdfDoc.getPages();

  for (const field of fields) {
    // ページ番号の検証
    if (field.page < 1 || field.page > pages.length) {
      console.warn(`Invalid page number: ${field.page}, skipping field: ${field.name}`);
      continue;
    }

    // フィールド名の重複チェック（pdf-libは重複でエラーを投げる）
    try {
      const page = pages[field.page - 1];

      if (field.type === 'text') {
        const textField = form.createTextField(field.name);
        textField.addToPage(page, { /* ... */ });
      } else if (field.type === 'checkbox') {
        const checkBox = form.createCheckBox(field.name);
        checkBox.addToPage(page, { /* ... */ });
      }
    } catch (error) {
      console.warn(`Failed to create field: ${field.name}`, error);
      // 重複名などのエラーは警告してスキップ
    }
  }

  return pdfDoc.save();
}
```

### バリデーション

UIで事前にチェックすべき項目:

- フィールド名が空でないこと
- フィールド名が重複していないこと
- ページ番号が有効範囲内であること

## 実装ステップ

1. **依存関係の追加**: `pnpm add pdf-lib`
2. **フォーム生成モジュール作成**: `src/lib/pdfFormGenerator.ts` を新規作成
3. **UIにエクスポートボタン追加**: 「フォーム付きPDFをエクスポート」ボタンを追加
4. **動作確認**: pdf-libで生成したPDFをPyPDFFormで読み込めるか確認

## 参考リンク

- [pdf-lib](https://pdf-lib.js.org/)
- [pdf-lib GitHub](https://github.com/Hopding/pdf-lib)
- [PyPDFForm](https://github.com/chinapandaman/PyPDFForm)
