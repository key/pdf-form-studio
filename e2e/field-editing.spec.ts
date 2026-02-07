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

  test('フィールドをドラッグで移動できる', async ({ page }) => {
    // beforeEachで作成されたフィールドを削除して、大きめの矩形フィールドで再作成
    await editor.deleteFieldButton.click();

    // 大きめの矩形フィールドをドラッグで作成（ヒット判定を確実にするため）
    await editor.dragOnCanvas({ x: 100, y: 200 }, { x: 300, y: 260 });
    await expect(editor.fieldPopover).toBeVisible();
    await editor.fieldNameInput.fill('drag_target');
    await editor.closePopover();

    // JSONエクスポートで移動前の座標を取得
    const dlBefore = page.waitForEvent('download');
    await editor.exportJsonButton.click();
    const beforeBuf = await editor.readDownloadBuffer(await dlBefore);
    const beforeJson = JSON.parse(beforeBuf.toString('utf-8'));
    const beforeField = beforeJson.fields[0];

    // 矩形の中心付近からドラッグ（確実にフィールド内をクリック）
    const centerX = 200;
    const centerY = 230;
    await editor.dragOnCanvas({ x: centerX, y: centerY }, { x: centerX + 80, y: centerY - 60 });

    // ポップオーバーが出たら閉じる
    if (await editor.fieldPopover.isVisible()) {
      await editor.closePopover();
    }

    // 移動後の座標をJSONエクスポートで検証
    const dlAfter = page.waitForEvent('download');
    await editor.exportJsonButton.click();
    const afterBuf = await editor.readDownloadBuffer(await dlAfter);
    const afterJson = JSON.parse(afterBuf.toString('utf-8'));
    const afterField = afterJson.fields[0];

    // 座標が変化していること
    expect(afterField.x).not.toBe(beforeField.x);
    expect(afterField.y).not.toBe(beforeField.y);
  });
});
