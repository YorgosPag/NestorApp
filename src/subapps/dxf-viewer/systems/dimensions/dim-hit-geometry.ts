/**
 * ADR-362 Phase I3 hotfix (2026-05-19) — Hit-geometry SSoT for dimensions.
 *
 * Purpose: compute the *rendered* dim-line endpoints (foot points) and text
 * anchor from a `DimensionEntity`'s raw `defPoints`, so hit testing can
 * approximate the actual on-canvas geometry instead of the feature segment.
 *
 * Why a separate module: `dim-geometry-builder.ts` already produces full
 * `DimGeometry` but requires a resolved `DimStyle` + parent lookup (heavy +
 * cycle-prone for hit-test code paths). Hit testing only needs foot points
 * and the text anchor — pure geometry derivable from `defPoints` + rotation
 * (linear) or pts[0]→pts[1] direction (aligned). Keeping this SSoT helper
 * lean lets both `hit-test-entity-tests.ts` and `DimensionRenderer.hitTest`
 * share one implementation without dragging style resolution into the hit
 * pipeline (N.12 SSoT enforcement).
 *
 * Scope split:
 *   - `computeDimHitGeometry` → linear + aligned (straight dim line offset from
 *     feature points), reconstructed lean from `defPoints` + rotation.
 *   - `buildVariantHitGeometry` + `hitTestDimGeometry` (ADR-362 Phase I per-variant
 *     hit, 2026-06-24) → radial / angular / ordinate. These reuse the ONE geometry
 *     SSoT (`buildDimensionGeometry`) with the canonical ISO-129 style and hit-test
 *     against the *actual rendered* arc / leader / dim-line — no reconstruction,
 *     no style registry, no cycle (the arc/leader core is style-offset-independent).
 *   - baseline / continued still fall back to the legacy defPoints approximation
 *     in the callers (they need a parent lookup the hit path does not carry).
 */

import type { Point2D } from '../../rendering/types/Types';
import type { DimensionEntity } from '../../types/dimension';
import {
  buildDimensionGeometry,
  type DimGeometry,
  type LinearDimGeometry,
  type AngularDimGeometry,
  type RadialDimGeometry,
} from './dim-geometry-builder';
import { ISO_129_TEMPLATE } from './dim-style-templates';
import { isAngleOnSweptArc } from './builders/shared-geometry-helpers';
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
import {
  getNearestPointOnLine,
  pointToCircleDistance,
} from '../../rendering/entities/shared/geometry-utils';
import { pointOnCircle } from '../../rendering/entities/shared/geometry-vector-utils';

export interface DimHitGeometry {
  /** Dim-line start = perpendicular foot from defPoints[0] onto the dim line. */
  readonly footStart: Point2D;
  /** Dim-line end = perpendicular foot from defPoints[1] onto the dim line. */
  readonly footEnd: Point2D;
  /** Text anchor — entity.textMidpoint override, else midpoint(foot1, foot2). */
  readonly textAnchor: Point2D;
}

/**
 * Compute hit geometry for a linear/aligned dim. Returns null for variants
 * without a straight dim line (radial/angular/ordinate/etc.) — the caller
 * falls back to the legacy defPoints-based approximation in that case.
 */
export function computeDimHitGeometry(entity: DimensionEntity): DimHitGeometry | null {
  const axis = resolveDimAxis(entity);
  if (!axis) return null;

  const pts = entity.defPoints;
  if (pts.length < 3) return null;

  const footStart = projectOntoLine(pts[0], pts[2], axis);
  const footEnd = projectOntoLine(pts[1], pts[2], axis);
  const textAnchor = entity.textMidpoint ?? midpoint(footStart, footEnd);

  return { footStart, footEnd, textAnchor };
}

/** Degrees → radians (linear `rotation` is stored in DEGREES, matching the builder). */
const DEG_TO_RAD = Math.PI / 180;

/**
 * Unit-vector axis of the dim line:
 *   - linear  → (cos rotation, sin rotation), rotation in DEGREES
 *   - aligned → normalize(pts[1] - pts[0])
 */
function resolveDimAxis(entity: DimensionEntity): Point2D | null {
  if (entity.dimensionType === 'linear') {
    // `rotation` is DEGREES everywhere it is written (create builder, grip handle via
    // RAD_TO_DEG, auto-planner `rotation: 90`) and `linear-aligned-builder` reads it as
    // `rotation * DEG_TO_RAD`. This SSoT previously treated it as radians → wrong axis
    // (and thus wrong hit-test + snap) for every rotated linear dim. ADR-378 Boy-Scout fix.
    const r = entity.rotation * DEG_TO_RAD;
    return { x: Math.cos(r), y: Math.sin(r) };
  }
  if (entity.dimensionType === 'aligned') {
    const pts = entity.defPoints;
    if (pts.length < 2) return null;
    const dx = pts[1].x - pts[0].x;
    const dy = pts[1].y - pts[0].y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) return null;
    return { x: dx / len, y: dy / len };
  }
  return null;
}

/** Foot of perpendicular from `p` onto the line through `lineRef` with `dir`. */
function projectOntoLine(p: Point2D, lineRef: Point2D, dir: Point2D): Point2D {
  const t = (p.x - lineRef.x) * dir.x + (p.y - lineRef.y) * dir.y;
  return { x: lineRef.x + t * dir.x, y: lineRef.y + t * dir.y };
}

function midpoint(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// ── Per-variant hit geometry (radial / angular / ordinate) ──────────────────

/** Text label hit radius = tolerance × this factor (matches the linear path). */
const TEXT_HIT_FACTOR = 1.5;

/** Variants that build their rendered geometry without a parent lookup, so the
 *  hit path can reuse `buildDimensionGeometry` directly. baseline/continued are
 *  excluded (lookup-dependent); linear/aligned use `computeDimHitGeometry`. */
const PER_VARIANT_HIT_TYPES: ReadonlySet<DimensionEntity['dimensionType']> = new Set([
  'angular2L',
  'angular3P',
  'radius',
  'diameter',
  'arcLength',
  'joggedRadius',
  'ordinate',
]);

/**
 * Build the *rendered* `DimGeometry` for hit-testing a radial / angular /
 * ordinate dim, reusing the single geometry SSoT (`buildDimensionGeometry`)
 * with the canonical ISO-129 style. The arc centre/radius/angles (angular),
 * leader polyline (radial) and feature→text dim line (ordinate) these variants
 * are picked on are all style-offset-independent — the style only trims
 * extension lines and the radius/ordinate default leader tail, which are
 * hit-irrelevant — so no per-entity style resolution is needed here.
 *
 * Returns `null` for out-of-scope variants (linear/aligned/baseline/continued)
 * and for degenerate geometry (builder throw) — the caller then falls back to
 * `computeDimHitGeometry` or the legacy defPoints approximation.
 */
export function buildVariantHitGeometry(entity: DimensionEntity): DimGeometry | null {
  if (!PER_VARIANT_HIT_TYPES.has(entity.dimensionType)) return null;
  try {
    return buildDimensionGeometry(entity, ISO_129_TEMPLATE);
  } catch {
    return null;
  }
}

/**
 * Hit-test a point against fully-built `DimGeometry` (the rendered truth).
 * Returns the closest point on the matched primitive (text anchor / dim line /
 * arc / leader / extension line), or `null` for a miss. Shared by both the
 * canonical hit path and the renderer-leaf bypass so they never diverge.
 */
export function hitTestDimGeometry(
  geom: DimGeometry,
  point: Point2D,
  tolerance: number,
): Point2D | null {
  if (calculateDistance(point, geom.textAnchor) <= tolerance * TEXT_HIT_FACTOR) {
    return geom.textAnchor;
  }
  switch (geom.kind) {
    case 'linear':
      return hitLinearGeometry(geom, point, tolerance);
    case 'angular':
      return hitAngularGeometry(geom, point, tolerance);
    case 'radial':
      return hitRadialGeometry(geom, point, tolerance);
    default: {
      const _exhaustive: never = geom;
      return _exhaustive;
    }
  }
}

/** Nearest clamped point on segment `a→b` if within `tolerance`, else null. */
function nearestOnSegment(
  point: Point2D,
  a: Point2D,
  b: Point2D,
  tolerance: number,
): Point2D | null {
  const near = getNearestPointOnLine(point, a, b, true);
  return calculateDistance(point, near) <= tolerance ? near : null;
}

/** Linear/ordinate dim — straight dim line + optional extension lines. */
function hitLinearGeometry(
  geom: LinearDimGeometry,
  point: Point2D,
  tolerance: number,
): Point2D | null {
  const onDimLine = nearestOnSegment(point, geom.dimLine.start, geom.dimLine.end, tolerance);
  if (onDimLine) return onDimLine;
  return hitExtensionLines(geom.extLine1, geom.extLine2, point, tolerance);
}

/** Angular dim — arc band (centre/radius/swept range) + extension lines. */
function hitAngularGeometry(
  geom: AngularDimGeometry,
  point: Point2D,
  tolerance: number,
): Point2D | null {
  // Reuse the circle-distance SSoT for the radial band; `isAngleOnSweptArc`
  // gates the swept range, then `pointOnCircle` (builder SSoT) gives the
  // projected closest point — the same primitives the arc was built from.
  const onBand = pointToCircleDistance(point, geom.arcCenter, geom.arcRadius) <= tolerance;
  const distToCentre = calculateDistance(point, geom.arcCenter);
  if (onBand && distToCentre > 1e-9) {
    const angle = Math.atan2(point.y - geom.arcCenter.y, point.x - geom.arcCenter.x);
    if (isAngleOnSweptArc(angle, geom.arcStartAngle, geom.arcEndAngle)) {
      return pointOnCircle(geom.arcCenter, geom.arcRadius, angle);
    }
  }
  return hitExtensionLines(geom.extLine1, geom.extLine2, point, tolerance);
}

/** Radial family — polyline leader (radius / diameter / arc-length / jogged). */
function hitRadialGeometry(
  geom: RadialDimGeometry,
  point: Point2D,
  tolerance: number,
): Point2D | null {
  const path = geom.leaderPath;
  for (let i = 1; i < path.length; i++) {
    const near = nearestOnSegment(point, path[i - 1], path[i], tolerance);
    if (near) return near;
  }
  return null;
}

/** Shared extension-line proximity check (linear + angular). */
function hitExtensionLines(
  ext1: { start: Point2D; end: Point2D } | null,
  ext2: { start: Point2D; end: Point2D } | null,
  point: Point2D,
  tolerance: number,
): Point2D | null {
  if (ext1) {
    const near = nearestOnSegment(point, ext1.start, ext1.end, tolerance);
    if (near) return near;
  }
  if (ext2) {
    const near = nearestOnSegment(point, ext2.start, ext2.end, tolerance);
    if (near) return near;
  }
  return null;
}
