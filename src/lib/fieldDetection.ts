import type { PDFDocumentProxy, FieldDefinition } from '@/types';

const RENDER_SCALE = 1.5;
const MAX_PAGES = 20;

interface PageImage {
  pageNumber: number;
  imageBase64: string;
  width: number;
  height: number;
}

interface DetectFieldsResponse {
  fields: Array<{
    name: string;
    type: 'text' | 'checkbox';
    page: number;
    x: number;
    y: number;
    width?: number;
    height?: number;
  }>;
  error?: string;
}

export async function checkDetectionAvailable(): Promise<boolean> {
  try {
    const res = await fetch('/api/detect-fields/config');
    if (!res.ok) return false;
    const data = await res.json();
    return !!data.available;
  } catch {
    return false;
  }
}

async function renderAllPagesToImages(
  pdfDoc: PDFDocumentProxy,
): Promise<PageImage[]> {
  const numPages = Math.min(pdfDoc.numPages, MAX_PAGES);
  const images: PageImage[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const originalViewport = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: RENDER_SCALE });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');

    await page.render({ canvasContext: ctx, viewport }).promise;

    const dataUrl = canvas.toDataURL('image/png');
    // Strip the "data:image/png;base64," prefix
    const base64 = dataUrl.split(',')[1];

    images.push({
      pageNumber: i,
      imageBase64: base64,
      width: Math.round(originalViewport.width),
      height: Math.round(originalViewport.height),
    });
  }

  return images;
}

export async function detectFields(
  pdfDoc: PDFDocumentProxy,
): Promise<FieldDefinition[]> {
  const pages = await renderAllPagesToImages(pdfDoc);

  const res = await fetch('/api/detect-fields', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pages }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Detection API error: ${res.status}`);
  }

  const data: DetectFieldsResponse = await res.json();

  if (data.error) {
    throw new Error(data.error);
  }

  // Convert API response to FieldDefinition with IDs
  return data.fields.map((f) => ({
    id: crypto.randomUUID(),
    name: f.name,
    type: f.type,
    page: f.page,
    x: f.x,
    y: f.y,
    width: f.type === 'text' ? (f.width || 50) : undefined,
    height: f.type === 'text' ? (f.height || 20) : undefined,
    fontSize: 10,
  }));
}
