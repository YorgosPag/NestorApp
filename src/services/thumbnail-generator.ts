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

// ============================================================================
// TYPES — Minimal input contract, compatible with both DxfSceneData and SceneModel
// ============================================================================

/** Minimal scene input — accepts both DxfSceneData (file-record.ts) and SceneModel (dxf-viewer) */
interface ThumbnailSceneInput {
  entities: ReadonlyArray<{ type: string; layer?: string }>;
  layers?: Record<string, { color?: string; visible?: boolean }>;
  bounds?: { min: { x: number; y: number }; max: { x: number; y: number } };
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default thumbnail dimensions */
const DEFAULT_WIDTH = 300;
const DEFAULT_HEIGHT = 200;

/** Background color for thumbnail (light theme) */
const THUMB_BACKGROUND = '#f8f9fa';

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

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D canvas context');
  }

  // Background
  ctx.fillStyle = THUMB_BACKGROUND;
  ctx.fillRect(0, 0, width, height);

  // Calculate bounds + scale with padding
  const bounds = scene.bounds || calculateBounds(scene);
  const drawingWidth = bounds.max.x - bounds.min.x;
  const drawingHeight = bounds.max.y - bounds.min.y;

  if (drawingWidth <= 0 || drawingHeight <= 0) {
    throw new Error('DXF scene has zero-size bounds');
  }

  const paddedWidth = width * (1 - 2 * PADDING_RATIO);
  const paddedHeight = height * (1 - 2 * PADDING_RATIO);
  const scale = Math.min(paddedWidth / drawingWidth, paddedHeight / drawingHeight);
  const offsetX = (width - drawingWidth * scale) / 2;
  const offsetY = (height - drawingHeight * scale) / 2;

  // Layer color helper
  const getLayerColor = (layerName: string): string =>
    scene.layers?.[layerName]?.color || '#64748b';

  ctx.lineWidth = 1;

  // Render entities
  for (const entity of scene.entities) {
    const layerName = entity.layer || '0';
    if (scene.layers?.[layerName]?.visible === false) continue;

    const layerColor = getLayerColor(layerName);
    ctx.strokeStyle = layerColor;

    const e = entityProps(entity);

    switch (entity.type) {
      case 'line': {
        const start = e.start as { x: number; y: number } | undefined;
        const end = e.end as { x: number; y: number } | undefined;
        if (start && end) {
          ctx.beginPath();
          ctx.moveTo(
            (start.x - bounds.min.x) * scale + offsetX,
            (bounds.max.y - start.y) * scale + offsetY,
          );
          ctx.lineTo(
            (end.x - bounds.min.x) * scale + offsetX,
            (bounds.max.y - end.y) * scale + offsetY,
          );
          ctx.stroke();
        }
        break;
      }

      case 'polyline': {
        const vertices = e.vertices as Array<{ x: number; y: number }> | undefined;
        const closed = e.closed as boolean | undefined;
        if (vertices && Array.isArray(vertices) && vertices.length > 1) {
          ctx.beginPath();
          const first = vertices[0];
          ctx.moveTo(
            (first.x - bounds.min.x) * scale + offsetX,
            (bounds.max.y - first.y) * scale + offsetY,
          );
          for (const v of vertices.slice(1)) {
            ctx.lineTo(
              (v.x - bounds.min.x) * scale + offsetX,
              (bounds.max.y - v.y) * scale + offsetY,
            );
          }
          if (closed) ctx.closePath();
          ctx.stroke();
        }
        break;
      }

      case 'circle': {
        const center = e.center as { x: number; y: number } | undefined;
        const radius = e.radius as number | undefined;
        if (center && radius) {
          ctx.beginPath();
          ctx.arc(
            (center.x - bounds.min.x) * scale + offsetX,
            (bounds.max.y - center.y) * scale + offsetY,
            radius * scale,
            0,
            2 * Math.PI,
          );
          ctx.stroke();
        }
        break;
      }

      case 'arc': {
        const arcCenter = e.center as { x: number; y: number } | undefined;
        const arcRadius = e.radius as number | undefined;
        const startAngleDeg = e.startAngle as number | undefined;
        const endAngleDeg = e.endAngle as number | undefined;
        if (arcCenter && arcRadius && startAngleDeg !== undefined && endAngleDeg !== undefined) {
          // DXF arcs: angles in degrees, CCW from East, Y+ up
          // Canvas arcs: angles in radians, CW from East, Y+ down
          // Fix: deg→rad, negate angles, flip direction for Y-axis inversion
          const startRad = startAngleDeg * Math.PI / 180;
          const endRad = endAngleDeg * Math.PI / 180;
          ctx.beginPath();
          ctx.arc(
            (arcCenter.x - bounds.min.x) * scale + offsetX,
            (bounds.max.y - arcCenter.y) * scale + offsetY,
            arcRadius * scale,
            -startRad,
            -endRad,
            true,
          );
          ctx.stroke();
        }
        break;
      }

      case 'text': {
        const position = e.position as { x: number; y: number } | undefined;
        const text = e.text as string | undefined;
        const textHeight = e.height as number | undefined;
        if (position && text) {
          ctx.fillStyle = layerColor;
          ctx.font = `${Math.max(6, (textHeight || 10) * scale)}px Arial`;
          ctx.fillText(
            text,
            (position.x - bounds.min.x) * scale + offsetX,
            (bounds.max.y - position.y) * scale + offsetY,
          );
        }
        break;
      }
    }
  }

  return canvasToBlob(canvas);
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

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D canvas context');
    }

    // White background (PDF pages are white)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

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

/**
 * Calculate bounds from entities when scene.bounds is missing.
 * Iterates through entity coordinates to find min/max.
 */
function calculateBounds(scene: ThumbnailSceneInput): { min: { x: number; y: number }; max: { x: number; y: number } } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const expand = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };

  for (const entity of scene.entities) {
    const e = entityProps(entity);

    switch (entity.type) {
      case 'line': {
        const start = e.start as { x: number; y: number } | undefined;
        const end = e.end as { x: number; y: number } | undefined;
        if (start) expand(start.x, start.y);
        if (end) expand(end.x, end.y);
        break;
      }
      case 'polyline': {
        const vertices = e.vertices as Array<{ x: number; y: number }> | undefined;
        if (vertices) {
          for (const v of vertices) expand(v.x, v.y);
        }
        break;
      }
      case 'circle': {
        const center = e.center as { x: number; y: number } | undefined;
        const radius = e.radius as number | undefined;
        if (center && radius) {
          expand(center.x - radius, center.y - radius);
          expand(center.x + radius, center.y + radius);
        }
        break;
      }
      case 'arc': {
        const arcCenter = e.center as { x: number; y: number } | undefined;
        const arcRadius = e.radius as number | undefined;
        if (arcCenter && arcRadius) {
          expand(arcCenter.x - arcRadius, arcCenter.y - arcRadius);
          expand(arcCenter.x + arcRadius, arcCenter.y + arcRadius);
        }
        break;
      }
      case 'text': {
        const position = e.position as { x: number; y: number } | undefined;
        if (position) expand(position.x, position.y);
        break;
      }
    }
  }

  // Fallback if no valid coordinates found
  if (!isFinite(minX)) {
    return { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } };
  }

  return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };
}
