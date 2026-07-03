/**
 * ADR-362 / ADR-040 Phase IX — world-space AABB of a DimensionEntity for viewport culling.
 *
 * Why this exists: `getEntityBBox` (dxf-viewport-culling) had no `case 'dimension'`, so every
 * dim fell to the ±1e6 full-plane fallback. In a geo-referenced DXF (coords ~1.7e7) that box
 * sits at the origin, far from the real geometry, so `isEntityInViewport` culled ALL dimensions
 * from the 2D base render — invisible while hover (which bypasses culling) still lit them up.
 * Sibling of the 2026-07-03 wall/column/foundation `geometry.bbox` fix.
 *
 * SSoT reuse (N.12): the cull box is built from the SAME hit-geometry SSoT the picking path
 * uses (`computeDimHitGeometry` for linear/aligned, `buildVariantHitGeometry` for
 * radial/angular/ordinate) — so the culled bounds match the *rendered* dimension (dim line /
 * arc / leader / extension lines / text anchor), NOT just the raw feature `defPoints`, and
 * WITHOUT resolving a per-entity `DimStyle` (both helpers are style-offset-independent /
 * ISO-129 canonical). No parallel bbox logic is introduced.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { DimensionEntity } from '../../types/dimension';
import { computeDimHitGeometry, buildVariantHitGeometry } from './dim-hit-geometry';
import type { DimGeometry } from './dim-geometry-builder';

export interface DimWorldBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** AABB over a point list; `null` for an empty list. */
function aabbOf(points: readonly Point2D[]): DimWorldBounds | null {
  if (points.length === 0) return null;
  let minX = points[0].x, minY = points[0].y, maxX = points[0].x, maxY = points[0].y;
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (p.x < minX) minX = p.x; else if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; else if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

/** Push the rendered points of a built `DimGeometry` (all kinds) into `out`. */
function collectGeometryPoints(g: DimGeometry, out: Point2D[]): void {
  out.push(g.textAnchor, g.arrowAnchor1, g.arrowAnchor2);
  switch (g.kind) {
    case 'linear':
      out.push(g.dimLine.start, g.dimLine.end);
      if (g.extLine1) out.push(g.extLine1.start, g.extLine1.end);
      if (g.extLine2) out.push(g.extLine2.start, g.extLine2.end);
      return;
    case 'angular': {
      // Conservative: the full enclosing box of the arc's circle (same convention as
      // getEntityBBox's `case 'arc'`), so a bulging arc is never under-covered.
      const c = g.arcCenter, r = g.arcRadius;
      out.push({ x: c.x - r, y: c.y - r }, { x: c.x + r, y: c.y + r });
      if (g.extLine1) out.push(g.extLine1.start, g.extLine1.end);
      if (g.extLine2) out.push(g.extLine2.start, g.extLine2.end);
      return;
    }
    case 'radial':
      for (const p of g.leaderPath) out.push(p);
      if (g.centerPoint) out.push(g.centerPoint);
      return;
    default: {
      const _exhaustive: never = g;
      return _exhaustive;
    }
  }
}

/**
 * World-space AABB of a dimension's *rendered* geometry. Always seeds with the raw `defPoints`
 * (feature + dim-line definition point) + `textMidpoint`, then expands to the hit-geometry SSoT
 * output. Never throws — degenerate/unsupported variants (baseline/continued) fall back to the
 * `defPoints` AABB. Returns `null` only for a dimension with no usable points at all.
 */
export function getDimensionWorldBounds(dim: DimensionEntity): DimWorldBounds | null {
  const pts: Point2D[] = [...dim.defPoints];
  if (dim.textMidpoint) pts.push(dim.textMidpoint);

  const hit = computeDimHitGeometry(dim); // linear / aligned (pure, style-free)
  if (hit) {
    pts.push(hit.footStart, hit.footEnd, hit.textAnchor);
  } else {
    const g = buildVariantHitGeometry(dim); // radial / angular / ordinate (ISO-129 canonical)
    if (g) collectGeometryPoints(g, pts);
  }
  return aabbOf(pts);
}
