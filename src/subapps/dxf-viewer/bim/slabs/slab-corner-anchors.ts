/**
 * ADR-370 §5.3 — Slab polygon-vertex world-point exposure (pure SSoT).
 *
 * Exposes ALL vertices of the slab outline polygon as world-coordinate
 * snap targets. Unlike walls and beams (which expose only 4 face-end
 * corners), slabs are arbitrary closed polygons where EVERY vertex IS a
 * structural corner — the intersection of two slab edges.
 *
 * Source: `SlabEntity.geometry.polygon.vertices` (CCW closed polygon, mm).
 * The geometry cache is used directly — geometry is derived from
 * `SlabParams.outline` and the polygon vertices ARE the params outline
 * vertices (no offset transform), so cache and params are identical here.
 *
 * Min vertices: 3 (triangle). Degenerate slabs (< 3 vertices) → returns []
 * rather than throwing (matches defensive null-safety pattern of sibling
 * anchor modules).
 *
 * Pure module: zero React / DOM / Firestore / canvas deps. Idempotent.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-370-bim-corner-snap-system.md §5.3
 * @see bim/types/slab-types.ts  (SlabGeometry.polygon — SSoT vertex source)
 * @see bim/columns/column-anchors.ts  (pattern reference)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { SlabEntity } from '../types/slab-types';

// ─── Tagged result ─────────────────────────────────────────────────────────────

/**
 * Tagged slab corner world point.
 * `vertexIndex` is the 0-based index into `outline.vertices` — enables
 * downstream debug tooltips ("snapped to slab vertex 3") and vertex-level
 * grip association in future phases.
 */
export interface SlabCornerWorldPoint {
  readonly vertexIndex: number;
  readonly point: Point2D;
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Compute corner world points for a slab entity.
 *
 * Returns one entry per outline vertex (index 0 … N-1).
 * Degenerate slabs with fewer than 3 vertices → returns [] (invalid polygon,
 * caught upstream by the slab validator but guard is kept for safety).
 */
export function getSlabCornerWorldPoints(
  slab: Readonly<SlabEntity>,
): readonly SlabCornerWorldPoint[] {
  // `SlabGeometry.polygon` is a re-export of `SlabParams.outline` (identical CCW ring —
  // slab-types.ts §polygon), so prefer the derived geometry cache but fall back to the
  // persisted params outline. Geometry is DERIVED and may be transiently absent (e.g. a
  // just-loaded slab before `reconcileLoadedSceneBim` recomputes it). `params` itself is
  // ALSO optional-chained: an ambient-alignment scan can hit a half-built / preview slab
  // whose `params` is not yet attached — guard it so we return [] (degenerate) instead of
  // throwing, honouring this module's stated defensive contract (§docstring "returns []
  // rather than throwing"). Both absent → `verts` is undefined → the guard below returns [].
  const verts = slab.geometry?.polygon?.vertices ?? slab.params?.outline?.vertices;
  if (!verts || verts.length < 3) return [];
  return verts.map((v, i) => ({ vertexIndex: i, point: to2D(v) }));
}

// ─── Internal helper ───────────────────────────────────────────────────────────

function to2D(p: { readonly x: number; readonly y: number }): Point2D {
  return { x: p.x, y: p.y };
}
