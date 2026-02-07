import { expect, test } from '@playwright/test';
import { PdfEditorPage } from './helpers/pdf-editor.page';

test.describe('ページナビゲーション', () => {
  let editor: PdfEditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new PdfEditorPage(page);
    await editor.goto();
  });

  test('マルチページPDFでページ送りができる', async () => {
    await editor.uploadAndWait('multi-page');

    await expect(editor.pageIndicator).toHaveText('1/3');

    // 次ページ
    await editor.nextPageButton.click();
    await expect(editor.pageIndicator).toHaveText('2/3');

    // さらに次ページ
    await editor.nextPageButton.click();
    await expect(editor.pageIndicator).toHaveText('3/3');

    // 前ページ
    await editor.prevPageButton.click();
    await expect(editor.pageIndicator).toHaveText('2/3');
  });

  test('最初のページで前ボタンが無効', async () => {
    await editor.uploadAndWait('multi-page');
    await expect(editor.prevPageButton).toBeDisabled();
  });

  test('最後のページで次ボタンが無効', async () => {
    await editor.uploadAndWait('multi-page');

    // 最後のページまで移動
    await editor.nextPageButton.click();
    await editor.nextPageButton.click();
    await expect(editor.pageIndicator).toHaveText('3/3');
    await expect(editor.nextPageButton).toBeDisabled();
  });

  test('1ページPDFではページコントロールが非表示', async () => {
    await editor.uploadAndWait('simple');
    await expect(editor.prevPageButton).not.toBeVisible();
    await expect(editor.nextPageButton).not.toBeVisible();
    await expect(editor.pageIndicator).not.toBeVisible();
  });
});
