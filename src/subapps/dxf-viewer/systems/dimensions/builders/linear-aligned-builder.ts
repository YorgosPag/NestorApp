/**
 * ADR-362 Phase B1 — Linear + Aligned geometry builders.
 *
 * Pure functions computing `DimGeometry` for the two simplest dim variants:
 *   - Linear: dim line at user-specified `rotation` (0=horizontal). Ext lines
 *     perpendicular to the dim line by default, tilted by `obliqueAngle` when
 *     set (AutoCAD DIMEDIT Oblique behaviour: 0=perpendicular here).
 *   - Aligned: dim line parallel to the segment extOrigin1→extOrigin2.
 *
 * `defPoints` semantic (both variants):
 *   [0] extOrigin1 — first feature point being measured
 *   [1] extOrigin2 — second feature point
 *   [2] dimLineRef — any point on the dim line (defines its offset distance
 *                    from the ext origins)
 *
 * All math reuses helpers from `geometry-vector-utils.ts` — no duplicates.
 */

import type { Point2D } from '../../../rendering/types/Types';
import type {
  AlignedDimensionEntity,
  DimStyle,
  LinearDimensionEntity,
} from '../../../types/dimension';
import {
  addPoints,
  calculateDistance,
  dotProduct,
  getUnitVector,
  scalePoint,
  subtractPoints,
  vectorAngle,
} from '../../../rendering/entities/shared/geometry-vector-utils';
import type { DimGeometry, DimLineSegment } from '../dim-geometry-builder';

const DEG_TO_RAD = Math.PI / 180;
const HALF_PI = Math.PI / 2;
/** Below this magnitude the line-line intersection denominator is treated as zero. */
const COLINEAR_EPSILON = 1e-12;

// ──────────────────────────────────────────────────────────────────────────────
// Shared helpers (kept module-local until a 3rd variant needs them — Phase B2/B3
// will lift them into `builders/shared-geometry-helpers.ts` if reused there)
// ──────────────────────────────────────────────────────────────────────────────

/** Rotate a 2D vector by `angleRad` (CCW). */
function rotateVector(v: Point2D, angleRad: number): Point2D {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

/**
 * Intersection of two infinite lines, each given by a point + direction vector.
 * Returns `null` when lines are parallel/colinear (denominator below epsilon).
 */
function intersectLines(
  p1: Point2D,
  d1: Point2D,
  p2: Point2D,
  d2: Point2D,
): Point2D | null {
  const denom = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(denom) < COLINEAR_EPSILON) return null;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const t = (dx * d2.y - dy * d2.x) / denom;
  return { x: p1.x + t * d1.x, y: p1.y + t * d1.y };
}

/**
 * Build an extension line segment from `origin` toward `foot` (the dim-line
 * intersection): starts after the DIMEXO gap and ends DIMEXE past the dim line.
 * Returns `null` when origin coincides with foot (degenerate, no direction).
 */
function buildExtLine(
  origin: Point2D,
  foot: Point2D,
  dimexo: number,
  dimexe: number,
): DimLineSegment | null {
  const distance = calculateDistance(origin, foot);
  if (distance === 0) return null;
  const dir = getUnitVector(origin, foot);
  return {
    start: addPoints(origin, scalePoint(dir, dimexo)),
    end: addPoints(foot, scalePoint(dir, dimexe)),
  };
}

/** Default text anchor = midpoint of the dim line span; entity may override. */
function computeTextAnchor(
  start: Point2D,
  end: Point2D,
  override: Point2D | undefined,
): Point2D {
  if (override) return override;
  return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
}

/**
 * Text rotation rule:
 *   - DIMTIH=true (text always horizontal inside) → 0
 *   - DIMTIH=false (text aligned with dim line) → dim-line angle, flipped by π
 *     when it would otherwise read upside-down (|angle| > π/2).
 *
 * `textRotation` override on the entity is the renderer's concern — this
 * function is the *computed* fallback.
 */
function computeTextRotation(dimLineAngleRad: number, dimtih: boolean): number {
  if (dimtih) return 0;
  let a = dimLineAngleRad;
  if (a > HALF_PI) a -= Math.PI;
  else if (a <= -HALF_PI) a += Math.PI;
  return a;
}

/**
 * Standard perpendicular to a dim-line axis (CCW 90°). Used as default ext-line
 * direction when no oblique angle applies.
 */
function perpendicularOf(axis: Point2D): Point2D {
  return { x: -axis.y, y: axis.x };
}

/**
 * Common back-half of both builders: given the two foot points (where the dim
 * line meets the ext-line projections), the ext-line direction (per origin),
 * the measurement value, and the style, assemble the final `DimGeometry`.
 */
function assembleGeometry(
  entity: LinearDimensionEntity | AlignedDimensionEntity,
  style: DimStyle,
  extOrigin1: Point2D,
  extOrigin2: Point2D,
  foot1: Point2D,
  foot2: Point2D,
  measurementValue: number,
): DimGeometry {
  const arrowDirection1 = getUnitVector(foot2, foot1);
  const arrowDirection2 = getUnitVector(foot1, foot2);
  const textAnchor = computeTextAnchor(foot1, foot2, entity.textMidpoint);
  const textRotation = computeTextRotation(
    vectorAngle(subtractPoints(foot2, foot1)),
    style.dimtih,
  );
  const extLine1 = style.suppressExtLine1
    ? null
    : buildExtLine(extOrigin1, foot1, style.dimexo, style.dimexe);
  const extLine2 = style.suppressExtLine2
    ? null
    : buildExtLine(extOrigin2, foot2, style.dimexo, style.dimexe);
  return {
    dimLine: { start: foot1, end: foot2 },
    extLine1,
    extLine2,
    arrowAnchor1: foot1,
    arrowAnchor2: foot2,
    arrowDirection1,
    arrowDirection2,
    textAnchor,
    textRotation,
    measurementValue,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Public builders
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Linear dim — dim line aligned with WCS X axis rotated by `entity.rotation`
 * (degrees). Ext lines perpendicular to the dim line by default; when
 * `obliqueAngle` is set, they tilt by that amount (0 = perpendicular).
 *
 * Foot = intersection of (line through ext origin in ext-line direction) with
 * (dim line through `dimLineRef` in axis direction). Measurement = distance
 * between the two feet (= projection length along the rotated axis).
 */
export function buildLinearGeometry(
  entity: LinearDimensionEntity,
  style: DimStyle,
): DimGeometry {
  const [extOrigin1, extOrigin2, dimLineRef] = entity.defPoints;
  const rotRad = entity.rotation * DEG_TO_RAD;
  const axis: Point2D = { x: Math.cos(rotRad), y: Math.sin(rotRad) };
  const perp = perpendicularOf(axis);
  const obliqueRad = (entity.obliqueAngle ?? 0) * DEG_TO_RAD;
  const extDir = obliqueRad === 0 ? perp : rotateVector(perp, obliqueRad);

  const foot1 = intersectLines(extOrigin1, extDir, dimLineRef, axis);
  const foot2 = intersectLines(extOrigin2, extDir, dimLineRef, axis);
  if (!foot1 || !foot2) {
    throw new Error(
      '[linear-aligned-builder] Degenerate linear dim: ext direction parallel to dim line axis.',
    );
  }
  const measurementValue = Math.abs(
    dotProduct(subtractPoints(extOrigin2, extOrigin1), axis),
  );
  return assembleGeometry(
    entity,
    style,
    extOrigin1,
    extOrigin2,
    foot1,
    foot2,
    measurementValue,
  );
}

/**
 * Aligned dim — dim line parallel to extOrigin1→extOrigin2. Ext lines
 * perpendicular to that direction. Measurement = raw distance between ext
 * origins. Throws when ext origins coincide (no aligned direction defined).
 */
export function buildAlignedGeometry(
  entity: AlignedDimensionEntity,
  style: DimStyle,
): DimGeometry {
  const [extOrigin1, extOrigin2, dimLineRef] = entity.defPoints;
  const measurementValue = calculateDistance(extOrigin1, extOrigin2);
  if (measurementValue === 0) {
    throw new Error(
      '[linear-aligned-builder] Degenerate aligned dim: ext origins coincide.',
    );
  }
  const axis = getUnitVector(extOrigin1, extOrigin2);
  const perp = perpendicularOf(axis);
  const signedOffset = dotProduct(subtractPoints(dimLineRef, extOrigin1), perp);
  const foot1 = addPoints(extOrigin1, scalePoint(perp, signedOffset));
  const foot2 = addPoints(extOrigin2, scalePoint(perp, signedOffset));
  return assembleGeometry(
    entity,
    style,
    extOrigin1,
    extOrigin2,
    foot1,
    foot2,
    measurementValue,
  );
}
