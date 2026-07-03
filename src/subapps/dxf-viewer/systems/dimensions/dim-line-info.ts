/**
 * ADR-362 — Linear/aligned dim-line geometry SSoT.
 *
 * ONE place that derives, from a linear/aligned `DimensionEntity`, the dim-line
 * axis + normal + signed perpendicular offset. Shared by the DIMSPACE engine
 * (`dim-space-engine`) and the row detector (`dim-row-detect`) so both agree on
 * what "the same dim line" means — no duplicated `defPoints` math.
 *
 * `defPoints` semantics (linear/aligned): [extOrigin1, extOrigin2, dimLineRef].
 */

import type { DimensionEntity } from '../../types/dimension';
import type { Point2D } from '../../rendering/types/Types';

/** Dim-line frame extracted from a linear/aligned dim's `defPoints`. */
export interface DimLineInfo {
  originA: Point2D;
  originB: Point2D;
  dimLineRef: Point2D;
  /** Unit direction along the dim line (from originA toward originB). */
  dimDir: Point2D;
  /** Unit normal, oriented from the ext origins toward the dim-line side. */
  normal: Point2D;
}

/**
 * Extract the dim-line frame, or `null` when the dim is not linear/aligned or
 * has degenerate (coincident) extension origins.
 */
export function extractDimLineInfo(dim: DimensionEntity): DimLineInfo | null {
  if (dim.dimensionType !== 'linear' && dim.dimensionType !== 'aligned') {
    return null;
  }
  const pts = dim.defPoints;
  if (pts.length < 3) return null;

  const [originA, originB, dimLineRef] = pts;

  const dx = originB.x - originA.x;
  const dy = originB.y - originA.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-9) return null;

  const dimDir: Point2D = { x: dx / len, y: dy / len };
  // Normal = perpendicular, oriented toward the dimLineRef side.
  const rawNx = -dy / len;
  const rawNy = dx / len;
  const toDimLine: Point2D = {
    x: dimLineRef.x - originA.x,
    y: dimLineRef.y - originA.y,
  };
  const sign = rawNx * toDimLine.x + rawNy * toDimLine.y >= 0 ? 1 : -1;
  const normal: Point2D = { x: rawNx * sign, y: rawNy * sign };

  return { originA, originB, dimLineRef, dimDir, normal };
}

/**
 * Signed perpendicular distance from `originA` to `dimLineRef` along `normal`
 * (always ≥ 0 by the normal's orientation, but kept signed for arithmetic).
 */
export function dimLineOffset(info: DimLineInfo): number {
  const dx = info.dimLineRef.x - info.originA.x;
  const dy = info.dimLineRef.y - info.originA.y;
  return dx * info.normal.x + dy * info.normal.y;
}
