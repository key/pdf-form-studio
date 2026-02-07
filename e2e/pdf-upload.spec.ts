import { expect, test } from '@playwright/test';
import { PdfEditorPage } from './helpers/pdf-editor.page';

test.describe('PDFアップロード', () => {
  let editor: PdfEditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new PdfEditorPage(page);
    await editor.goto();
  });

  test('DropZoneが表示される', async () => {
    await expect(editor.dropzone).toBeVisible();
  });

  test('PDFアップロードでエディタに遷移する', async () => {
    await editor.uploadAndWait('simple');
    await expect(editor.fileName).toHaveText('simple.pdf');
    await expect(editor.pdfCanvas).toBeVisible();
    await expect(editor.overlayCanvas).toBeVisible();
  });

  test('フィールド0件でPDFを閉じるとDropZoneに戻る', async () => {
    await editor.uploadAndWait('simple');
    await editor.closeButton.click();
    await expect(editor.dropzone).toBeVisible();
  });

  test('フィールドありでPDFを閉じると確認ダイアログが表示される', async () => {
    await editor.uploadAndWait('simple');

    // フィールドを1つ作成
    await editor.clickOnCanvas(200, 200);
    await expect(editor.fieldPopover).toBeVisible();

    // ポップオーバーを閉じる
    await editor.closePopover();

    // 閉じるボタンをクリック
    await editor.closeButton.click();
    await expect(editor.closeConfirmDialog).toBeVisible();
  });

  test('確認ダイアログでキャンセルするとエディタに留まる', async () => {
    await editor.uploadAndWait('simple');
    await editor.clickOnCanvas(200, 200);
    await editor.closePopover();
    await editor.closeButton.click();
    await expect(editor.closeConfirmDialog).toBeVisible();

    await editor.cancelCloseButton.click();
    await expect(editor.closeConfirmDialog).not.toBeVisible();
    await expect(editor.pdfCanvas).toBeVisible();
  });

  test('確認ダイアログで閉じるとDropZoneに戻る', async () => {
    await editor.uploadAndWait('simple');
    await editor.clickOnCanvas(200, 200);
    await editor.closePopover();
    await editor.closeButton.click();

    await editor.confirmCloseButton.click();
    await expect(editor.dropzone).toBeVisible();
  });
});
