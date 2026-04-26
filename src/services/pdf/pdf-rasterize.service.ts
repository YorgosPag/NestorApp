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

import { createCanvas, type SKRSContext2D } from '@napi-rs/canvas';

export interface RasterizeOptions {
  dpi?: number;
  maxPages?: number;
  maxWidthPx?: number;
}

const DEFAULT_DPI = 200;
const DEFAULT_MAX_PAGES = 10;
const DEFAULT_MAX_WIDTH_PX = 2000;

interface PdfjsLib {
  getDocument(opts: { data: Uint8Array; isEvalSupported: boolean }): { promise: Promise<PdfjsDoc> };
}
interface PdfjsDoc {
  numPages: number;
  getPage(n: number): Promise<PdfjsPage>;
  destroy(): Promise<void>;
}
interface PdfjsViewport { width: number; height: number; }
interface PdfjsPage {
  getViewport(opts: { scale: number }): PdfjsViewport;
  render(opts: { canvasContext: SKRSContext2D; viewport: PdfjsViewport }): { promise: Promise<void> };
  cleanup(): void;
}

let cached: PdfjsLib | null = null;

async function loadPdfjs(): Promise<PdfjsLib> {
  if (cached) return cached;
  // Legacy build is the Node-compatible entrypoint (no DOM dependency).
  const mod = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as PdfjsLib;
  cached = mod;
  return mod;
}

export async function rasterizePdfPages(
  pdfBuffer: Buffer,
  options: RasterizeOptions = {},
): Promise<Buffer[]> {
  const dpi = options.dpi ?? DEFAULT_DPI;
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const maxWidthPx = options.maxWidthPx ?? DEFAULT_MAX_WIDTH_PX;

  const pdfjs = await loadPdfjs();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    isEvalSupported: false,
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
