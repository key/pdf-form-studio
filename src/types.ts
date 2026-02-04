export interface FieldDefinition {
  id: string;
  name: string;
  type: 'text' | 'checkbox';
  page: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  fontSize?: number;
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';
}

export type PDFDocumentProxy = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PDFPageProxy>;
  destroy: () => Promise<void>;
};

export type RenderTask = {
  promise: Promise<void>;
  cancel: () => void;
};

export type PDFPageProxy = {
  getViewport: (params: { scale: number }) => { width: number; height: number };
  render: (params: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => RenderTask;
};
