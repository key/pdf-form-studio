import { expect, test } from '@playwright/test';
import { PdfEditorPage } from './helpers/pdf-editor.page';

test.describe('フィールド編集', () => {
  let editor: PdfEditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new PdfEditorPage(page);
    await editor.goto();
    await editor.uploadAndWait('simple');
    // フィールドを1つ作成
    await editor.clickOnCanvas(200, 300);
    await expect(editor.fieldPopover).toBeVisible();
  });

  test('名前を変更できる', async () => {
    await editor.fieldNameInput.clear();
    await editor.fieldNameInput.fill('my_name_field');

    // フィールド一覧に反映される
    const item = editor.fieldList.locator('button').filter({ hasText: 'my_name_field' });
    await expect(item).toBeVisible();
  });

  test('タイプをチェックボックスに切り替えられる', async () => {
    await editor.fieldTypeCheckbox.check();
    await expect(editor.fieldTypeCheckbox).toBeChecked();
    await expect(editor.fieldTypeText).not.toBeChecked();
  });

  test('タイプをテキストに切り替えられる', async () => {
    // まずチェックボックスに
    await editor.fieldTypeCheckbox.check();
    // テキストに戻す
    await editor.fieldTypeText.check();
    await expect(editor.fieldTypeText).toBeChecked();
  });

  test('フィールドを削除できる', async () => {
    await editor.deleteFieldButton.click();
    await expect(editor.fieldPopover).not.toBeVisible();

    // フィールド一覧からも消える — 空状態のテキストが表示される
    await expect(editor.fieldList.getByText('フィールドの作成方法')).toBeVisible();
  });

  test('テキストフィールドでアラインを変更できる', async () => {
    // アラインボタン（中央）をクリック
    const centerButton = editor.fieldPopover.getByRole('button', { name: '中央' });
    await centerButton.click();

    // 中央ボタンがアクティブになることを確認（bg-bp-accent クラス）
    await expect(centerButton).toHaveClass(/bg-bp-accent/);
  });

  test('ポップオーバー外クリックで閉じる', async () => {
    // フィールドリストのヘッダー部分をクリック（ポップオーバー外）
    await editor.fieldList.locator('span').filter({ hasText: 'フィールド' }).click();
    await expect(editor.fieldPopover).not.toBeVisible();
  });
});
