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

/**
 * In-polygon label drawn ONLY on the highlighted overlay (hover state).
 * Caller pre-formats strings with i18n + currency formatter — the renderer
 * is locale-agnostic.
 */
export interface OverlayLabel {
  /** Top line — small (e.g. property code). */
  primaryText?: string;
  /** Middle line — small (e.g. "85 τ.μ."). */
  secondaryText?: string;
  /** Bottom line — emphasized / larger (e.g. "€ 150.000"). */
  emphasisText?: string;
}

export interface RenderOptions {
  highlightedUnitId?: string | null;
  /** Stroke width when not highlighted. Default: 3. */
  strokeWidth?: number;
  /** Stroke width when highlighted. Default: 4. */
  strokeWidthHighlighted?: number;
  /**
   * Resolver for the in-polygon label drawn ONLY on the highlighted overlay.
   * Returns null/undefined to skip text rendering for this overlay.
   */
  getLabel?: (overlay: FloorOverlayItem) => OverlayLabel | null | undefined;
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
 * with translucent fill + thicker stroke + optional in-polygon label.
 */
export function renderOverlayPolygons(
  ctx: CanvasRenderingContext2D,
  overlays: ReadonlyArray<FloorOverlayItem>,
  bounds: SceneBounds,
  fit: FitTransform,
  options: RenderOptions = {},
): void {
  if (overlays.length === 0) return;
  const {
    highlightedUnitId,
    strokeWidth = 3,
    strokeWidthHighlighted = 4,
    getLabel,
  } = options;

  ctx.save();
  // Pass 1 — fill + stroke
  for (const overlay of overlays) {
    const isHighlighted = !!(highlightedUnitId && overlay.linked?.propertyId === highlightedUnitId);
    renderOverlayPolygon(ctx, overlay, bounds, fit, isHighlighted, strokeWidth, strokeWidthHighlighted);
  }
  // Pass 2 — labels on top of strokes (only highlighted overlay, only if resolver returns one)
  if (getLabel) {
    for (const overlay of overlays) {
      const isHighlighted = !!(highlightedUnitId && overlay.linked?.propertyId === highlightedUnitId);
      if (!isHighlighted) continue;
      const label = getLabel(overlay);
      if (!label) continue;
      renderOverlayLabel(ctx, overlay, bounds, fit, label);
    }
  }
  ctx.restore();
}

// ============================================================================
// LABEL RENDERING
// ============================================================================

const LABEL_FONT_FAMILY =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const LABEL_BASE_FONT_PX = 16;
const LABEL_EMPHASIS_FONT_PX = 24;
const LABEL_LINE_GAP_PX = 6;

/** Compute screen-space centroid of an overlay polygon (vertex average). */
function polygonScreenCentroid(
  overlay: FloorOverlayItem,
  bounds: SceneBounds,
  fit: FitTransform,
): { x: number; y: number } | null {
  if (overlay.polygon.length < 3) return null;
  let sx = 0;
  let sy = 0;
  for (const v of overlay.polygon) {
    const s = worldToScreen(v.x, v.y, bounds, fit);
    sx += s.x;
    sy += s.y;
  }
  return { x: sx / overlay.polygon.length, y: sy / overlay.polygon.length };
}

/**
 * Draw a 3-line label centered at the polygon centroid. Lines that are empty
 * are skipped (so a 2-line label still centers cleanly).
 *
 * Visuals:
 *   - White text with 3px black stroke (outline) for max readability against
 *     any fill/background color.
 *   - Top + middle line: regular 12px.
 *   - Bottom (emphasis) line: bold 18px — used for the headline value
 *     (sale price in the FloorplanGallery use case).
 */
function renderOverlayLabel(
  ctx: CanvasRenderingContext2D,
  overlay: FloorOverlayItem,
  bounds: SceneBounds,
  fit: FitTransform,
  label: OverlayLabel,
): void {
  const center = polygonScreenCentroid(overlay, bounds, fit);
  if (!center) return;

  const lines: Array<{ text: string; sizePx: number; bold: boolean }> = [];
  if (label.primaryText) lines.push({ text: label.primaryText, sizePx: LABEL_BASE_FONT_PX, bold: false });
  if (label.secondaryText) lines.push({ text: label.secondaryText, sizePx: LABEL_BASE_FONT_PX, bold: false });
  if (label.emphasisText) lines.push({ text: label.emphasisText, sizePx: LABEL_EMPHASIS_FONT_PX, bold: true });
  if (lines.length === 0) return;

  const totalHeight =
    lines.reduce((acc, l) => acc + l.sizePx, 0) + LABEL_LINE_GAP_PX * (lines.length - 1);
  let cursorY = center.y - totalHeight / 2;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  // eslint-disable-next-line design-system/no-hardcoded-colors
  ctx.strokeStyle = '#000000';
  // eslint-disable-next-line design-system/no-hardcoded-colors
  ctx.fillStyle = '#FFFFFF';
  ctx.lineJoin = 'round';

  for (const line of lines) {
    const weight = line.bold ? '700' : '500';
    ctx.font = `${weight} ${line.sizePx}px ${LABEL_FONT_FAMILY}`;
    ctx.lineWidth = line.bold ? 4 : 3;
    // Outline first, then fill — outline behind glyph.
    ctx.strokeText(line.text, center.x, cursorY);
    ctx.fillText(line.text, center.x, cursorY);
    cursorY += line.sizePx + LABEL_LINE_GAP_PX;
  }
  ctx.restore();
}
