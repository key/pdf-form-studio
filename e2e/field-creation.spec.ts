import { expect, test } from '@playwright/test';
import { PdfEditorPage } from './helpers/pdf-editor.page';

test.describe('フィールド作成', () => {
  let editor: PdfEditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new PdfEditorPage(page);
    await editor.goto();
    await editor.uploadAndWait('simple');
  });

  test('クリックでテキストフィールドが作成される', async () => {
    await editor.clickOnCanvas(200, 300);
    await expect(editor.fieldPopover).toBeVisible();
    // テキストタイプがデフォルトで選択されている
    await expect(editor.fieldTypeText).toBeChecked();
  });

  test('ドラッグで矩形フィールドが作成される', async () => {
    await editor.dragOnCanvas({ x: 150, y: 200 }, { x: 350, y: 240 });
    await expect(editor.fieldPopover).toBeVisible();
  });

  test('複数フィールドを作成できる', async () => {
    // 1つ目のフィールドを作成
    await editor.clickOnCanvas(200, 200);
    await expect(editor.fieldPopover).toBeVisible();
    await editor.closePopover();

    // 2つ目のフィールドを作成
    await editor.clickOnCanvas(200, 350);
    await expect(editor.fieldPopover).toBeVisible();
    await editor.closePopover();

    // 3つ目のフィールドを作成
    await editor.clickOnCanvas(200, 500);
    await expect(editor.fieldPopover).toBeVisible();
    await editor.closePopover();

    // フィールド一覧に3つ表示される
    // FieldListのボタンには「フィールドの作成方法」のテキストがなくなり、フィールドアイテムが表示される
    const items = editor.fieldList.locator('button').filter({ hasText: /field_/ });
    await expect(items).toHaveCount(3);
  });
});
