/**
 * ADR-619 Bug #4 — Section-slider CLIP for the stair plan.
 *
 * The vertical «Επίπεδο τομής» slider (view-range cut plane, ADR-375 / ADR-452)
 * must act as a pure **visibility clip** on the stair, NOT as a restyle. The
 * plan convention (solid treads below the FIXED internal 1200 mm stair cut +
 * dashed treads above it) is resolved independently in `StairRenderer` at a
 * fixed `'cut'` state; this module only removes the geometry that sits ABOVE
 * the slider elevation, so lowering the slider progressively hides the upper
 * flight — exactly like a Revit section box, never re-cutting the convention.
 *
 * **Datum:** every Z value here is mm in the SAME frame as `ViewRange.cutPlaneMm`
 * (basePoint.z is already baked into the tread / walkline z by
 * `enforceLinearRise` / the region-fill path). The plane `maxZMm` is therefore
 * compared directly against vertex z — no per-entity offset (mirrors the
 * `entity-z-extents` / `isHiddenByCutPlane` datum, ADR-452).
 *
 * `maxZMm === Infinity` (slider inactive) → identity: the ORIGINAL arrays are
 * returned untouched (zero allocation, safe on the render hot path).
 *
 * Pure: world-space mm in, world-space mm out. Zero canvas / React.
 */

import type { Point3D } from '../../../rendering/types/Types';
import type { Polygon3D, Polyline3D, StairStringerGeometry } from '../../types/stair-types';

/** Keep only treads whose (horizontal) elevation is at or below the section plane. */
export function clipTreadsAtSection(
  treads: readonly Polygon3D[],
  maxZMm: number,
): readonly Polygon3D[] {
  if (!Number.isFinite(maxZMm)) return treads;
  return treads.filter((tread) => (tread[0]?.z ?? 0) <= maxZMm);
}

/**
 * Truncate an ascending-Z polyline at the section plane. Stair walklines and
 * stringers rise monotonically (landings are flat, never descending), so the
 * plane is crossed at most once: keep the prefix at/below the plane and
 * interpolate the exact crossing vertex on the edge that straddles it.
 */
export function clipPolylineAtSection(
  poly: Polyline3D,
  maxZMm: number,
): Polyline3D {
  if (!Number.isFinite(maxZMm)) return poly;
  const out: Point3D[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    if (p.z <= maxZMm) { out.push(p); continue; }
    const prev = poly[i - 1];
    // Strict `<`: when the previous vertex sits EXACTLY on the plane it is
    // already kept — interpolating would emit a zero-length duplicate.
    if (prev && prev.z < maxZMm && p.z > prev.z) {
      const t = (maxZMm - prev.z) / (p.z - prev.z);
      out.push({
        x: prev.x + t * (p.x - prev.x),
        y: prev.y + t * (p.y - prev.y),
        z: maxZMm,
      });
    }
    break; // monotonic rise → no at/below-plane vertex follows the crossing
  }
  return out;
}

/**
 * Renderable subset of `StairGeometry` affected by the section clip. `treads`
 * is the UNIFIED tread set (Giorgio, ADR-619 Bug #5: below- and above-internal-
 * cut treads render identically — solid + fill + numbered — so the renderer
 * merges them into one array before clipping).
 */
export interface StairSectionGeometry {
  readonly treads: readonly Polygon3D[];
  readonly stringers: StairStringerGeometry;
  readonly walkline: Polyline3D;
}

/**
 * Clip the renderable stair geometry to the section plane at `maxZMm`. Returns
 * the ORIGINAL references when the plane is inactive (`Infinity`) so the render
 * hot path pays nothing when the slider is off.
 */
export function clipStairGeometryAtSection(
  geometry: StairSectionGeometry,
  maxZMm: number,
): StairSectionGeometry {
  if (!Number.isFinite(maxZMm)) return geometry;
  return {
    treads: clipTreadsAtSection(geometry.treads, maxZMm),
    stringers: {
      inner: clipPolylineAtSection(geometry.stringers.inner, maxZMm),
      outer: clipPolylineAtSection(geometry.stringers.outer, maxZMm),
    },
    walkline: clipPolylineAtSection(geometry.walkline, maxZMm),
  };
}
