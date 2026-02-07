# PDF座標エディタ

PDF上のフィールド座標をGUIでマッピングするための開発ツール。PDFを表示し、クリックやドラッグでテキストフィールドやチェックボックスの座標を定義し、JSONエクスポートやAcroForm付きPDFの生成ができる。

## クイックスタート

```bash
pnpm install
pnpm dev
```

ブラウザで http://localhost:3000 にアクセス。

## 機能

- PDFファイルの読み込み・表示（ドラッグ&ドロップ対応）
- 複数ページPDFのサポート（ページ送りナビゲーション）
- クリックで座標取得、ドラッグで矩形フィールド作成
- テキストフィールド / チェックボックスの切り替え
- フィールドのドラッグ移動・リサイズ（右上ハンドル）
- 矢印キーでグリッド単位の移動（Shift+矢印で1pt微調整）
- アライメント設定（左/中央/右）
- グリッド表示・スナップ（5 / 7.5 / 10 / 25 / 50 pt）
- ズーム（100% / 150% / 200%）
- JSONエクスポート/インポート
- AcroForm付きPDFのエクスポート（pdf-lib使用）
- AIによるフォームフィールド自動検出（Claude Vision API）

## 操作方法

| 操作 | 説明 |
|------|------|
| クリック | フィールドを作成（デフォルトサイズ） |
| ドラッグ | 矩形選択でフィールド作成（寸法表示あり） |
| マーカーをドラッグ | フィールドを移動 |
| 右上ハンドルをドラッグ | テキストフィールドをリサイズ |
| 矢印キー | グリッド単位で移動 |
| Shift+矢印キー | 1pt移動（微調整） |
| Delete / Backspace | 選択フィールドを削除 |

## AI検出

環境変数 `ANTHROPIC_API_KEY` を設定すると、Claude Vision APIを使ってPDF上のフォームフィールドを自動検出できる。エディタヘッダーの「AI検出」ボタンから実行する。

```bash
# .env.local に設定
ANTHROPIC_API_KEY=sk-ant-...
```

## 出力形式

### JSONエクスポート

```json
{
  "fields": [
    {
      "name": "field_name",
      "type": "text",
      "page": 1,
      "x": 100,
      "y": 200,
      "width": 150,
      "height": 30,
      "fontSize": 10,
      "align": "center"
    }
  ],
  "pdfDimensions": {
    "width": 595.2756,
    "height": 841.8898
  },
  "exportedAt": "2026-02-07T00:00:00.000Z"
}
```

### Form PDFエクスポート

読み込んだPDFにAcroFormフィールドを埋め込んだPDFを生成。フィールド名の重複や未設定がある場合はバリデーションエラーを表示する。

## 座標系について

- PDF座標系: 左下が原点 (0, 0)、Y軸は上方向が正
- Canvas座標系: 左上が原点、Y軸は下方向が正
- A4サイズ: 595.28 x 841.89 ポイント

## 技術スタック

- [Next.js](https://nextjs.org/) 16 (App Router)
- [React](https://react.dev/) 19 + TypeScript
- [Tailwind CSS](https://tailwindcss.com/) 4
- [pdfjs-dist](https://mozilla.github.io/pdf.js/) 4.9.155 — PDF描画
- [pdf-lib](https://pdf-lib.js.org/) — AcroForm付きPDF生成
- [Playwright](https://playwright.dev/) — E2Eテスト

## 開発コマンド

```bash
pnpm install         # 依存関係インストール（postinstallでPDF.js workerをpublic/にコピー）
pnpm dev             # 開発サーバー起動（--webpackフラグ付き）
pnpm build           # 本番ビルド（--webpackフラグ付き）
pnpm lint            # ESLint実行
pnpm test:e2e        # E2Eテスト実行（Playwright, Chromium）
pnpm test:e2e:ui     # E2Eテスト（UI付き）
pnpm test:e2e:headed # E2Eテスト（ブラウザ表示付き）
pnpm knip            # 未使用コード・依存関係の検出
```

> **Note:** pdfjs-distはv4.9.155に固定。v5系はNext.js 16との互換性問題あり。devとbuildには`--webpack`フラグが必須（Turbopackとの互換性問題回避）。

## CI

GitHub Actionsで以下のジョブが実行される:

- **yamllint** — YAML設定ファイルの構文チェック
- **build** — DevContainer上でlintとビルドを実行
- **e2e** — Playwright E2Eテスト（buildジョブ通過後に実行）

## DevContainer

VS Code Dev Containersに対応。`.devcontainer/` に設定ファイルがある。

```bash
# VS Codeで「Reopen in Container」を選択するか、CLIで起動
devcontainer up --workspace-folder .
```

## ライセンス

MIT
