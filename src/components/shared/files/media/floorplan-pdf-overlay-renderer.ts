/**
 * =============================================================================
 * ENTERPRISE: FloorplanGallery — PDF + Overlay Renderer
 * =============================================================================
 *
 * Coordinate system (Y-UP, CAD convention — matches DXF Viewer editor):
 *   - bounds  = renderDims / (PDF_RENDER_SCALE*2): 421×596 for A3
 *   - polygon vertices are saved in CAD world space, Y-up (Y=0 at bottom)
 *   - fit     = simple aspect-fit centering, no margins
 *              scale = min(canvasW / w, canvasH / h)
 *              offsetX = (canvasW - w*scale) / 2
 *   - worldToScreen: screenX = offsetX + wx*scale
 *                    screenY = offsetY + (boundsH - wy)*scale  (Y-flip)
 *
 * PDF image and polygons share the SAME transform → zero drift.
 *
 * @module components/shared/files/media/floorplan-pdf-overlay-renderer
 * @enterprise SPEC-237D — overlay support on PDF backgrounds
 */

import type { FloorOverlayItem } from '@/hooks/useFloorOverlays';
import type { PanOffset } from '@/hooks/useZoomPan';
import { getStatusColors } from '@/subapps/dxf-viewer/config/color-mapping';
import { UI_COLORS, withOpacity, OVERLAY_OPACITY } from '@/subapps/dxf-viewer/config/color-config';
import { isPointInPolygon } from '@core/polygon-system/utils/polygon-utils';
import type { UniversalPolygon } from '@core/polygon-system/types';

const ZERO_PAN: PanOffset = { x: 0, y: 0 };

const FALLBACK = {
  stroke: UI_COLORS.DARK_GRAY,
  fill: withOpacity(UI_COLORS.DARK_GRAY, OVERLAY_OPACITY.MUTED),
} as const;

interface PdfBounds {
  width: number;
  height: number;
}

interface FitTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

function calcFit(
  canvasW: number,
  canvasH: number,
  bounds: PdfBounds,
  zoom: number = 1,
  pan: PanOffset = ZERO_PAN,
): FitTransform {
  const baseScale = Math.min(canvasW / bounds.width, canvasH / bounds.height);
  const scale = baseScale * zoom;
  return {
    scale,
    offsetX: (canvasW - bounds.width * scale) / 2 + pan.x,
    offsetY: (canvasH - bounds.height * scale) / 2 + pan.y,
  };
}

// Y-UP convention: worldY=0 at bottom, worldY=boundsH at top → Y-flip for canvas
function toScreen(wx: number, wy: number, boundsH: number, t: FitTransform): { x: number; y: number } {
  return { x: t.offsetX + wx * t.scale, y: t.offsetY + (boundsH - wy) * t.scale };
}

function toWorld(sx: number, sy: number, boundsH: number, t: FitTransform): { x: number; y: number } {
  return { x: (sx - t.offsetX) / t.scale, y: boundsH - (sy - t.offsetY) / t.scale };
}

/**
 * Hit-test overlays at a canvas-pixel point.
 * Returns the first overlay with a linked propertyId at that point, or null.
 */
export function hitTestPdfOverlays(
  canvasX: number,
  canvasY: number,
  canvasWidth: number,
  canvasHeight: number,
  bounds: PdfBounds,
  overlays: ReadonlyArray<FloorOverlayItem>,
  zoom: number = 1,
  panOffset: PanOffset = ZERO_PAN,
): FloorOverlayItem | null {
  const t = calcFit(canvasWidth, canvasHeight, bounds, zoom, panOffset);
  const world = toWorld(canvasX, canvasY, bounds.height, t);
  for (const overlay of overlays) {
    if (overlay.polygon.length < 3) continue;
    const universal: UniversalPolygon = {
      id: overlay.id,
      type: 'simple',
      points: overlay.polygon,
      isClosed: true,
      style: { strokeColor: '', fillColor: '', strokeWidth: 0, fillOpacity: 0, strokeOpacity: 0 },
    };
    if (isPointInPolygon(world, universal)) return overlay;
  }
  return null;
}

/**
 * Render PDF image + overlay polygons in one pass.
 * Sizes the canvas to match its container.
 */
export function renderPdfWithOverlays(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  bounds: PdfBounds,
  overlays: ReadonlyArray<FloorOverlayItem>,
  highlightedUnitId?: string | null,
  zoom: number = 1,
  panOffset: PanOffset = ZERO_PAN,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const container = canvas.parentElement;
  if (container) {
    const rect = container.getBoundingClientRect();
    canvas.width = Math.round(rect.width);
    canvas.height = Math.round(rect.height);
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (bounds.width <= 0 || bounds.height <= 0) return;

  const t = calcFit(canvas.width, canvas.height, bounds, zoom, panOffset);

  // Draw PDF image (Y-DOWN: top-left at world (0,0), bottom-right at (W,H))
  ctx.drawImage(image, t.offsetX, t.offsetY, bounds.width * t.scale, bounds.height * t.scale);

  if (overlays.length === 0) return;

  ctx.save();
  for (const overlay of overlays) {
    if (overlay.polygon.length < 3) continue;

    const colors = getStatusColors(overlay.resolvedStatus) ?? FALLBACK;
    const isHighlighted = !!(highlightedUnitId && overlay.linked?.propertyId === highlightedUnitId);

    ctx.fillStyle = isHighlighted
      ? withOpacity(colors.stroke, OVERLAY_OPACITY.GALLERY_FILL)
      : 'transparent';
    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth = isHighlighted ? 4 : 3;

    ctx.beginPath();
    overlay.polygon.forEach((vertex, i) => {
      const s = toScreen(vertex.x, vertex.y, bounds.height, t);
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** @deprecated use hitTestPdfOverlays */
export function pdfScreenToWorld(
  sx: number,
  sy: number,
  canvasWidth: number,
  canvasHeight: number,
  bounds: PdfBounds,
): { x: number; y: number } {
  return toWorld(sx, sy, bounds.height, calcFit(canvasWidth, canvasHeight, bounds));
}
