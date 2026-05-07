/**
 * =============================================================================
 * ENTERPRISE: FloorplanGallery PDF Renderer
 * =============================================================================
 *
 * Renders PDF page 1 to an HTML canvas, sized to the container with zoom/pan,
 * using the SAME coordinate transform as renderDxfToCanvas + drawOverlayPolygons.
 *
 * Bounds convention: synthetic CAD-style {min:{0,0}, max:{pdfWidth, pdfHeight}}.
 * Image is drawn top-down so that overlay Y-flip aligns visually
 * (high world-Y == top of PDF, matching editor's PdfBackgroundCanvas at default
 * pdfTransform).
 *
 * @module components/shared/files/media/floorplan-pdf-renderer
 * @enterprise SPEC-237D — Overlay support on PDF backgrounds
 */

import type { PanOffset } from '@/hooks/useZoomPan';
import { PdfRenderer } from '@/subapps/dxf-viewer/pdf-background/services/PdfRenderer';

/** Render scale for sharpness — image is rendered at this multiple of PDF points. */
const PDF_RENDER_SCALE = 2;

export interface PdfPageInfo {
  imageUrl: string;
  /** Image pixel width (PDF points × PDF_RENDER_SCALE) — matches editor's world bounds. */
  imageWidth: number;
  /** Image pixel height (PDF points × PDF_RENDER_SCALE) — matches editor's world bounds. */
  imageHeight: number;
}

/**
 * Fetch a PDF from a URL, render its first page to a data URL.
 * Returns image pixel dimensions (rendered at PDF_RENDER_SCALE) — these match
 * the bounds the DXF Viewer editor uses for fit-to-view, so polygon world
 * coords saved by the editor render at the same PDF position here.
 */
/**
 * Old FileRecords stored direct Firebase Storage URLs which fail `fetch()` due
 * to CORS. Rewrite them to the same-origin proxy so the browser can fetch them.
 */
function resolveStorageUrl(url: string): string {
  if (!url.startsWith('https://firebasestorage.googleapis.com')) return url;
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/^\/v0\/b\/[^/]+\/o\/(.+)$/);
    if (match) {
      const storagePath = decodeURIComponent(match[1]);
      const encoded = storagePath.split('/').map(encodeURIComponent).join('/');
      return `/api/storage/file/${encoded}`;
    }
  } catch { /* fall through to direct URL */ }
  return url;
}

export async function loadPdfPage1(url: string): Promise<PdfPageInfo | null> {
  const response = await fetch(resolveStorageUrl(url));
  if (!response.ok) return null;
  const blob = await response.blob();
  const file = new File([blob], 'floorplan.pdf', { type: 'application/pdf' });

  const loadResult = await PdfRenderer.loadDocument(file);
  if (!loadResult.success) return null;

  const renderResult = await PdfRenderer.renderPage(1, { scale: PDF_RENDER_SCALE });
  if (!renderResult.success || !renderResult.imageUrl || !renderResult.dimensions) {
    return null;
  }

  // Return FULL rendered pixel dimensions — these ARE the world-space bounds.
  // The DXF Viewer editor places the PDF at world (0,0)→(img.width, img.height).
  // Overlay vertices are saved in this same space, so bounds must equal image dims.
  // ctx.drawImage(image, ..., bounds.width*scale, bounds.height*scale) then maps
  // image pixel px → canvas_x = offsetX + px*scale, matching the overlay formula.
  return {
    imageUrl: renderResult.imageUrl,
    imageWidth: renderResult.dimensions.width,
    imageHeight: renderResult.dimensions.height,
  };
}

/**
 * Render a loaded PDF image to a canvas with zoom/pan.
 * Uses the SAME fit-and-center math as renderDxfToCanvas so overlays align.
 */
export function renderPdfImageToCanvas(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  pdfDimensions: { width: number; height: number },
  zoom: number,
  panOffset: PanOffset,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const container = canvas.parentElement;
  if (container) {
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const drawingWidth = pdfDimensions.width;
  const drawingHeight = pdfDimensions.height;
  if (drawingWidth <= 0 || drawingHeight <= 0) return;

  const baseScale = Math.min(canvas.width / drawingWidth, canvas.height / drawingHeight);
  const scale = baseScale * zoom;
  const offsetX = (canvas.width - drawingWidth * scale) / 2 + panOffset.x;
  const offsetY = (canvas.height - drawingHeight * scale) / 2 + panOffset.y;

  ctx.drawImage(image, offsetX, offsetY, drawingWidth * scale, drawingHeight * scale);
}
