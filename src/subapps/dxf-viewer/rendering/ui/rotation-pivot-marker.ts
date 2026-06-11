/**
 * Rotation-pivot marker — the ⊙ glyph that marks the picked rotation CENTRE.
 *
 * THE single source for "where is the rotation pivot" visual, shared by BOTH
 * rotation flows so they look identical (Revit «rotation centre» glyph):
 *   - the toolbar Rotate tool (`useRotationPreview`, ADR-188)
 *   - the grip-driven 6-click ROTATE→Reference (`useGripGhostPreview`, ADR-397)
 *
 * Drawn in SCREEN space at a fixed pixel size → stays the same on-screen size at
 * every zoom level (annotation-style, like the 3D base-point marker ⊙). A ring +
 * crosshair reads unambiguously as "this is the centre of rotation" the moment the
 * user clicks to set it.
 *
 * Pure draw helper: no React / store deps. The caller owns the canvas + transform.
 *
 * @see bim-3d/gizmo/bim-gizmo-overlay-markers.ts — the 3D sibling ⊙ (createBasePointMarker)
 */

import type { Point2D, ViewTransform } from '../types/Types';
import { CoordinateTransforms } from '../core/CoordinateTransforms';

/** Ring radius (CSS px) of the pivot ⊙ — fixed on-screen size at any zoom. */
export const ROTATION_PIVOT_MARKER_RADIUS_PX = 8;
/** Crosshair arm length = radius × this factor (mirror of the 3D `BASE_POINT_MARKER_CROSS_FACTOR`). */
const PIVOT_CROSS_FACTOR = 1.4;
/** Pivot colour — red, matching the legacy tool-rotate base-point crosshair. */
const PIVOT_MARKER_COLOR = '#FF4444';
const PIVOT_MARKER_LINE_WIDTH = 2;

/**
 * Draw the rotation-pivot ⊙ (ring + crosshair) at a WORLD point. The point is
 * projected to screen via the shared `CoordinateTransforms.worldToScreen`, then the
 * glyph is stroked at a fixed pixel size (zoom-stable).
 */
export function drawRotationPivotMarker(
  ctx: CanvasRenderingContext2D,
  pivotWorld: Point2D,
  transform: ViewTransform,
  viewport: { width: number; height: number },
): void {
  const c = CoordinateTransforms.worldToScreen(pivotWorld, transform, viewport);
  const r = ROTATION_PIVOT_MARKER_RADIUS_PX;
  const arm = r * PIVOT_CROSS_FACTOR;
  ctx.save();
  ctx.strokeStyle = PIVOT_MARKER_COLOR;
  ctx.lineWidth = PIVOT_MARKER_LINE_WIDTH;
  // Ring
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.stroke();
  // Crosshair
  ctx.beginPath();
  ctx.moveTo(c.x - arm, c.y);
  ctx.lineTo(c.x + arm, c.y);
  ctx.moveTo(c.x, c.y - arm);
  ctx.lineTo(c.x, c.y + arm);
  ctx.stroke();
  ctx.restore();
}
