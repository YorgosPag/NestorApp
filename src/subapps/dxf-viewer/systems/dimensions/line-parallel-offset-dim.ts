/**
 * line-parallel-offset-dim — pure SSoT for the PERPENDICULAR OFFSET dimension shown while
 * MOVING a line by parallel translation (body-drag OR centre-grip). Given the original line
 * endpoints + the translation `delta`, returns the two points of the perpendicular segment
 * between the original axis and the translated (ghost) axis, plus the absolute offset distance.
 *
 * A whole-line move is a pure translation, so the ghost line stays PARALLEL to the original and
 * the perpendicular distance between the two axes is well defined:
 *   offset = delta · n̂        (n̂ = unit normal of the line axis)
 * When the move is ALONG the axis (offset ≈ 0) the two lines are collinear → no dimension.
 *
 * Pure module: zero React / DOM / canvas / units. Scene units in, scene units out. Idempotent.
 *
 * @see canvas-v2/preview-canvas/line-offset-dim-paint.ts — the overlay painter consumer
 * @see canvas-v2/preview-canvas/ghost-face-dim-paint.ts — `paintAlignedOverlayDimension` (draw SSoT)
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md
 */

import type { Point2D } from '../../rendering/types/Types';
// SSoT geometry primitives — μηδέν hand-rolled normal/dot/midpoint/hypot (ADR-065).
import { calculateMidpoint, calculateDistance, translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';
import { getNearestPointOnLine } from '../../rendering/entities/shared/geometry-utils';

export interface ParallelOffsetDim {
  /** Reference point on the ORIGINAL line (its midpoint). */
  readonly p1: Point2D;
  /** Foot of the perpendicular on the GHOST (translated) line. */
  readonly p2: Point2D;
  /** Where the dim line sits — the midpoint of p1→p2, so the dim line coincides with the gap. */
  readonly dimLineRef: Point2D;
  /** Absolute perpendicular distance between the two parallel axes, in scene units. */
  readonly distanceScene: number;
}

/** Below this (scene units) the axis length or the perpendicular offset is treated as zero. */
const EPS = 1e-6;

/**
 * Compute the perpendicular offset dimension of a translated line, or `null` when it does not
 * apply (degenerate line, or a move purely along the axis so the two lines are collinear).
 *
 * The perpendicular distance = the distance from the original midpoint to the GHOST axis (the
 * original translated by `delta`, which stays parallel), via the shared projection SSoT.
 */
export function resolveParallelOffsetDim(
  start: Point2D,
  end: Point2D,
  delta: Point2D,
): ParallelOffsetDim | null {
  if (calculateDistance(start, end) < EPS) return null; // degenerate line — no axis to measure against
  const p1 = calculateMidpoint(start, end); // μέσο αρχικής
  // Ghost axis = original translated by delta (stays parallel to the original).
  const ghostStart: Point2D = translatePoint(start, delta);
  const ghostEnd: Point2D = translatePoint(end, delta);
  // Foot of the perpendicular from the original midpoint onto the (infinite) ghost axis.
  const p2 = getNearestPointOnLine(p1, ghostStart, ghostEnd, false);
  const distanceScene = calculateDistance(p1, p2);
  if (distanceScene < EPS) return null; // move is along the axis → lines collinear, no gap
  const dimLineRef = calculateMidpoint(p1, p2);
  return { p1, p2, dimLineRef, distanceScene };
}
