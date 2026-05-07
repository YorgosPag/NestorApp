/* eslint-disable design-system/no-hardcoded-colors */
/**
 * =============================================================================
 * ENTERPRISE: Overlay Polygon Renderer — SSoT
 * =============================================================================
 *
 * Single source of truth for rendering overlay polygons on top of any
 * floorplan background (DXF scene, PDF page-1 image, raster image).
 *
 * Replaces the duplicate polygon-draw loops that previously lived in:
 *   - `floorplan-overlay-system.ts` (`drawOverlayPolygons`, DXF branch)
 *   - `floorplan-pdf-overlay-renderer.ts` (`renderPdfWithOverlays`, raster branch)
 *
 * Both call sites now compute a `FitTransform` and delegate to the helpers
 * exported here. All polygon-draw, color, highlight, and Y-flip logic lives
 * in ONE place.
 *
 * Coordinate convention (Y-UP, CAD-style — matches DXF Viewer editor):
 *   - Polygon vertices live in world space `{x, y}` with Y=0 at bottom.
 *   - `worldToScreen` flips Y: `screenY = offsetY + (bounds.max.y - vy) * scale`.
 *
 * @module components/shared/files/media/overlay-polygon-renderer
 * @enterprise ADR-340 §3.6 — unified overlay rendering across all formats
 */

import type { PanOffset } from '@/hooks/useZoomPan';
import type { FloorOverlayItem } from '@/hooks/useFloorOverlays';
import { getStatusColors } from '@/subapps/dxf-viewer/config/color-mapping';
import { UI_COLORS, withOpacity, OVERLAY_OPACITY } from '@/subapps/dxf-viewer/config/color-config';

// ============================================================================
// TYPES
// ============================================================================

export interface SceneBounds {
  min: { x: number; y: number };
  max: { x: number; y: number };
}

export interface FitTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface RenderOptions {
  highlightedUnitId?: string | null;
  /** Stroke width when not highlighted. Default: 3. */
  strokeWidth?: number;
  /** Stroke width when highlighted. Default: 4. */
  strokeWidthHighlighted?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Fallback colors when no status / unlinked — ADR-258 SSoT opacity */
export const OVERLAY_FALLBACK = {
  stroke: UI_COLORS.DARK_GRAY,
  fill: withOpacity(UI_COLORS.DARK_GRAY, OVERLAY_OPACITY.MUTED),
} as const;

// ============================================================================
// COORDINATE TRANSFORM
// ============================================================================

/**
 * Compute the fit-and-center transform for any rectangular bounds.
 * Mirrors the math used by both `renderDxfToCanvas` (DXF branch) and
 * the raster (PDF/Image) renderer: aspect-fit + center + zoom + pan.
 */
export function computeFitTransform(
  canvasW: number,
  canvasH: number,
  bounds: SceneBounds,
  zoom: number = 1,
  pan: PanOffset = { x: 0, y: 0 },
): FitTransform {
  const drawingWidth = bounds.max.x - bounds.min.x;
  const drawingHeight = bounds.max.y - bounds.min.y;
  const baseScale = Math.min(canvasW / drawingWidth, canvasH / drawingHeight);
  const scale = baseScale * zoom;
  return {
    scale,
    offsetX: (canvasW - drawingWidth * scale) / 2 + pan.x,
    offsetY: (canvasH - drawingHeight * scale) / 2 + pan.y,
  };
}

/** Build a `SceneBounds` for a raster source whose origin is `(0, 0)`. */
export function rectBoundsToScene(width: number, height: number): SceneBounds {
  return { min: { x: 0, y: 0 }, max: { x: width, y: height } };
}

/** World vertex → canvas pixel (Y-UP convention; Y is flipped against bounds.max.y). */
export function worldToScreen(
  vx: number,
  vy: number,
  bounds: SceneBounds,
  fit: FitTransform,
): { x: number; y: number } {
  return {
    x: (vx - bounds.min.x) * fit.scale + fit.offsetX,
    y: (bounds.max.y - vy) * fit.scale + fit.offsetY,
  };
}

/** Canvas pixel → world vertex (inverse of `worldToScreen`). */
export function screenToWorld(
  sx: number,
  sy: number,
  bounds: SceneBounds,
  fit: FitTransform,
): { x: number; y: number } {
  return {
    x: (sx - fit.offsetX) / fit.scale + bounds.min.x,
    y: bounds.max.y - (sy - fit.offsetY) / fit.scale,
  };
}

// ============================================================================
// POLYGON RENDERING — SSoT
// ============================================================================

/**
 * Render ONE overlay polygon. Caller is responsible for `ctx.save()/restore()`
 * if they want to isolate state. Skips polygons with < 3 vertices.
 */
export function renderOverlayPolygon(
  ctx: CanvasRenderingContext2D,
  overlay: FloorOverlayItem,
  bounds: SceneBounds,
  fit: FitTransform,
  isHighlighted: boolean,
  strokeWidth: number = 3,
  strokeWidthHighlighted: number = 4,
): void {
  if (overlay.polygon.length < 3) return;

  // ADR-258D: Dynamic coloring via resolvedStatus
  const colors = getStatusColors(overlay.resolvedStatus) ?? OVERLAY_FALLBACK;

  // ADR-258D: No fill on normal, fill on hover only (stroke-only base)
  ctx.fillStyle = isHighlighted
    ? withOpacity(colors.stroke, OVERLAY_OPACITY.GALLERY_FILL)
    : 'transparent';
  ctx.strokeStyle = colors.stroke;
  ctx.lineWidth = isHighlighted ? strokeWidthHighlighted : strokeWidth;

  ctx.beginPath();
  overlay.polygon.forEach((vertex, i) => {
    const s = worldToScreen(vertex.x, vertex.y, bounds, fit);
    if (i === 0) ctx.moveTo(s.x, s.y);
    else ctx.lineTo(s.x, s.y);
  });
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/**
 * Render a list of overlay polygons. Wraps `save()/restore()` and iterates.
 * Highlighted overlay (matching `highlightedUnitId.linked.propertyId`) draws
 * with translucent fill + thicker stroke.
 */
export function renderOverlayPolygons(
  ctx: CanvasRenderingContext2D,
  overlays: ReadonlyArray<FloorOverlayItem>,
  bounds: SceneBounds,
  fit: FitTransform,
  options: RenderOptions = {},
): void {
  if (overlays.length === 0) return;
  const { highlightedUnitId, strokeWidth = 3, strokeWidthHighlighted = 4 } = options;

  ctx.save();
  for (const overlay of overlays) {
    const isHighlighted = !!(highlightedUnitId && overlay.linked?.propertyId === highlightedUnitId);
    renderOverlayPolygon(ctx, overlay, bounds, fit, isHighlighted, strokeWidth, strokeWidthHighlighted);
  }
  ctx.restore();
}
