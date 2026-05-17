/**
 * ADR-362 Phase B2 — Angular geometry builders (2-line + 3-point).
 *
 * Both variants produce an `AngularDimGeometry` whose main "dim line" is an
 * ARC centred at the angle vertex with radius = distance(vertex, arcPoint).
 *
 * `defPoints` semantics:
 *   - Angular2L: `[line1.a, line1.b, line2.a, line2.b, arcPoint]`
 *   - Angular3P: `[vertex, ray1End, ray2End, arcPoint]`
 *
 * Conventions:
 *   - `arcStartAngle` corresponds to ray1, `arcEndAngle` to ray2 (unwrapped:
 *     `arcEndAngle = arcStartAngle + signedSweep`, sign tells CCW/CW).
 *   - `measurementValue` = |signedSweep| in **radians**.
 *   - Ext lines bridge from the line endpoint (offset by DIMEXO) to the arc
 *     tangent point on the same ray (overshoot by DIMEXE). Suppressed when
 *     the endpoint already lies on/past the arc.
 *   - Arrow direction = tangent OUTWARD (away from arc interior).
 */

import type { Point2D } from '../../../rendering/types/Types';
import type {
  Angular2LDimensionEntity,
  Angular3PDimensionEntity,
  DimStyle,
} from '../../../types/dimension';
import {
  addPoints,
  calculateDistance,
  dotProduct,
  getUnitVector,
  pointOnCircle,
  scalePoint,
  subtractPoints,
  vectorAngle,
} from '../../../rendering/entities/shared/geometry-vector-utils';
import { normalizeAngleDiff } from '../../../rendering/entities/shared/geometry-angle-utils';
import type {
  AngularDimGeometry,
  DimLineSegment,
} from '../dim-geometry-builder';
import {
  computeTextRotation,
  intersectLines,
} from './shared-geometry-helpers';

const TAU = Math.PI * 2;
const HALF_PI = Math.PI / 2;

interface ArcCore {
  arcStartAngle: number;
  arcEndAngle: number;
  signedSweep: number;
  sweepSign: number;
}

/**
 * Pick the line endpoint on the same side of the vertex as the arc point —
 * standard CAD convention for which ray of the line is being measured.
 */
function pickRayEndpoint(
  vertex: Point2D,
  p1: Point2D,
  p2: Point2D,
  arcPoint: Point2D,
): Point2D {
  const toP1 = subtractPoints(p1, vertex);
  const toP2 = subtractPoints(p2, vertex);
  const toArc = subtractPoints(arcPoint, vertex);
  return dotProduct(toP1, toArc) >= dotProduct(toP2, toArc) ? p1 : p2;
}

/**
 * Signed sweep (radians) from `ray1Angle` to `ray2Angle` that PASSES THROUGH
 * `arcPointAngle`. Positive = CCW, negative = CW. Picks the long arc when
 * needed so the dimensioned arc always contains the user-supplied arcPoint.
 */
function computeSignedSweep(
  ray1Angle: number,
  ray2Angle: number,
  arcPointAngle: number,
): number {
  const shortSweep = normalizeAngleDiff(ray2Angle - ray1Angle);
  const arcPtDelta = normalizeAngleDiff(arcPointAngle - ray1Angle);
  const onShort =
    (shortSweep >= 0 && arcPtDelta >= 0 && arcPtDelta <= shortSweep) ||
    (shortSweep <= 0 && arcPtDelta <= 0 && arcPtDelta >= shortSweep);
  if (onShort) return shortSweep;
  const longMagnitude = TAU - Math.abs(shortSweep);
  return shortSweep >= 0 ? -longMagnitude : longMagnitude;
}

/**
 * Ext line from a ray endpoint to the arc tangent point on the same ray.
 * Returns `null` when the endpoint already lies on or past the arc.
 */
function buildAngularExtLine(
  endpoint: Point2D,
  vertex: Point2D,
  arcRadius: number,
  dimexo: number,
  dimexe: number,
): DimLineSegment | null {
  const endpointDist = calculateDistance(vertex, endpoint);
  if (endpointDist === 0 || endpointDist >= arcRadius) return null;
  const dir = getUnitVector(vertex, endpoint);
  const arcFoot = addPoints(vertex, scalePoint(dir, arcRadius));
  return {
    start: addPoints(endpoint, scalePoint(dir, dimexo)),
    end: addPoints(arcFoot, scalePoint(dir, dimexe)),
  };
}

/**
 * Resolve the arc orientation primitives from the three angles (ray1, ray2,
 * arcPoint as seen from the vertex).
 */
function computeArcCore(
  vertex: Point2D,
  rayEndpoint1: Point2D,
  rayEndpoint2: Point2D,
  arcPoint: Point2D,
): ArcCore {
  const ray1Angle = vectorAngle(getUnitVector(vertex, rayEndpoint1));
  const ray2Angle = vectorAngle(getUnitVector(vertex, rayEndpoint2));
  const arcPointAngle = vectorAngle(subtractPoints(arcPoint, vertex));
  const signedSweep = computeSignedSweep(ray1Angle, ray2Angle, arcPointAngle);
  return {
    arcStartAngle: ray1Angle,
    arcEndAngle: ray1Angle + signedSweep,
    signedSweep,
    sweepSign: signedSweep >= 0 ? 1 : -1,
  };
}

/**
 * Outward arrow directions at both arc ends. Both point AWAY from the arc
 * interior (i.e. extending the arc past each tip).
 */
function arrowDirections(
  core: ArcCore,
): { arrow1Direction: Point2D; arrow2Direction: Point2D } {
  const s = core.sweepSign;
  return {
    arrow1Direction: {
      x: s * Math.sin(core.arcStartAngle),
      y: -s * Math.cos(core.arcStartAngle),
    },
    arrow2Direction: {
      x: -s * Math.sin(core.arcEndAngle),
      y: s * Math.cos(core.arcEndAngle),
    },
  };
}

/**
 * Common assembly for Angular2L + Angular3P.
 */
function resolveExtLines(
  style: DimStyle,
  rayEndpoint1: Point2D,
  rayEndpoint2: Point2D,
  vertex: Point2D,
  arcRadius: number,
): { extLine1: DimLineSegment | null; extLine2: DimLineSegment | null } {
  return {
    extLine1: style.suppressExtLine1
      ? null
      : buildAngularExtLine(rayEndpoint1, vertex, arcRadius, style.dimexo, style.dimexe),
    extLine2: style.suppressExtLine2
      ? null
      : buildAngularExtLine(rayEndpoint2, vertex, arcRadius, style.dimexo, style.dimexe),
  };
}

function assembleAngular(
  vertex: Point2D,
  rayEndpoint1: Point2D,
  rayEndpoint2: Point2D,
  arcPoint: Point2D,
  style: DimStyle,
  textMidpoint: Point2D | undefined,
): AngularDimGeometry {
  const arcRadius = calculateDistance(vertex, arcPoint);
  if (arcRadius === 0) {
    throw new Error(
      '[angular-builder] Degenerate angular dim: arcPoint coincides with vertex.',
    );
  }
  const core = computeArcCore(vertex, rayEndpoint1, rayEndpoint2, arcPoint);
  const arrows = arrowDirections(core);
  const midAngle = core.arcStartAngle + core.signedSweep / 2;
  const extLines = resolveExtLines(style, rayEndpoint1, rayEndpoint2, vertex, arcRadius);
  return {
    kind: 'angular',
    arcCenter: vertex,
    arcRadius,
    arcStartAngle: core.arcStartAngle,
    arcEndAngle: core.arcEndAngle,
    extLine1: extLines.extLine1,
    extLine2: extLines.extLine2,
    arrowAnchor1: pointOnCircle(vertex, arcRadius, core.arcStartAngle),
    arrowAnchor2: pointOnCircle(vertex, arcRadius, core.arcEndAngle),
    arrowDirection1: arrows.arrow1Direction,
    arrowDirection2: arrows.arrow2Direction,
    textAnchor: textMidpoint ?? pointOnCircle(vertex, arcRadius, midAngle),
    textRotation: computeTextRotation(normalizeAngleDiff(midAngle + HALF_PI), style.dimtih),
    measurementValue: Math.abs(core.signedSweep),
  };
}

/**
 * Angular 2-line — vertex = intersection of line1 and line2 (extended). Each
 * ray direction is picked from the endpoint on arcPoint's side.
 */
export function buildAngular2LGeometry(
  entity: Angular2LDimensionEntity,
  style: DimStyle,
): AngularDimGeometry {
  const [line1a, line1b, line2a, line2b, arcPoint] = entity.defPoints;
  const dir1 = subtractPoints(line1b, line1a);
  const dir2 = subtractPoints(line2b, line2a);
  const vertex = intersectLines(line1a, dir1, line2a, dir2);
  if (!vertex) {
    throw new Error('[angular-builder] Degenerate angular2L: lines parallel.');
  }
  const rayEndpoint1 = pickRayEndpoint(vertex, line1a, line1b, arcPoint);
  const rayEndpoint2 = pickRayEndpoint(vertex, line2a, line2b, arcPoint);
  return assembleAngular(
    vertex,
    rayEndpoint1,
    rayEndpoint2,
    arcPoint,
    style,
    entity.textMidpoint,
  );
}

/**
 * Angular 3-point — vertex is given explicitly; ray endpoints follow directly.
 */
export function buildAngular3PGeometry(
  entity: Angular3PDimensionEntity,
  style: DimStyle,
): AngularDimGeometry {
  const [vertex, ray1End, ray2End, arcPoint] = entity.defPoints;
  return assembleAngular(
    vertex,
    ray1End,
    ray2End,
    arcPoint,
    style,
    entity.textMidpoint,
  );
}
