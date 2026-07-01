/**
 * ADR-362 Phase B1 — Linear + Aligned geometry builders.
 *
 * Pure functions computing `LinearDimGeometry` for the two simplest dim variants:
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
 * Phase B2 refactor: extracted shared math (`rotateVector`, `intersectLines`,
 * `perpendicularOf`, `computeTextAnchor`, `computeTextRotation`) into
 * `./shared-geometry-helpers.ts` so angular/radial builders can reuse them.
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
import type { DimLineSegment, LinearDimGeometry } from '../dim-geometry-builder';
import {
  computeTextAnchor,
  computeTextRotation,
  intersectLines,
  perpendicularOf,
  rotateVector,
} from './shared-geometry-helpers';

const DEG_TO_RAD = Math.PI / 180;

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

/**
 * Common back-half of both builders: given the two foot points (where the dim
 * line meets the ext-line projections), assemble the final `LinearDimGeometry`.
 */
function assembleGeometry(
  entity: LinearDimensionEntity | AlignedDimensionEntity,
  style: DimStyle,
  extOrigin1: Point2D,
  extOrigin2: Point2D,
  foot1: Point2D,
  foot2: Point2D,
  measurementValue: number,
): LinearDimGeometry {
  const arrowDirection1 = getUnitVector(foot2, foot1);
  const arrowDirection2 = getUnitVector(foot1, foot2);
  const textAnchor = computeTextAnchor(foot1, foot2, entity.textMidpoint);
  const textRotation = computeTextRotation(
    vectorAngle(subtractPoints(foot2, foot1)),
    style.dimtih,
    entity.textRotation,
  );
  const extLine1 = style.suppressExtLine1
    ? null
    : buildExtLine(extOrigin1, foot1, style.dimexo, style.dimexe);
  const extLine2 = style.suppressExtLine2
    ? null
    : buildExtLine(extOrigin2, foot2, style.dimexo, style.dimexe);
  return {
    kind: 'linear',
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

/**
 * Linear dim — dim line aligned with WCS X axis rotated by `entity.rotation`
 * (degrees). Ext lines perpendicular to the dim line by default; when
 * `obliqueAngle` is set, they tilt by that amount (0 = perpendicular).
 */
export function buildLinearGeometry(
  entity: LinearDimensionEntity,
  style: DimStyle,
): LinearDimGeometry {
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
 * perpendicular to that direction. Throws when ext origins coincide.
 */
export function buildAlignedGeometry(
  entity: AlignedDimensionEntity,
  style: DimStyle,
): LinearDimGeometry {
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
