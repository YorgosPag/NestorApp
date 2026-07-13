/**
 * SCALE REFERENCE CALC — ADR-348 SSOT
 *
 * Reference mode math: compute scale factors from measured lengths.
 * No reference math exists elsewhere in the scale system.
 *
 * @see ADR-348 §Sub-mode B — Reference
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ScaleToolState } from './ScaleToolStore';

/** Euclidean distance between two world points. */
export function referenceDistance(p1: Point2D, p2: Point2D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Live uniform drag factor (ADR-646 #1 SSoT) — the SAME value the tooltip shows and
 * the click-commit applies, so the WYSIWYG preview cannot diverge from the result.
 *
 * The factor is a ratio relative to the first cursor sample after the base point
 * (`dragRefPoint`, captured by the preview): factor 1 at the drag start, growing as
 * the cursor moves away, shrinking as it moves back — AutoCAD/BricsCAD drag-to-scale.
 * Outside the `direct` sub-phase the typed factor (`currentSx`) is authoritative.
 */
export function computeLiveScale(s: ScaleToolState, cursor: Point2D, basePoint: Point2D): number {
  if (s.subPhase !== 'direct') return s.currentSx;
  if (!s.dragRefPoint) return 1;
  const refLen = referenceDistance(basePoint, s.dragRefPoint);
  if (refLen < 1e-10) return 1;
  return referenceDistance(basePoint, cursor) / refLen;
}

/**
 * Uniform reference: compute scale factor from measured reference → new length.
 * Returns null if reference length is zero (degenerate).
 *
 * Non-uniform reference does NOT need its own helper: the FSM collects each axis
 * sequentially (`ref_p1_x → ref_p2_x → ref_new_x`, then the y triple) and calls
 * this once per axis (`confirmRefNewX` / `confirmRefNewY` in `useScaleTool`), so a
 * combined 6-point variant would never be reached (ADR-646 #7 — removed dead code).
 */
export function computeUniformRef(p1: Point2D, p2: Point2D, newLength: number): number | null {
  const refLen = referenceDistance(p1, p2);
  if (refLen < 1e-10) return null;
  return newLength / refLen;
}
