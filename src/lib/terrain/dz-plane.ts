/**
 * ADR-650 M6 / ADR-920 — the Δz plane through a triangle: fit, evaluate, lift. Pure, store-free.
 *
 * Δz over a triangle is a LINEAR field (both surfaces are planar there), so a cut vertex gets its
 * Δz back from the triangle's plane instead of being re-sampled. Shared by the prism volumes
 * (`cut-fill-geometry`) and the boundary clip of the surface itself (`tin-clip-to-boundary`).
 *
 * Moved here from `subapps/dxf-viewer/systems/topography/cut-fill-geometry.ts` (ADR-920 Β1) so the
 * public plot listing can clip its surface without importing from the subapp (CHECK 3.62).
 *
 * @module lib/terrain/dz-plane
 */

import type { PlanarPoint } from '@/lib/geometry/planar-polygon';

/** A polygon vertex carrying the Δz (surface − reference) of the surface at that point. */
export interface DzVertex {
  readonly x: number;
  readonly y: number;
  /** Canonical mm. > 0 → ground above the reference (cut). < 0 → below it (fill). */
  readonly dz: number;
}

/** The plane `Δz = a·x + b·y + c` fitted through a triangle's three Δz samples. */
export interface DzPlane {
  readonly a: number;
  readonly b: number;
  readonly c: number;
}

/** Degenerate-area guard, in mm² — a sliver below this contributes no volume anyway. */
export const MIN_AREA_MM2 = 1e-6;

/**
 * The Δz plane through three vertices, or `null` when they are collinear (a zero-area
 * triangle — no plane, and no volume to lose by skipping it).
 */
export function fitDzPlane(v0: DzVertex, v1: DzVertex, v2: DzVertex): DzPlane | null {
  const det =
    (v1.x - v0.x) * (v2.y - v0.y) - (v2.x - v0.x) * (v1.y - v0.y);
  if (!Number.isFinite(det) || Math.abs(det) < MIN_AREA_MM2) return null;

  const a =
    ((v1.dz - v0.dz) * (v2.y - v0.y) - (v2.dz - v0.dz) * (v1.y - v0.y)) / det;
  const b =
    ((v2.dz - v0.dz) * (v1.x - v0.x) - (v1.dz - v0.dz) * (v2.x - v0.x)) / det;
  const c = v0.dz - a * v0.x - b * v0.y;
  return Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(c) ? { a, b, c } : null;
}

/** Δz of the plane at a planimetric point — the SSoT way to re-attach Δz to a cut vertex. */
export function dzAt(plane: DzPlane, p: PlanarPoint): number {
  return plane.a * p.x + plane.b * p.y + plane.c;
}

/** Lift a planimetric polygon onto the plane, so every vertex carries its own Δz. */
export function attachDz(vertices: readonly PlanarPoint[], plane: DzPlane): DzVertex[] {
  return vertices.map((p) => ({ x: p.x, y: p.y, dz: dzAt(plane, p) }));
}
