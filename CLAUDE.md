# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

PDF上のフィールド座標をGUIでマッピングする開発ツール。PDFを表示し、クリックやドラッグでテキストフィールドやチェックボックスの座標を定義、JSONとしてエクスポートできる。

## 開発コマンド

```bash
pnpm install        # 依存関係インストール（postinstallでPDF.js workerをpublic/にコピー）
pnpm dev            # 開発サーバー起動 (http://localhost:3000)
pnpm build          # 本番ビルド
pnpm lint           # ESLint実行
pnpm test:e2e       # E2Eテスト実行（Playwright）
pnpm test:e2e:ui    # E2Eテスト（UI付き）
pnpm test:e2e:headed # E2Eテスト（ブラウザ表示付き）
pnpm knip            # 未使用コード・依存関係の検出
```

## 技術スタック

- Next.js 16 (App Router)
- React 19 + TypeScript
- Tailwind CSS
- pdfjs-dist 5.4.624（PDF.js）

### 依存関係の注意点

- **pdfjs-dist**: v5系。`pdf.mjs`（非minified）は内部にwebpack bootstrapコードを含み、Next.jsのwebpackと衝突するため、`pdfjs-dist/build/pdf.min.mjs`からインポートすること
- **next dev**: `--webpack`フラグ必須（Turbopackとの互換性問題回避）

## アーキテクチャ

### コンポーネント構成

`src/app/page.tsx` をオーケストレータとし、以下のコンポーネントに分割:

- `DropZone` — PDFファイルのドラッグ&ドロップ/選択
- `EditorHeader` — ヘッダー（ファイル名、エクスポート/インポート、グリッド・スナップ・ズーム設定）
- `FieldPopover` — フィールド編集ポップオーバー（名前変更、タイプ切替、削除）
- `FieldList` — 右パネルのフィールド一覧
- `ViewControls` — ページ送りコントロール
- `usePdfEditor` — PDF描画・フィールド管理・マウス操作のカスタムフック

### PDF.js統合

- PDF.jsは動的インポートで読み込み（SSR回避）
- workerは`public/pdf.worker.min.mjs`を使用（postinstallでnode_modulesからコピー）
- `next.config.ts`でcanvasモジュールを無効化（Node.js環境向けの依存を除外）

### 座標系

- PDF座標系: 左下が原点 (0, 0)、Y軸は上方向が正
- Canvas座標系: 左上が原点、Y軸は下方向が正
- 変換ヘルパー関数: `canvasToPdf()`, `pdfToCanvas()`

### フィールド管理

`FieldDefinition`型でフィールドを管理:
- 位置 (x, y) はPDF座標系
- テキストフィールドには width/height/fontSize/align/valign
- チェックボックスは位置のみ

## パスエイリアス

`@/*` → `./src/*`

## CI確認ガイドライン

PR/issueのCI Checksを確認する際は、成否の報告だけでなく、失敗しているジョブがあればログ・詳細を自律的に調査し、原因まで報告すること（ユーザーへの確認は不要）。

## UI設計ガイドライン

UIの新規作成・更新時は、実装前にASCII ARTでレイアウトイメージを共有し、認識を合わせること。

```
例:
┌──────────────────────────────────────────────────┐
│ ヘッダー                        [ボタン]           │
├────────────────────────┬─────────────────────────┤
│                        │                         │
│     メインエリア         │   サイドパネル            │
│                        │                         │
└────────────────────────┴─────────────────────────┘
```
