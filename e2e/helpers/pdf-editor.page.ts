import fs from 'node:fs';
import path from 'node:path';
import { type Locator, type Page, expect } from '@playwright/test';

const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures', 'generated');

export class PdfEditorPage {
  readonly page: Page;
  readonly dropzone: Locator;
  readonly fileInput: Locator;
  readonly pdfCanvas: Locator;
  readonly overlayCanvas: Locator;
  readonly fileName: Locator;
  readonly closeButton: Locator;
  readonly gridButton: Locator;
  readonly zoomSelect: Locator;
  readonly exportFormPdfButton: Locator;
  readonly closeConfirmDialog: Locator;
  readonly confirmCloseButton: Locator;
  readonly cancelCloseButton: Locator;
  readonly fieldPopover: Locator;
  readonly fieldNameInput: Locator;
  readonly fieldTypeText: Locator;
  readonly fieldTypeCheckbox: Locator;
  readonly deleteFieldButton: Locator;
  readonly fieldList: Locator;
  readonly importJsonInput: Locator;
  readonly exportJsonButton: Locator;
  readonly prevPageButton: Locator;
  readonly nextPageButton: Locator;
  readonly pageIndicator: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dropzone = page.getByTestId('dropzone');
    this.fileInput = page.getByTestId('pdf-file-input');
    this.pdfCanvas = page.getByTestId('pdf-canvas');
    this.overlayCanvas = page.getByTestId('overlay-canvas');
    this.fileName = page.getByTestId('file-name');
    this.closeButton = page.getByTestId('close-button');
    this.gridButton = page.getByTestId('grid-button');
    this.zoomSelect = page.getByTestId('zoom-select');
    this.exportFormPdfButton = page.getByTestId('export-form-pdf-button');
    this.closeConfirmDialog = page.getByTestId('close-confirm-dialog');
    this.confirmCloseButton = page.getByTestId('confirm-close-button');
    this.cancelCloseButton = page.getByTestId('cancel-close-button');
    this.fieldPopover = page.getByTestId('field-popover');
    this.fieldNameInput = page.getByTestId('field-name-input');
    this.fieldTypeText = page.getByTestId('field-type-text');
    this.fieldTypeCheckbox = page.getByTestId('field-type-checkbox');
    this.deleteFieldButton = page.getByTestId('delete-field-button');
    this.fieldList = page.getByTestId('field-list');
    this.importJsonInput = page.getByTestId('import-json-input');
    this.exportJsonButton = page.getByTestId('export-json-button');
    this.prevPageButton = page.getByTestId('prev-page-button');
    this.nextPageButton = page.getByTestId('next-page-button');
    this.pageIndicator = page.getByTestId('page-indicator');
  }

  async goto() {
    // AI検出APIをモック: configでボタン非表示にし、POSTは安全策としてブロック
    await this.page.route('**/api/detect-fields/config', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ available: false }) }),
    );
    await this.page.route('**/api/detect-fields', (route) => route.abort());

    await this.page.goto('/');
  }

  async uploadPdf(name: 'simple' | 'multi-page') {
    const pdfPath = path.join(FIXTURES_DIR, `${name}.pdf`);
    if (!fs.existsSync(pdfPath)) {
      throw new Error(
        `Test PDF not found: ${pdfPath}\n` +
        'Run "pnpm test:e2e" to generate fixtures via globalSetup.',
      );
    }
    const buffer = fs.readFileSync(pdfPath);
    await this.fileInput.setInputFiles({
      name: `${name}.pdf`,
      mimeType: 'application/pdf',
      buffer,
    });
  }

  async waitForEditorReady() {
    await this.pdfCanvas.waitFor({ state: 'visible' });
    await this.overlayCanvas.waitFor({ state: 'visible' });
  }

  async uploadAndWait(name: 'simple' | 'multi-page' = 'simple') {
    await this.uploadPdf(name);
    await this.waitForEditorReady();
  }

  async clickOnCanvas(x: number, y: number) {
    await this.overlayCanvas.click({ position: { x, y } });
  }

  async dragOnCanvas(from: { x: number; y: number }, to: { x: number; y: number }) {
    const box = await this.overlayCanvas.boundingBox();
    if (!box) throw new Error('Canvas not found');
    await this.page.mouse.move(box.x + from.x, box.y + from.y);
    await this.page.mouse.down();
    await this.page.mouse.move(box.x + to.x, box.y + to.y, { steps: 10 });
    await this.page.mouse.up();
  }

  async closePopover() {
    // フィールドリストのヘッダー部分をクリックしてポップオーバーを閉じる
    await this.fieldList.locator('span').filter({ hasText: 'フィールド' }).click();
    await expect(this.fieldPopover).not.toBeVisible();
  }
}
