/**
 * GUIDE MARKERS RENDERER — Construction points & intersection markers
 *
 * Renders snap points (✕/+ markers) and guide intersection markers.
 * Extracted from GuideRenderer (ADR-065).
 *
 * @module systems/guides/guide-markers-renderer
 * @see guide-renderer.ts (orchestrator)
 */

import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';
import type { Guide, ConstructionPoint } from './guide-types';
import { HOVER_HIGHLIGHT } from '../../config/color-config';
import { pixelPerfect } from '../../rendering/entities/shared/geometry-rendering-utils';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Small ✕ size in pixels */
const MARKER_SIZE = 4;
/** Size of construction point markers in pixels */
const CONSTRUCTION_POINT_SIZE = 5;

// ============================================================================
// CONSTRUCTION POINT RENDERING (ADR-189 §3.7-3.16)
// ============================================================================

/**
 * Render construction snap points (X markers) onto the canvas.
 * Called after guide lines — points render on top of guides.
 */
export function renderConstructionPoints(
  ctx: CanvasRenderingContext2D,
  points: readonly ConstructionPoint[],
  transform: ViewTransform,
  viewport: Viewport,
  highlightedPointId?: string | null,
  snappedPointId?: string | null,
): void {
  if (points.length === 0) return;

  const { CoordinateTransforms: CT } = require('../../rendering/core/CoordinateTransforms');
  const size = CONSTRUCTION_POINT_SIZE;

  ctx.save();
  ctx.setLineDash([]);
  ctx.lineWidth = 1;

  for (const cpt of points) {
    if (!cpt.visible) continue;

    const screen: Point2D = CT.worldToScreen(cpt.point, transform, viewport);
    const sx = screen.x;
    const sy = screen.y;

    // Skip if off-screen
    if (sx < -size || sx > viewport.width + size) continue;
    if (sy < -size || sy > viewport.height + size) continue;

    const px = pixelPerfect(sx);
    const py = pixelPerfect(sy);
    const isHighlighted = cpt.id === highlightedPointId;
    const isSnapped = cpt.id === snappedPointId;

    drawConstructionPointMarker(ctx, px, py, size, isHighlighted, isSnapped);
  }

  ctx.restore();
}

/**
 * Draw a single construction point marker.
 * - Default: ✕ (X shape) in white
 * - Highlighted: ✕ in gold with glow (delete hover)
 * - Snapped: + (plus shape) in white — §3.5 UX feedback
 */
function drawConstructionPointMarker(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  size: number,
  highlighted: boolean,
  snapped: boolean,
): void {
  if (highlighted) {
    ctx.strokeStyle = HOVER_HIGHLIGHT.GUIDE.glowColor;
    ctx.globalAlpha = HOVER_HIGHLIGHT.GUIDE.opacity;
    ctx.shadowColor = HOVER_HIGHLIGHT.GUIDE.glowColor;
    ctx.shadowBlur = HOVER_HIGHLIGHT.GUIDE.shadowBlur;
    ctx.lineWidth = 1.5;
  } else {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.globalAlpha = 1;
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1;
  }

  ctx.beginPath();

  if (snapped) {
    ctx.moveTo(px - size, py);
    ctx.lineTo(px + size, py);
    ctx.moveTo(px, py - size);
    ctx.lineTo(px, py + size);
  } else {
    ctx.moveTo(px - size, py - size);
    ctx.lineTo(px + size, py + size);
    ctx.moveTo(px + size, py - size);
    ctx.lineTo(px - size, py + size);
  }

  ctx.stroke();

  if (highlighted) {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }
}

// ============================================================================
// INTERSECTION MARKERS
// ============================================================================

/**
 * Draw small ✕ markers at every intersection of X and Y guides.
 */
export function drawIntersectionMarkers(
  ctx: CanvasRenderingContext2D,
  xPositions: readonly number[],
  yPositions: readonly number[],
  viewport: Viewport,
): void {
  const size = MARKER_SIZE;

  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.globalAlpha = 1;
  ctx.lineWidth = 0.8;

  for (const sx of xPositions) {
    if (sx < -size || sx > viewport.width + size) continue;

    for (const sy of yPositions) {
      if (sy < -size || sy > viewport.height + size) continue;

      const px = pixelPerfect(sx);
      const py = pixelPerfect(sy);
      ctx.beginPath();
      ctx.moveTo(px - size, py - size);
      ctx.lineTo(px + size, py + size);
      ctx.moveTo(px + size, py - size);
      ctx.lineTo(px - size, py + size);
      ctx.stroke();
    }
  }
}

/**
 * Draw intersection markers where diagonal guides cross axis-aligned guides.
 */
export function drawDiagonalIntersectionMarkers(
  ctx: CanvasRenderingContext2D,
  diagonals: Array<{ guide: Guide; screenStart: Point2D; screenEnd: Point2D }>,
  xScreenPositions: readonly number[],
  yScreenPositions: readonly number[],
  viewport: Viewport,
): void {
  const size = MARKER_SIZE;

  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.globalAlpha = 1;
  ctx.lineWidth = 0.8;

  for (const { screenStart: s, screenEnd: e } of diagonals) {
    const dx = e.x - s.x;
    const dy = e.y - s.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) continue;

    // Intersection with vertical (X) guides
    for (const xPos of xScreenPositions) {
      if (Math.abs(dx) < 0.001) continue;
      const t = (xPos - s.x) / dx;
      if (t < 0 || t > 1) continue;
      const iy = s.y + t * dy;
      if (iy < -size || iy > viewport.height + size) continue;

      const px = pixelPerfect(xPos);
      const py = pixelPerfect(iy);
      ctx.beginPath();
      ctx.moveTo(px - size, py - size);
      ctx.lineTo(px + size, py + size);
      ctx.moveTo(px + size, py - size);
      ctx.lineTo(px - size, py + size);
      ctx.stroke();
    }

    // Intersection with horizontal (Y) guides
    for (const yPos of yScreenPositions) {
      if (Math.abs(dy) < 0.001) continue;
      const t = (yPos - s.y) / dy;
      if (t < 0 || t > 1) continue;
      const ix = s.x + t * dx;
      if (ix < -size || ix > viewport.width + size) continue;

      const px = pixelPerfect(ix);
      const py = pixelPerfect(yPos);
      ctx.beginPath();
      ctx.moveTo(px - size, py - size);
      ctx.lineTo(px + size, py + size);
      ctx.moveTo(px + size, py - size);
      ctx.lineTo(px - size, py + size);
      ctx.stroke();
    }
  }
}
