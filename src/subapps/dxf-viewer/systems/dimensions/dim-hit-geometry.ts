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
 * Scope: linear + aligned (the two variants that produce a straight dim line
 * offset from feature points). Radial / angular / ordinate fall back to
 * `null` — callers use the legacy defPoints-based approximation for those.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { DimensionEntity } from '../../types/dimension';

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

/**
 * Unit-vector axis of the dim line:
 *   - linear  → (cos rotation, sin rotation), rotation in radians
 *   - aligned → normalize(pts[1] - pts[0])
 */
function resolveDimAxis(entity: DimensionEntity): Point2D | null {
  if (entity.dimensionType === 'linear') {
    const r = entity.rotation;
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
