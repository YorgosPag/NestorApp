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
 */
export function computeUniformRef(p1: Point2D, p2: Point2D, newLength: number): number | null {
  const refLen = referenceDistance(p1, p2);
  if (refLen < 1e-10) return null;
  return newLength / refLen;
}

/**
 * Non-uniform reference: compute independent sx, sy factors.
 * Returns null if either reference length is zero.
 */
export function computeNonUniformRef(
  p1x: Point2D, p2x: Point2D, newLenX: number,
  p1y: Point2D, p2y: Point2D, newLenY: number,
): { sx: number; sy: number } | null {
  const refLenX = referenceDistance(p1x, p2x);
  const refLenY = referenceDistance(p1y, p2y);
  if (refLenX < 1e-10 || refLenY < 1e-10) return null;
  return { sx: newLenX / refLenX, sy: newLenY / refLenY };
}
