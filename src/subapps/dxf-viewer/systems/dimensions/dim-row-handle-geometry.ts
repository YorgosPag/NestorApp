/**
 * ADR-362 Round 35 — Dimension row-handle geometry SSoT.
 *
 * Pure math for the «Λαβές Μετακίνησης Σειρών» overlay:
 *   · `computeRowHandleScreenPos` — SCREEN-SPACE docking: the handle sits where the
 *     row's (infinite) dim line crosses a viewport edge (horizontal rows → right
 *     edge, vertical rows → bottom edge), so the handles form a clean column/row
 *     just inside the drawing area regardless of pan/zoom (Giorgio: «στα άκρα της
 *     οθόνης»). Returns `null` when the crossing falls outside the visible band
 *     (row scrolled off-screen → no handle).
 *   · `computeRowGhostSegments` — the drag preview: every dim line of the row
 *     translated by `delta` (world), i.e. exactly where the dim lines will land.
 *   · `projectRowDelta` — constrain a free cursor delta to the row normal, then
 *     apply the shared F9 grip step-snap SSoT (free by default; steps while F9+Q).
 *
 * Reuses the canonical `CoordinateTransforms.worldToScreen` (margins + Y-flip) and
 * the `dim-line-info` frame — no parallel projection or offset math.
 */

import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';
import type { DimensionEntity } from '../../types/dimension';
import { extractDimLineInfo, dimLineOffset, type DimLineInfo } from './dim-line-info';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { applyGripStepSnap } from '../../bim/grips/grip-step-quantize';

/** Screen px reserved on each viewport side (ruler / cut-plane slider chrome). */
export interface EdgeInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/**
 * Default docking clearances. Horizontal rows dock at the RIGHT inner edge, vertical
 * rows at the BOTTOM inner edge; the band-clamp keeps handles off the top/left/bottom
 * rulers (30px, COORDINATE_LAYOUT) and the right-hand 3D cut-plane slider (~48px).
 */
export const DIM_ROW_HANDLE_INSETS: EdgeInsets = {
  top: 40,
  right: 64,
  bottom: 48,
  left: 40,
};

export interface RowHandlePlacement {
  readonly screen: Point2D;
  readonly orientation: 'horizontal' | 'vertical';
}

export interface WorldSegment {
  readonly a: Point2D;
  readonly b: Point2D;
}

/**
 * Screen point where the row's dim line meets its docking edge, or `null` when the
 * line does not cross the visible band. `worldToScreen` is affine, so the on-screen
 * line direction is `(dir.x·scale, −dir.y·scale)` (no second projection needed).
 */
export function computeRowHandleScreenPos(
  info: DimLineInfo,
  transform: ViewTransform,
  viewport: Viewport,
  insets: EdgeInsets = DIM_ROW_HANDLE_INSETS,
): RowHandlePlacement | null {
  const { width, height } = viewport;
  if (!(transform.scale > 0) || width <= 0 || height <= 0) return null;

  const p0 = CoordinateTransforms.worldToScreen(info.dimLineRef, transform, viewport);
  const sdir: Point2D = { x: info.dimDir.x * transform.scale, y: -info.dimDir.y * transform.scale };
  const horizontal = Math.abs(sdir.x) >= Math.abs(sdir.y);

  if (horizontal) {
    if (Math.abs(sdir.x) < 1e-9) return null;
    const targetX = width - insets.right;
    const y = p0.y + ((targetX - p0.x) / sdir.x) * sdir.y;
    if (y < insets.top || y > height - insets.bottom) return null;
    return { screen: { x: targetX, y }, orientation: 'horizontal' };
  }

  if (Math.abs(sdir.y) < 1e-9) return null;
  const targetY = height - insets.bottom;
  const x = p0.x + ((targetY - p0.y) / sdir.y) * sdir.x;
  if (x < insets.left || x > width - insets.right) return null;
  return { screen: { x, y: targetY }, orientation: 'vertical' };
}

/**
 * The row's current dim-line segments (between the extension-line feet), each
 * translated by `delta` — the WYSIWYG ghost of the pending move.
 */
export function computeRowGhostSegments(
  dims: readonly DimensionEntity[],
  delta: Point2D,
): WorldSegment[] {
  const segs: WorldSegment[] = [];
  for (const dim of dims) {
    const info = extractDimLineInfo(dim);
    if (!info) continue;
    const off = dimLineOffset(info);
    const foot = (o: Point2D): Point2D => ({
      x: o.x + info.normal.x * off + delta.x,
      y: o.y + info.normal.y * off + delta.y,
    });
    segs.push({ a: foot(info.originA), b: foot(info.originB) });
  }
  return segs;
}

/**
 * Constrain a free world delta to the row normal (perpendicular move only), then
 * pass through the shared grip step-snap SSoT (`applyGripStepSnap`): free while F9
 * is off or Q is not held, quantized to the SNAP step otherwise — identical to
 * every other 2D grip drag.
 */
export function projectRowDelta(worldDelta: Point2D, normal: Point2D): Point2D {
  const proj = worldDelta.x * normal.x + worldDelta.y * normal.y;
  return applyGripStepSnap({ x: normal.x * proj, y: normal.y * proj });
}
