/**
 * ADR-362 Phase B3 — Ordinate geometry builder.
 *
 * Ordinate dim = perpendicular distance from a datum along ONE axis (X or Y).
 * defPoints semantic: `[featurePoint]` (single point). `axis` selects which
 * coordinate is being read out, `datum` is the user-supplied origin.
 *
 *   - `axis='x'` → measurement = |feature.x - datum.x|; leader extends VERTICAL
 *     (perpendicular to the X readout). Default direction = +Y.
 *   - `axis='y'` → measurement = |feature.y - datum.y|; leader extends HORIZONTAL.
 *     Default direction = +X.
 *
 * AutoCAD convention: ordinate has NO extension lines (only a short tick + leader).
 * We follow the single-arrow pattern from `radial-builder`: `arrowAnchor2 ==
 * arrowAnchor1` and `arrowDirection2 = {x:0,y:0}` signals "no second arrow".
 * Renderer (Phase C1) draws an optional tick at `featurePoint` from style.
 *
 * Reuses `LinearDimGeometry` shape so the renderer can dispatch by `kind:'linear'`
 * without a new variant. `extLine1/2 = null` for ordinates (no ext lines).
 */

import type { Point2D } from '../../../rendering/types/Types';
import type {
  DimStyle,
  OrdinateDimensionEntity,
} from '../../../types/dimension';
import {
  addPoints,
  getUnitVector,
  scalePoint,
  vectorAngle,
} from '../../../rendering/entities/shared/geometry-vector-utils';
import type { LinearDimGeometry } from '../dim-geometry-builder';
import { computeTextRotation } from './shared-geometry-helpers';

const ZERO_VEC: Point2D = { x: 0, y: 0 };
const DEFAULT_LEADER_FACTOR = 8;

/** Default leader endpoint when `entity.textMidpoint` not provided. */
function defaultLeaderEnd(
  feature: Point2D,
  axis: 'x' | 'y',
  leaderLen: number,
): Point2D {
  return axis === 'x'
    ? { x: feature.x, y: feature.y + leaderLen }
    : { x: feature.x + leaderLen, y: feature.y };
}

/**
 * Ordinate dim — leader from `featurePoint` perpendicular to the measured axis,
 * terminating at `entity.textMidpoint` or a style-driven default.
 */
export function buildOrdinateGeometry(
  entity: OrdinateDimensionEntity,
  style: DimStyle,
): LinearDimGeometry {
  const [feature] = entity.defPoints;
  const measurementValue =
    entity.axis === 'x'
      ? Math.abs(feature.x - entity.datum.x)
      : Math.abs(feature.y - entity.datum.y);
  if (measurementValue === 0) {
    throw new Error(
      '[ordinate-builder] Degenerate ordinate dim: feature coincides with datum on measured axis.',
    );
  }
  const defaultLen = style.dimasz * DEFAULT_LEADER_FACTOR;
  const leaderEnd =
    entity.textMidpoint ?? defaultLeaderEnd(feature, entity.axis, defaultLen);
  const leaderDir = getUnitVector(feature, leaderEnd);
  // Text sits past the leader end by DIMGAP along the leader direction.
  const textAnchor = entity.textMidpoint
    ? leaderEnd
    : addPoints(leaderEnd, scalePoint(leaderDir, style.dimgap));
  return {
    kind: 'linear',
    dimLine: { start: feature, end: leaderEnd },
    extLine1: null,
    extLine2: null,
    arrowAnchor1: feature,
    arrowAnchor2: feature,
    arrowDirection1: leaderDir,
    arrowDirection2: ZERO_VEC,
    textAnchor,
    textRotation: computeTextRotation(vectorAngle(leaderDir), style.dimtih),
    measurementValue,
  };
}
