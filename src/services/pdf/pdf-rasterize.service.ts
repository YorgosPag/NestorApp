/**
 * PDF Rasterize Service — server-side, SSoT (ADR-327 §6.7).
 *
 * Converts a PDF buffer into per-page PNG buffers for downstream vision AI
 * (OpenAI Responses API, Anthropic Vision, Document AI). Bypasses native PDF
 * parsing limits in vision models when document layout is column-heavy or
 * mixes images with numeric tables (FENPLAST-class quotes).
 *
 * Pattern: AWS Textract / Google Document AI rasterization step.
 *
 * Browser-side equivalent: `src/services/thumbnail-generator.ts::generatePdfThumbnail`.
 * This module is the server-side SSoT — DO NOT inline pdfjs in route handlers.
 */

import 'server-only';

export interface RasterizeOptions {
  dpi?: number;
  maxPages?: number;
  maxWidthPx?: number;
}

export class RasterizeUnavailableError extends Error {
  constructor(cause: unknown) {
    super(`PDF rasterization unavailable (native canvas binding missing or runtime not supported): ${String(cause)}`);
    this.name = 'RasterizeUnavailableError';
  }
}

const DEFAULT_DPI = 200;
const DEFAULT_MAX_PAGES = 10;
const DEFAULT_MAX_WIDTH_PX = 2000;

type CanvasLike = {
  width: number;
  height: number;
  getContext(kind: '2d'): CanvasContextLike;
  toBuffer(mime: 'image/png'): Buffer;
};
type CanvasContextLike = {
  fillStyle: string;
  fillRect(x: number, y: number, w: number, h: number): void;
};
interface CanvasModule {
  createCanvas(w: number, h: number): CanvasLike;
}

interface CanvasAndContext {
  canvas: CanvasLike | null;
  context: CanvasContextLike | null;
}

interface CanvasFactory {
  create(width: number, height: number): CanvasAndContext;
  reset(canvasAndContext: CanvasAndContext, width: number, height: number): void;
  destroy(canvasAndContext: CanvasAndContext): void;
}

interface PdfjsLib {
  getDocument(opts: {
    data: Uint8Array;
    isEvalSupported: boolean;
    canvasFactory?: CanvasFactory;
  }): { promise: Promise<PdfjsDoc> };
}
interface PdfjsDoc {
  numPages: number;
  getPage(n: number): Promise<PdfjsPage>;
  destroy(): Promise<void>;
}
interface PdfjsViewport { width: number; height: number; }
interface PdfjsPage {
  getViewport(opts: { scale: number }): PdfjsViewport;
  render(opts: { canvasContext: CanvasContextLike; viewport: PdfjsViewport }): { promise: Promise<void> };
  cleanup(): void;
}

let cachedPdfjs: PdfjsLib | null = null;
let cachedCanvas: CanvasModule | null = null;

async function loadPdfjs(): Promise<PdfjsLib> {
  if (cachedPdfjs) return cachedPdfjs;
  try {
    const mod = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as PdfjsLib;
    cachedPdfjs = mod;
    return mod;
  } catch (e) {
    throw new RasterizeUnavailableError(e);
  }
}

async function loadCanvas(): Promise<CanvasModule> {
  if (cachedCanvas) return cachedCanvas;
  try {
    const mod = (await import('@napi-rs/canvas')) as unknown as CanvasModule;
    cachedCanvas = mod;
    return mod;
  } catch (e) {
    throw new RasterizeUnavailableError(e);
  }
}

// @napi-rs/canvas throws "Failed to unwrap exclusive reference" when pdfjs
// tries to set canvas.width = 0 during cleanup (browser pattern to release GPU
// memory — not applicable to native Node bindings). This factory overrides
// destroy() to null references instead of zeroing dimensions.
function makeCanvasFactory(createCanvas: (w: number, h: number) => CanvasLike): CanvasFactory {
  return {
    create(width, height) {
      const canvas = createCanvas(width, height);
      return { canvas, context: canvas.getContext('2d') };
    },
    reset(canvasAndContext, width, height) {
      if (!canvasAndContext.canvas) return;
      canvasAndContext.canvas.width = width;
      canvasAndContext.canvas.height = height;
    },
    destroy(canvasAndContext) {
      canvasAndContext.canvas = null;
      canvasAndContext.context = null;
    },
  };
}

export async function rasterizePdfPages(
  pdfBuffer: Buffer,
  options: RasterizeOptions = {},
): Promise<Buffer[]> {
  const dpi = options.dpi ?? DEFAULT_DPI;
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const maxWidthPx = options.maxWidthPx ?? DEFAULT_MAX_WIDTH_PX;

  const [pdfjs, canvasMod] = await Promise.all([loadPdfjs(), loadCanvas()]);
  const { createCanvas } = canvasMod;
  const canvasFactory = makeCanvasFactory(createCanvas);

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    isEvalSupported: false,
    canvasFactory,
  });
  const doc = await loadingTask.promise;

  const pages: Buffer[] = [];
  const pageCount = Math.min(doc.numPages, maxPages);

  try {
    for (let pageNum = 1; pageNum <= pageCount; pageNum += 1) {
      const page = await doc.getPage(pageNum);
      try {
        const baseScale = dpi / 72;
        const baseViewport = page.getViewport({ scale: baseScale });
        const widthCap = baseViewport.width > maxWidthPx
          ? maxWidthPx / baseViewport.width
          : 1;
        const viewport = page.getViewport({ scale: baseScale * widthCap });

        const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({ canvasContext: ctx, viewport }).promise;
        pages.push(canvas.toBuffer('image/png'));
      } finally {
        page.cleanup();
      }
    }
  } finally {
    await doc.destroy();
  }

  return pages;
}
