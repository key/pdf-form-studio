import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const OUTPUT_DIR = path.join(__dirname, 'generated');

async function generateSimplePdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);

  page.drawText('Test PDF - Page 1', {
    x: 50,
    y: 780,
    size: 18,
    font,
    color: rgb(0, 0, 0),
  });

  page.drawText('Name:', { x: 50, y: 700, size: 12, font });
  page.drawRectangle({ x: 120, y: 690, width: 200, height: 20, borderWidth: 1, color: rgb(0.95, 0.95, 0.95) });

  page.drawText('Email:', { x: 50, y: 650, size: 12, font });
  page.drawRectangle({ x: 120, y: 640, width: 200, height: 20, borderWidth: 1, color: rgb(0.95, 0.95, 0.95) });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

async function generateMultiPagePdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (let i = 1; i <= 3; i++) {
    const page = doc.addPage([595.28, 841.89]);
    page.drawText(`Test PDF - Page ${i}`, {
      x: 50,
      y: 780,
      size: 18,
      font,
      color: rgb(0, 0, 0),
    });
    page.drawText(`Content for page ${i}`, { x: 50, y: 700, size: 12, font });
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

async function globalSetup() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const [simplePdf, multiPagePdf] = await Promise.all([
    generateSimplePdf(),
    generateMultiPagePdf(),
  ]);

  fs.writeFileSync(path.join(OUTPUT_DIR, 'simple.pdf'), simplePdf);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'multi-page.pdf'), multiPagePdf);
}

export default globalSetup;
