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
 */
export function resolveParallelOffsetDim(
  start: Point2D,
  end: Point2D,
  delta: Point2D,
): ParallelOffsetDim | null {
  const ax = end.x - start.x;
  const ay = end.y - start.y;
  const len = Math.hypot(ax, ay);
  if (len < EPS) return null; // degenerate line — no axis to measure against
  // Unit normal n̂ of the line axis.
  const nx = -ay / len;
  const ny = ax / len;
  // Signed perpendicular component of the translation (distance between the two parallel axes).
  const offset = delta.x * nx + delta.y * ny;
  if (Math.abs(offset) < EPS) return null; // move is along the axis → lines collinear, no gap
  const m0: Point2D = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const p2: Point2D = { x: m0.x + nx * offset, y: m0.y + ny * offset };
  const dimLineRef: Point2D = { x: (m0.x + p2.x) / 2, y: (m0.y + p2.y) / 2 };
  return { p1: m0, p2, dimLineRef, distanceScene: Math.abs(offset) };
}
