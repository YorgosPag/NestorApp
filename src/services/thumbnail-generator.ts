/**
 * =============================================================================
 * ENTERPRISE: Thumbnail Generator for Floorplan Files (DXF/PDF)
 * =============================================================================
 *
 * Generates small preview images at upload time for display in file lists.
 * Two pure functions — no side effects, no singletons.
 *
 * @module services/thumbnail-generator
 * @enterprise ADR-031 - Canonical File Storage System
 * @enterprise ADR-033 - Floorplan Processing Pipeline
 *
 * Architecture:
 * - Offscreen canvas rendering → PNG Blob
 * - DXF: Entity rendering (line, polyline, circle, arc, text)
 * - PDF: pdfjs-dist page 1 rendering
 * - Called once at upload time, result stored in Firebase Storage
 */

import { computeSceneBounds } from '@/lib/dxf-scene/scene-bounds';
import { paintSceneEntityGeometry } from '@/lib/dxf-scene/canvas-scene-painter';
import { readSceneTextContent } from '@/lib/dxf-scene/scene-text-content';
import {
  computeFitTransform,
  projectX,
  projectY,
  type FitTransform,
  type SceneBounds,
} from '@/lib/dxf-scene/scene-fit-transform';

// ============================================================================
// TYPES — Minimal input contract, compatible with both DxfSceneData and SceneModel
// ============================================================================

/** Minimal scene input — accepts both DxfSceneData (file-record.ts) and SceneModel (dxf-viewer) */
interface ThumbnailSceneInput {
  entities: ReadonlyArray<{ type: string; layer?: string }>;
  layers?: Record<string, { color?: string; visible?: boolean }>;
  bounds?: SceneBounds;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default thumbnail dimensions */
const DEFAULT_WIDTH = 300;
const DEFAULT_HEIGHT = 200;

/** Background color for thumbnail (light theme) */
const THUMB_BACKGROUND = '#f8f9fa';

/** Background behind a rasterized PDF page — PDF pages are white by definition */
const PDF_PAGE_BACKGROUND = '#ffffff';

/** Padding ratio — keep 5% margin around drawing */
const PADDING_RATIO = 0.05;

// ============================================================================
// DXF THUMBNAIL
// ============================================================================

/**
 * Generate a PNG thumbnail from DXF scene data.
 *
 * Creates an offscreen canvas, renders entities (line, polyline, circle, arc, text)
 * with proper bounds scaling, and returns a PNG Blob.
 *
 * Rendering logic adapted from FloorplanGallery.renderDxfToCanvas()
 * with fixed dimensions (no container dependency) and no dark mode.
 *
 * @param scene - Parsed DXF scene data (DxfSceneData or SceneModel)
 * @param width - Thumbnail width in pixels (default 300)
 * @param height - Thumbnail height in pixels (default 200)
 * @returns PNG Blob
 */
export async function generateDxfThumbnail(
  scene: ThumbnailSceneInput,
  width: number = DEFAULT_WIDTH,
  height: number = DEFAULT_HEIGHT,
): Promise<Blob> {
  if (!scene.entities || scene.entities.length === 0) {
    throw new Error('DXF scene has no entities — cannot generate thumbnail');
  }

  const { canvas, ctx } = createFilledCanvas(width, height, THUMB_BACKGROUND);

  // Calculate bounds + scale with padding
  const bounds = scene.bounds || computeSceneBounds(scene.entities);

  if (bounds.max.x - bounds.min.x <= 0 || bounds.max.y - bounds.min.y <= 0) {
    throw new Error('DXF scene has zero-size bounds');
  }

  const fit = computeFitTransform(width, height, bounds, 1, undefined, PADDING_RATIO);

  // Layer color helper
  const getLayerColor = (layerName: string): string =>
    scene.layers?.[layerName]?.color || '#64748b';

  ctx.lineWidth = 1;

  // Render entities. Primitive geometry goes through the `canvas-scene-painter` SSoT;
  // only text stays local (this surface keeps a 6px font floor so labels stay legible
  // at thumbnail scale — the gallery deliberately has NO floor, see ADR-370).
  for (const entity of scene.entities) {
    const layerName = entity.layer || '0';
    if (scene.layers?.[layerName]?.visible === false) continue;

    const layerColor = getLayerColor(layerName);
    ctx.strokeStyle = layerColor;

    if (paintSceneEntityGeometry(ctx, entity, bounds, fit)) continue;

    if (entity.type === 'text' || entity.type === 'mtext') {
      paintThumbnailText(ctx, entityProps(entity), bounds, fit, layerColor);
    }
  }

  return canvasToBlob(canvas);
}

/**
 * Thumbnail text pass. Kept OUT of the shared painter: at 300×200 a purely
 * zoom-scaled font collapses to sub-pixel, so this surface clamps to a 6px floor.
 * The gallery renderer must NOT clamp (ADR-370) — that divergence is the reason
 * text is not centralized alongside the primitive geometry.
 */
function paintThumbnailText(
  ctx: CanvasRenderingContext2D,
  e: Record<string, unknown>,
  bounds: SceneBounds,
  fit: FitTransform,
  color: string,
): void {
  const position = e.position as { x: number; y: number } | undefined;
  const text = readSceneTextContent(e);
  if (!position || !text) return;

  const textHeight = e.height as number | undefined;
  ctx.fillStyle = color;
  ctx.font = `${Math.max(6, (textHeight || 10) * fit.scale)}px Arial`;
  ctx.fillText(text, projectX(position.x, bounds, fit), projectY(position.y, bounds, fit));
}

// ============================================================================
// PDF THUMBNAIL
// ============================================================================

/**
 * Generate a PNG thumbnail from a PDF file (page 1).
 *
 * Uses isolated pdfjs-dist instance — no interference with PdfRenderer singleton.
 * Loads document, renders page 1 to offscreen canvas, destroys document.
 *
 * @param file - PDF File object
 * @param width - Thumbnail width in pixels (default 300)
 * @param height - Thumbnail height in pixels (default 200)
 * @returns PNG Blob
 */
export async function generatePdfThumbnail(
  file: File,
  width: number = DEFAULT_WIDTH,
  height: number = DEFAULT_HEIGHT,
): Promise<Blob> {
  // Dynamic import — tree-shaken when not used
  const pdfjs = await import('pdfjs-dist');

  // Set worker (idempotent — same path as PdfRenderer)
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdfDocument = await loadingTask.promise;

  try {
    const page = await pdfDocument.getPage(1);

    // Calculate scale to fit page within thumbnail dimensions
    const unscaledViewport = page.getViewport({ scale: 1 });
    const scaleX = width / unscaledViewport.width;
    const scaleY = height / unscaledViewport.height;
    const renderScale = Math.min(scaleX, scaleY);

    const viewport = page.getViewport({ scale: renderScale });

    // White background (PDF pages are white)
    const { canvas, ctx } = createFilledCanvas(width, height, PDF_PAGE_BACKGROUND);

    // Center the rendered page
    const pageOffsetX = (width - viewport.width) / 2;
    const pageOffsetY = (height - viewport.height) / 2;
    ctx.translate(pageOffsetX, pageOffsetY);

    await page.render({
      canvasContext: ctx,
      viewport,
    }).promise;

    return canvasToBlob(canvas);
  } finally {
    await pdfDocument.destroy();
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Access additional entity properties at runtime.
 * Entities carry properties (start, end, vertices, center, radius, etc.)
 * that aren't in the minimal ThumbnailSceneInput type contract.
 */
function entityProps(entity: object): Record<string, unknown> {
  return entity as Record<string, unknown>;
}

/**
 * Create an offscreen canvas of the requested size with its background pre-filled.
 * ONE owner of the «create + size + get 2D context + fill» sequence, shared by the
 * DXF and PDF thumbnail paths (they used to carry byte-identical copies).
 */
function createFilledCanvas(
  width: number,
  height: number,
  background: string,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D canvas context');
  }

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  return { canvas, ctx };
}

/**
 * Convert canvas to PNG Blob via Promise wrapper around canvas.toBlob()
 */
function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('canvas.toBlob() returned null'));
        }
      },
      'image/png',
    );
  });
}
