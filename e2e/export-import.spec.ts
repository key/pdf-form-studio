import { expect, test } from '@playwright/test';
import { PdfEditorPage } from './helpers/pdf-editor.page';

test.describe('エクスポート・インポート', () => {
  let editor: PdfEditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new PdfEditorPage(page);
    await editor.goto();
    await editor.uploadAndWait('simple');
  });

  test('JSONエクスポートでダウンロードされる', async () => {
    // フィールドを作成
    await editor.clickOnCanvas(200, 300);
    await editor.closePopover();

    // ダウンロードイベントを待ち受け
    const downloadPromise = editor.page.waitForEvent('download');
    await editor.exportJsonButton.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.json$/);
  });

  test('JSONインポートでフィールドが復元される', async () => {
    // テスト用JSONデータを作成（importJsonは { fields: [...] } 形式を期待する）
    const fieldData = {
      fields: [
        {
          name: 'imported_field',
          type: 'text',
          page: 1,
          x: 100,
          y: 500,
          width: 200,
          height: 20,
          fontSize: 12,
        },
      ],
    };
    const jsonBuffer = Buffer.from(JSON.stringify(fieldData));

    await editor.importJsonInput.setInputFiles({
      name: 'fields.json',
      mimeType: 'application/json',
      buffer: jsonBuffer,
    });

    // フィールドが一覧に表示される
    const item = editor.fieldList.locator('button').filter({ hasText: 'imported_field' });
    await expect(item).toBeVisible();
  });

  test('フォームPDF出力でダウンロードされる', async () => {
    // フィールドを作成
    await editor.clickOnCanvas(200, 300);
    await editor.closePopover();

    // ダウンロードイベントを待ち受け
    const downloadPromise = editor.page.waitForEvent('download');
    await editor.exportFormPdfButton.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  });

  test('フィールドなしではフォームPDFボタンが無効', async () => {
    await expect(editor.exportFormPdfButton).toBeDisabled();
  });
});
