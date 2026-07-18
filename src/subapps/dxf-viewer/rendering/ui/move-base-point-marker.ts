/**
 * Move base-point marker — the red crosshair (＋) that marks the picked MOVE base point.
 *
 * THE single source for "where is the move base point" visual, shared by BOTH move flows
 * so they look identical (AutoCAD/Revit «base point» glyph):
 *   - the toolbar Move tool (`useMovePreview`, ADR-049)
 *   - the grip-driven move hot-grip / 4-arrow MOVE glyph (`useGripGhostPreview`, ADR-363/640)
 *
 * Drawn in SCREEN space at a fixed pixel size → stays the same on-screen size at every zoom
 * level (annotation-style, like the rotation-pivot ⊙). A plain crosshair (NO ring) distinguishes
 * it at a glance from the rotation centre ⊙ (ring + crosshair) — «move base» vs «rotation centre».
 *
 * Pure draw helper: no React / store deps. The caller owns the canvas + transform.
 *
 * @see rendering/ui/rotation-pivot-marker.ts — the sibling ⊙ (ring + crosshair) for rotation
 */

import type { Point2D, ViewTransform } from '../types/Types';
import { CoordinateTransforms } from '../core/CoordinateTransforms';

/** Crosshair arm length (CSS px) of the move base-point ＋ — fixed on-screen size at any zoom. */
export const MOVE_BASE_POINT_MARKER_SIZE_PX = 8;
/** Base-point colour — red, matching the rotation-pivot crosshair (same «anchor» semantics). */
const MOVE_BASE_POINT_MARKER_COLOR = '#FF4444';
const MOVE_BASE_POINT_MARKER_LINE_WIDTH = 2;

/**
 * Draw the move base-point ＋ (crosshair, no ring) at a WORLD point. The point is projected to
 * screen via the shared `CoordinateTransforms.worldToScreen`, then the glyph is stroked at a fixed
 * pixel size (zoom-stable).
 */
export function drawMoveBasePointMarker(
  ctx: CanvasRenderingContext2D,
  basePointWorld: Point2D,
  transform: ViewTransform,
  viewport: { width: number; height: number },
): void {
  const c = CoordinateTransforms.worldToScreen(basePointWorld, transform, viewport);
  const s = MOVE_BASE_POINT_MARKER_SIZE_PX;
  ctx.save();
  ctx.strokeStyle = MOVE_BASE_POINT_MARKER_COLOR;
  ctx.lineWidth = MOVE_BASE_POINT_MARKER_LINE_WIDTH;
  ctx.beginPath();
  ctx.moveTo(c.x - s, c.y);
  ctx.lineTo(c.x + s, c.y);
  ctx.moveTo(c.x, c.y - s);
  ctx.lineTo(c.x, c.y + s);
  ctx.stroke();
  ctx.restore();
}
