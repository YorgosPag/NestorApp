/**
 * =============================================================================
 * Upload Thumbnail Generator — Client-side thumbnail at upload time
 * =============================================================================
 *
 * Generates persistent thumbnails during the upload process.
 * Images are resized via OffscreenCanvas; PDFs use pdfjs-dist page 1 render.
 * The resulting Blob is uploaded to Firebase Storage alongside the original.
 *
 * @module components/shared/files/utils/generate-upload-thumbnail
 * @enterprise ADR-191 Phase 2.1 — Thumbnail Generation
 */

import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('ThumbnailGen');

// ============================================================================
// CONSTANTS
// ============================================================================

/** Target thumbnail width (pixels) */
const THUMB_WIDTH = 300;

/** Maximum thumbnail height (to avoid very tall thumbnails from narrow PDFs) */
const THUMB_MAX_HEIGHT = 400;

/** WebP quality for thumbnails (0.0–1.0) */
const THUMB_QUALITY = 0.75;

/** MIME type for generated thumbnails */
const THUMB_MIME = 'image/webp';

// ============================================================================
// IMAGE THUMBNAIL
// ============================================================================

/**
 * Generate a thumbnail from an image File using OffscreenCanvas.
 * Resizes to THUMB_WIDTH maintaining aspect ratio.
 */
async function generateImageThumbnail(file: File): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = THUMB_WIDTH / bitmap.width;
    const thumbWidth = Math.round(bitmap.width * scale);
    const thumbHeight = Math.min(Math.round(bitmap.height * scale), THUMB_MAX_HEIGHT);

    // Use OffscreenCanvas if available (most modern browsers), fallback to regular canvas
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(thumbWidth, thumbHeight);
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(bitmap, 0, 0, thumbWidth, thumbHeight);
      bitmap.close();
      return await canvas.convertToBlob({ type: THUMB_MIME, quality: THUMB_QUALITY });
    }

    // Fallback: regular canvas
    const canvas = document.createElement('canvas');
    canvas.width = thumbWidth;
    canvas.height = thumbHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, thumbWidth, thumbHeight);
    bitmap.close();

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob),
        THUMB_MIME,
        THUMB_QUALITY,
      );
    });
  } catch (err) {
    logger.warn('Image thumbnail generation failed', { error: String(err) });
    return null;
  }
}

// ============================================================================
// PDF THUMBNAIL
// ============================================================================

/** Minimal pdfjs-dist types for thumbnail generation */
interface PdfDocProxy {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageProxy>;
  destroy(): Promise<void>;
}

interface PdfPageProxy {
  getViewport(params: { scale: number }): { width: number; height: number };
  render(params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }): { promise: Promise<void> };
}

interface PdfJsLib {
  getDocument(params: { data: ArrayBuffer }): { promise: Promise<PdfDocProxy> };
  GlobalWorkerOptions: { workerSrc: string };
}

let cachedPdfJs: PdfJsLib | null = null;

async function loadPdfJs(): Promise<PdfJsLib> {
  if (cachedPdfJs) return cachedPdfJs;
  const lib = await import('pdfjs-dist');
  lib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  cachedPdfJs = lib as unknown as PdfJsLib;
  return cachedPdfJs;
}

/**
 * Generate a thumbnail from a PDF File by rendering page 1.
 */
async function generatePdfThumbnail(file: File): Promise<Blob | null> {
  let doc: PdfDocProxy | null = null;
  try {
    const lib = await loadPdfJs();
    const data = await file.arrayBuffer();
    doc = await lib.getDocument({ data }).promise;

    const page = await doc.getPage(1);
    const naturalViewport = page.getViewport({ scale: 1 });
    const scale = THUMB_WIDTH / naturalViewport.width;
    const viewport = page.getViewport({ scale });

    const thumbWidth = Math.round(viewport.width);
    const thumbHeight = Math.min(Math.round(viewport.height), THUMB_MAX_HEIGHT);

    const canvas = document.createElement('canvas');
    canvas.width = thumbWidth;
    canvas.height = thumbHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    await page.render({ canvasContext: ctx, viewport }).promise;
    await doc.destroy();
    doc = null;

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob),
        THUMB_MIME,
        THUMB_QUALITY,
      );
    });
  } catch (err) {
    logger.warn('PDF thumbnail generation failed', { error: String(err) });
    if (doc) {
      try { await doc.destroy(); } catch { /* cleanup */ }
    }
    return null;
  }
}

// ============================================================================
// CLASSIFIABLE TYPES
// ============================================================================

const IMAGE_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp',
]);

const PDF_TYPES = new Set([
  'application/pdf',
]);

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Generate a thumbnail Blob from a File during upload.
 *
 * - Images → resize to 300px width via canvas
 * - PDFs → render page 1 via pdfjs-dist
 * - Other types → returns null (no thumbnail)
 *
 * @returns Thumbnail Blob in WebP format, or null if not supported/failed
 */
export async function generateUploadThumbnail(
  file: File,
  contentType: string,
): Promise<Blob | null> {
  if (IMAGE_TYPES.has(contentType)) {
    return generateImageThumbnail(file);
  }

  if (PDF_TYPES.has(contentType)) {
    return generatePdfThumbnail(file);
  }

  // Unsupported type — no thumbnail
  return null;
}

/**
 * Build the Storage path for a thumbnail.
 * Convention: append `_thumb.webp` to the original storage path (without extension).
 *
 * @example
 * buildThumbnailPath('companies/abc/files/xyz/document.pdf')
 * // → 'companies/abc/files/xyz/document_thumb.webp'
 */
export function buildThumbnailPath(originalStoragePath: string): string {
  const lastDot = originalStoragePath.lastIndexOf('.');
  const basePath = lastDot > 0 ? originalStoragePath.substring(0, lastDot) : originalStoragePath;
  return `${basePath}_thumb.webp`;
}
