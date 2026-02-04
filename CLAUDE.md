# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

PDF上のフィールド座標をGUIでマッピングする開発ツール。PDFを表示し、クリックやドラッグでテキストフィールドやチェックボックスの座標を定義、JSONとしてエクスポートできる。

## 開発コマンド

```bash
pnpm install  # 依存関係インストール（postinstallでPDF.js workerをpublic/にコピー）
pnpm dev      # 開発サーバー起動 (http://localhost:3000)
pnpm build    # 本番ビルド
pnpm lint     # ESLint実行
```

## 技術スタック

- Next.js 16 (App Router)
- React 18 + TypeScript
- Tailwind CSS
- pdfjs-dist 4.9.155（PDF.js）

### 依存関係の注意点

- **pdfjs-dist**: v4.9.155に固定。v5系はNext.js 16との互換性問題があるため使用不可
- **next dev**: `--webpack`フラグ必須（Turbopackとの互換性問題回避）

## アーキテクチャ

### シングルページ構成

`src/app/page.tsx` に全ての機能が集約されたシンプルな構成。

### PDF.js統合

- PDF.jsは動的インポートで読み込み（SSR回避）
- workerは`public/pdf.worker.min.mjs`を使用（postinstallでnode_modulesからコピー）
- `next.config.js`でcanvasモジュールを無効化（Node.js環境向けの依存を除外）

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

## UI設計ガイドライン

UIの新規作成・更新時は、実装前にASCII artでレイアウトイメージを共有し、認識を合わせること。

```
例:
┌──────────────────────────────────────────────────┐
│ ヘッダー                        [ボタン]         │
├────────────────────────┬─────────────────────────┤
│                        │                         │
│     メインエリア       │   サイドパネル          │
│                        │                         │
└────────────────────────┴─────────────────────────┘
```
