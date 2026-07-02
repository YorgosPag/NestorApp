/**
 * ADR-362 Phase B2 — Radial family geometry builders.
 *
 * Four variants — all produce `RadialDimGeometry` (polyline leader + arrows):
 *   - Radius: single-arrow leader from arcPoint outward
 *   - Diameter: two-arrow chord through circle centre
 *   - ArcLength: arc-following leader with tangent arrows at arc ends
 *   - JoggedRadius: zig-zag leader for large-radius arcs
 *
 * Single-arrow case (radius, joggedRadius): `arrowAnchor2 == arrowAnchor1`
 * and `arrowDirection2 = { x: 0, y: 0 }` — renderer treats zero vector as
 * "no arrow on side 2".
 *
 * `centerMarkExtent` carries DIMCEN forward for Phase L1 (renderer ignores
 * until then).
 */

import type { Point2D } from '../../../rendering/types/Types';
import type {
  ArcLengthDimensionEntity,
  DiameterDimensionEntity,
  DimStyle,
  JoggedRadiusDimensionEntity,
  RadiusDimensionEntity,
} from '../../../types/dimension';
import {
  addPoints,
  calculateDistance,
  calculateMidpoint,
  getUnitVector,
  pointOnCircle,
  scalePoint,
  subtractPoints,
  vectorAngle,
} from '../../../rendering/entities/shared/geometry-vector-utils';
import { normalizeAngleDiff } from '../../../rendering/entities/shared/geometry-angle-utils';
import type { RadialDimGeometry } from '../dim-geometry-builder';
import { computeTextRotation } from './shared-geometry-helpers';
import {
  resolveRadialTextFit,
  computeRadialPlacement,
} from './radial-text-fit';

const ZERO_VEC: Point2D = { x: 0, y: 0 };
const HALF_PI = Math.PI / 2;
const ARC_LENGTH_SAMPLES = 8;
const RADIUS_EQUAL_EPSILON = 1e-6;
const DEFAULT_LEADER_FACTOR = 3;

/** Default leader length (mm world) when `entity.leaderLength` not provided. */
function defaultLeaderLength(style: DimStyle): number {
  return style.dimasz * DEFAULT_LEADER_FACTOR;
}

/** Per-variant anchors + leader segments handed to the DIMTIX/DIMTOFL resolver. */
interface RadialFitPieces {
  readonly defaultOutside: boolean;
  readonly isDiameter: boolean;
  readonly insideAnchor: Point2D;
  readonly outsideAnchor: Point2D;
  readonly insideLinePath: readonly Point2D[];
  readonly outsideLeaderPath: readonly Point2D[];
  readonly outwardDir: Point2D;
}

/** Resolved `{ textAnchor, leaderPath }` for one radial variant. */
interface RadialFitOutput {
  readonly textAnchor: Point2D;
  readonly leaderPath: readonly Point2D[];
}

/**
 * ADR-362 Phase M3 — apply the faithful-AutoCAD DIMTIX/DIMTOFL/DIMTMOVE decision
 * (via the pure `radial-text-fit` SSoT) to a variant's anchors + leader segments.
 * `entity.textMidpoint` (user drag) always wins for the anchor; the leader still
 * honours DIMTOFL/DIMTMOVE. With every flag at its default the output reproduces
 * the pre-M3 geometry exactly (zero regression).
 */
function applyRadialFit(
  entity: { readonly textMidpoint?: Point2D },
  style: DimStyle,
  pieces: RadialFitPieces,
): RadialFitOutput {
  const fit = resolveRadialTextFit({
    defaultOutside: pieces.defaultOutside,
    isDiameter: pieces.isDiameter,
    dimtix: style.dimtix,
    dimtofl: style.dimtofl,
    dimtmove: style.dimtmove,
  });
  const placement = computeRadialPlacement({
    fit,
    insideAnchor: pieces.insideAnchor,
    outsideAnchor: pieces.outsideAnchor,
    insideLinePath: pieces.insideLinePath,
    outsideLeaderPath: pieces.outsideLeaderPath,
    outwardDir: pieces.outwardDir,
    arrowSize: style.dimasz,
  });
  return {
    textAnchor: entity.textMidpoint ?? placement.textAnchor,
    leaderPath: placement.leaderPath,
  };
}

/**
 * Radius dim — single-arrow leader from `arcPoint` extending outward by
 * `leaderLength` (or `style.dimasz * 3` default).
 */
export function buildRadiusGeometry(
  entity: RadiusDimensionEntity,
  style: DimStyle,
): RadialDimGeometry {
  const [center, arcPoint] = entity.defPoints;
  const radius = calculateDistance(center, arcPoint);
  if (radius === 0) {
    throw new Error('[radial-builder] Degenerate radius dim: arcPoint coincides with center.');
  }
  const outward = getUnitVector(center, arcPoint);
  const leaderLen = entity.leaderLength ?? defaultLeaderLength(style);
  const leaderEnd = addPoints(arcPoint, scalePoint(outward, leaderLen));
  const leaderMid = calculateMidpoint(arcPoint, leaderEnd);
  const fit = applyRadialFit(entity, style, {
    defaultOutside: true,
    isDiameter: false,
    insideAnchor: calculateMidpoint(center, arcPoint),
    outsideAnchor: leaderMid,
    insideLinePath: [center, arcPoint],
    outsideLeaderPath: [arcPoint, leaderEnd],
    outwardDir: outward,
  });
  return {
    kind: 'radial',
    isDiameter: false,
    centerMarkExtent: style.dimcen,
    centerPoint: center,
    leaderPath: fit.leaderPath,
    arrowAnchor1: arcPoint,
    arrowAnchor2: arcPoint,
    arrowDirection1: outward,
    arrowDirection2: ZERO_VEC,
    textAnchor: fit.textAnchor,
    textRotation: computeTextRotation(vectorAngle(outward), style.dimtih),
    measurementValue: radius,
  };
}

/**
 * Diameter dim — two-arrow chord through circle centre. `defPoints` are the
 * two diametrically-opposed points on the circumference.
 */
export function buildDiameterGeometry(
  entity: DiameterDimensionEntity,
  style: DimStyle,
): RadialDimGeometry {
  const [side1, side2] = entity.defPoints;
  const measurementValue = calculateDistance(side1, side2);
  if (measurementValue === 0) {
    throw new Error('[radial-builder] Degenerate diameter dim: sides coincide.');
  }
  const center = calculateMidpoint(side1, side2);
  const outward1 = getUnitVector(center, side1);
  const outward2 = getUnitVector(center, side2);
  // DIMTIX-on outside anchor: past `side2` along the diameter axis, clear of the
  // arrowhead (2×dimasz) plus the DIMGAP margin. Leader ends at the arrow clearance.
  const outsideLeaderEnd = addPoints(side2, scalePoint(outward2, 2 * style.dimasz));
  const outsideAnchor = addPoints(side2, scalePoint(outward2, 2 * style.dimasz + style.dimgap));
  const fit = applyRadialFit(entity, style, {
    defaultOutside: false,
    isDiameter: true,
    insideAnchor: center,
    outsideAnchor,
    insideLinePath: [side1, side2],
    outsideLeaderPath: [side2, outsideLeaderEnd],
    outwardDir: outward2,
  });
  return {
    kind: 'radial',
    isDiameter: true,
    centerMarkExtent: style.dimcen,
    centerPoint: center,
    leaderPath: fit.leaderPath,
    arrowAnchor1: side1,
    arrowAnchor2: side2,
    arrowDirection1: outward1,
    arrowDirection2: outward2,
    textAnchor: fit.textAnchor,
    textRotation: computeTextRotation(vectorAngle(outward2), style.dimtih),
    measurementValue,
  };
}

/** Tangent at arc angle, oriented outward by `sweepSign` (away from arc body). */
function arcTangentOutward(angle: number, sweepSign: number, atStart: boolean): Point2D {
  const dir = atStart ? sweepSign : -sweepSign;
  return { x: dir * Math.sin(angle), y: -dir * Math.cos(angle) };
}

/** Sample N+1 points along an arc from `startAngle` sweeping `signedSweep`. */
function sampleArc(
  center: Point2D,
  radius: number,
  startAngle: number,
  signedSweep: number,
  segments: number,
): Point2D[] {
  const path: Point2D[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = startAngle + (signedSweep * i) / segments;
    path.push(pointOnCircle(center, radius, a));
  }
  return path;
}

/**
 * Arc-length dim — measurement = radius × sweep. Leader follows the arc
 * (sampled polyline); arrows are tangent to arc at each end.
 */
export function buildArcLengthGeometry(
  entity: ArcLengthDimensionEntity,
  style: DimStyle,
): RadialDimGeometry {
  const [center, arcStart, arcEnd] = entity.defPoints;
  const radius = calculateDistance(center, arcStart);
  const radiusEnd = calculateDistance(center, arcEnd);
  if (radius < RADIUS_EQUAL_EPSILON) {
    throw new Error('[radial-builder] Degenerate arcLength dim: zero radius.');
  }
  if (Math.abs(radius - radiusEnd) > RADIUS_EQUAL_EPSILON) {
    throw new Error('[radial-builder] Degenerate arcLength dim: arcStart and arcEnd radii differ.');
  }
  const startAngle = vectorAngle(subtractPoints(arcStart, center));
  const endAngle = vectorAngle(subtractPoints(arcEnd, center));
  const signedSweep = normalizeAngleDiff(endAngle - startAngle);
  const sweepSign = signedSweep >= 0 ? 1 : -1;
  const measurementValue = radius * Math.abs(signedSweep);
  const midAngle = startAngle + signedSweep / 2;
  const arcSamples = sampleArc(center, radius, startAngle, signedSweep, ARC_LENGTH_SAMPLES);
  const arcMid = pointOnCircle(center, radius, midAngle);
  // DIMTIX-on pushes the label radially outward past the arc, clear of the arrow.
  const outsideLeaderEnd = pointOnCircle(center, radius + 2 * style.dimasz, midAngle);
  const outsideAnchor = pointOnCircle(center, radius + 2 * style.dimasz + style.dimgap, midAngle);
  const fit = applyRadialFit(entity, style, {
    defaultOutside: false,
    isDiameter: false,
    insideAnchor: arcMid,
    outsideAnchor,
    insideLinePath: arcSamples,
    outsideLeaderPath: [arcMid, outsideLeaderEnd],
    outwardDir: getUnitVector(center, arcMid),
  });
  return {
    kind: 'radial',
    isDiameter: false,
    centerMarkExtent: style.dimcen,
    centerPoint: center,
    leaderPath: fit.leaderPath,
    arrowAnchor1: arcStart,
    arrowAnchor2: arcEnd,
    arrowDirection1: arcTangentOutward(startAngle, sweepSign, true),
    arrowDirection2: arcTangentOutward(endAngle, sweepSign, false),
    textAnchor: fit.textAnchor,
    textRotation: computeTextRotation(normalizeAngleDiff(midAngle + HALF_PI), style.dimtih),
    measurementValue,
  };
}

/**
 * Jogged radius dim — zig-zag leader for very large arcs where a straight
 * radial leader would overshoot the page. `defPoints[3]` (`jogVertex`) is
 * the bend point between arc and `jogPoint`. Single-arrow at `arcPoint`.
 *
 * `entity.jogAngle` is informational metadata only (default 45° per AutoCAD);
 * the actual zig-zag geometry is driven by `jogVertex` / `jogPoint`.
 */
export function buildJoggedRadiusGeometry(
  entity: JoggedRadiusDimensionEntity,
  style: DimStyle,
): RadialDimGeometry {
  const [center, arcPoint, jogPoint, jogVertex] = entity.defPoints;
  const radius = calculateDistance(center, arcPoint);
  if (radius === 0) {
    throw new Error('[radial-builder] Degenerate joggedRadius dim: arcPoint coincides with center.');
  }
  const outward = getUnitVector(center, arcPoint);
  const jogTailDir = getUnitVector(jogVertex, jogPoint);
  const tailExtensionLength = calculateDistance(jogVertex, jogPoint);
  const leaderTail = addPoints(jogPoint, scalePoint(jogTailDir, tailExtensionLength));
  const fit = applyRadialFit(entity, style, {
    defaultOutside: true,
    isDiameter: false,
    insideAnchor: calculateMidpoint(center, arcPoint),
    outsideAnchor: calculateMidpoint(jogPoint, leaderTail),
    insideLinePath: [center, arcPoint],
    outsideLeaderPath: [arcPoint, jogVertex, jogPoint, leaderTail],
    outwardDir: jogTailDir,
  });
  return {
    kind: 'radial',
    isDiameter: false,
    centerMarkExtent: style.dimcen,
    centerPoint: center,
    leaderPath: fit.leaderPath,
    arrowAnchor1: arcPoint,
    arrowAnchor2: arcPoint,
    arrowDirection1: outward,
    arrowDirection2: ZERO_VEC,
    textAnchor: fit.textAnchor,
    textRotation: computeTextRotation(vectorAngle(jogTailDir), style.dimtih),
    measurementValue: radius,
  };
}
