import { expect, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { PdfEditorPage } from './helpers/pdf-editor.page';

test.describe('エクスポート・インポート', () => {
  let editor: PdfEditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new PdfEditorPage(page);
    await editor.goto();
    await editor.uploadAndWait('simple');
  });

  test('JSONエクスポートでダウンロードされる', async () => {
    await editor.clickOnCanvas(200, 300);
    await editor.closePopover();

    const downloadPromise = editor.page.waitForEvent('download');
    await editor.exportJsonButton.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.json$/);
  });

  test('JSONエクスポートの内容にフィールド情報が含まれる', async () => {
    await editor.clickOnCanvas(200, 300);
    await editor.fieldNameInput.fill('test_name');
    await editor.closePopover();

    const downloadPromise = editor.page.waitForEvent('download');
    await editor.exportJsonButton.click();
    const download = await downloadPromise;

    const buf = await editor.readDownloadBuffer(download);
    const json = JSON.parse(buf.toString('utf-8'));

    expect(json).toHaveProperty('fields');
    expect(json).toHaveProperty('pdfDimensions');
    expect(json).toHaveProperty('exportedAt');
    expect(json.fields).toHaveLength(1);
    expect(json.fields[0]).toMatchObject({
      name: 'test_name',
      type: 'text',
      page: 1,
    });
    expect(typeof json.fields[0].x).toBe('number');
    expect(typeof json.fields[0].y).toBe('number');
  });

  test('JSONインポートでフィールドが復元される', async () => {
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

    const item = editor.fieldList.locator('button').filter({ hasText: 'imported_field' });
    await expect(item).toBeVisible();
  });

  test('不正なJSONインポートでアプリがクラッシュしない', async ({ page }) => {
    // fieldsプロパティがないJSON → alertが出るが、アプリは壊れない
    let dialogMessage = '';
    page.on('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.dismiss();
    });

    const invalidData = { noFields: true };
    const jsonBuffer = Buffer.from(JSON.stringify(invalidData));

    await editor.importJsonInput.setInputFiles({
      name: 'invalid.json',
      mimeType: 'application/json',
      buffer: jsonBuffer,
    });

    // alertが発火すること
    await expect(() => expect(dialogMessage).toBeTruthy()).toPass({ timeout: 5000 });

    // アプリが正常に動作し続ける（DropZoneに戻ったりしない）
    await expect(editor.overlayCanvas).toBeVisible();
    // 新しいフィールドが作成できる
    await editor.clickOnCanvas(200, 300);
    await expect(editor.fieldPopover).toBeVisible();
  });

  test('フォームPDF出力でダウンロードされる', async () => {
    await editor.clickOnCanvas(200, 300);
    await editor.closePopover();

    const downloadPromise = editor.page.waitForEvent('download');
    await editor.exportFormPdfButton.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  });

  test('フォームPDF出力にAcroFormフィールドが含まれる', async () => {
    await editor.clickOnCanvas(200, 300);
    await editor.fieldNameInput.fill('form_text');
    await editor.closePopover();

    await editor.clickOnCanvas(200, 400);
    await editor.fieldTypeCheckbox.click();
    await editor.fieldNameInput.fill('form_check');
    await editor.closePopover();

    const downloadPromise = editor.page.waitForEvent('download');
    await editor.exportFormPdfButton.click();
    const download = await downloadPromise;

    const pdfBytes = await editor.readDownloadBuffer(download);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    const fieldNames = form.getFields().map((f) => f.getName());

    expect(fieldNames).toContain('form_text');
    expect(fieldNames).toContain('form_check');
    expect(fieldNames).toHaveLength(2);
  });

  test('重複名フィールドではフォームPDF出力がブロックされる', async ({ page }) => {
    // 2つのフィールドを同じ名前で作成
    await editor.clickOnCanvas(200, 300);
    await editor.fieldNameInput.fill('duplicate_name');
    await editor.closePopover();

    await editor.clickOnCanvas(200, 400);
    await editor.fieldNameInput.fill('duplicate_name');
    await editor.closePopover();

    // dialogを自動dismissするリスナーを登録しつつメッセージをキャプチャ
    let dialogMessage = '';
    page.on('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.dismiss();
    });

    await editor.exportFormPdfButton.click();

    // alertが発火してバリデーションエラーメッセージを含むこと
    await expect(() => expect(dialogMessage).toContain('重複')).toPass({ timeout: 5000 });

    // ダウンロードが発生しないこと（ボタンは有効のまま）
    await expect(editor.exportFormPdfButton).toBeEnabled();
  });

  test('フィールドなしではフォームPDFボタンが無効', async () => {
    await expect(editor.exportFormPdfButton).toBeDisabled();
  });
});
