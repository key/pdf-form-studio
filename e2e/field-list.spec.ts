import { expect, test } from '@playwright/test';
import { PdfEditorPage } from './helpers/pdf-editor.page';

test.describe('フィールド一覧', () => {
  let editor: PdfEditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new PdfEditorPage(page);
    await editor.goto();
  });

  test('フィールドなしで空状態が表示される', async () => {
    await editor.uploadAndWait('simple');
    await expect(editor.fieldList.getByText('フィールドの作成方法')).toBeVisible();
  });

  test('フィールドが一覧に表示される', async () => {
    await editor.uploadAndWait('simple');
    await editor.clickOnCanvas(200, 200);
    await editor.closePopover();

    const items = editor.fieldList.locator('button').filter({ hasText: /field_/ });
    await expect(items).toHaveCount(1);
  });

  test('一覧のフィールドをクリックするとポップオーバーが表示される', async () => {
    await editor.uploadAndWait('simple');
    await editor.clickOnCanvas(200, 200);
    await editor.closePopover();

    // フィールド一覧のアイテムをクリック
    const item = editor.fieldList.locator('button').filter({ hasText: /field_/ }).first();
    await item.click();
    await expect(editor.fieldPopover).toBeVisible();
  });

  test('マルチページPDFでページ跨ぎの選択ができる', async () => {
    await editor.uploadAndWait('multi-page');

    // 1ページ目にフィールドを作成
    await editor.clickOnCanvas(200, 200);
    await editor.closePopover();

    // 2ページ目に移動してフィールドを作成
    await editor.nextPageButton.click();
    await editor.clickOnCanvas(200, 300);
    await editor.closePopover();

    // 1ページ目に戻る
    await editor.prevPageButton.click();
    await expect(editor.pageIndicator).toHaveText('1/3');

    // 2ページ目のフィールドを一覧からクリック → ページが切り替わる
    // フィールド一覧にはページ情報 "p2" が表示される
    const p2Item = editor.fieldList.locator('button').filter({ hasText: 'p2' });
    await p2Item.click();
    await expect(editor.pageIndicator).toHaveText('2/3');
  });
});
