import { expect, test } from '@playwright/test';
import { PdfEditorPage } from './helpers/pdf-editor.page';

test.describe('グリッド・ズームコントロール', () => {
  let editor: PdfEditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new PdfEditorPage(page);
    await editor.goto();
    await editor.uploadAndWait('simple');
  });

  test('グリッドボタンでポップオーバーが開閉する', async () => {
    await editor.gridButton.click();

    // ポップオーバー内の要素が見える
    await expect(editor.page.getByText('グリッド表示')).toBeVisible();
    await expect(editor.page.getByText('スナップ')).toBeVisible();

    // 背景オーバーレイをクリックしてポップオーバーを閉じる
    await editor.page.getByTestId('grid-popover-overlay').click({ position: { x: 5, y: 5 } });
    await expect(editor.page.getByText('スナップ')).not.toBeVisible();
  });

  test('グリッド表示を切り替えられる', async () => {
    await editor.gridButton.click();
    const gridCheckbox = editor.page.getByLabel('グリッド表示');

    // 初期状態: ON（usePdfEditorのデフォルト）
    await expect(gridCheckbox).toBeChecked();

    await gridCheckbox.click();
    await expect(gridCheckbox).not.toBeChecked();

    await gridCheckbox.click();
    await expect(gridCheckbox).toBeChecked();
  });

  test('スナップを切り替えられる', async () => {
    await editor.gridButton.click();
    const snapCheckbox = editor.page.getByLabel('スナップ');

    // 初期状態: ON（usePdfEditorのデフォルト）
    await expect(snapCheckbox).toBeChecked();

    await snapCheckbox.click();
    await expect(snapCheckbox).not.toBeChecked();

    await snapCheckbox.click();
    await expect(snapCheckbox).toBeChecked();
  });

  test('ズームレベルを変更できる', async () => {
    // 初期値は1.5（usePdfEditorのデフォルト）
    await expect(editor.zoomSelect).toHaveValue('1.5');

    await editor.zoomSelect.selectOption('2');
    await expect(editor.zoomSelect).toHaveValue('2');

    await editor.zoomSelect.selectOption('1');
    await expect(editor.zoomSelect).toHaveValue('1');
  });
});
