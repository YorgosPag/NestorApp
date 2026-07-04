/**
 * ADR-563 Φ4-Α (Auto-Dimension) — Interactive cut-line chain planner (pure).
 *
 * The interior planner (`planInteriorChains`) auto-places two orthogonal chains
 * through the plan centroid on the world X/Y axes. This planner generalises that
 * to an ARBITRARY axis: the user drags a CUT LINE across the plan (ArchiCAD
 * "Interior Dimensioning" / Revit aligned pick-line) and every element the line
 * crosses is dimensioned in ONE aligned chain running parallel to that line,
 * offset to the side the user places it (3rd click).
 *
 * Reuses the whole SSoT stack — nothing new geometric (N.0.2):
 *   - crossing test  → `lineIntersectsRectangle` (universal-marquee-geometry)
 *   - element bbox   → `calculateBimEntity2DBounds` (bim/utils)
 *   - axis frame     → `unitVector` / `perpUnit` (bim/grips/grip-math)
 *   - projection     → `projectPointOnAxis` / `projectPolygonOnAxis`
 *                      (bim/geometry/shared/polygon-axis-projection)
 *   - basis policy   → `classifyElement` / `detailCoordsFor` (reference-extraction)
 *                      — same centers-vs-faces decision as perimeter/interior
 *   - dedup          → `dedupSorted` (chain-planner, ADR-049 quantized)
 *   - offset sign    → `dotProduct` (geometry-vector-utils)
 *
 * Emits `dimensionType:'aligned'` segments (dim line ∥ the cut line) the entity
 * factory turns into `AlignedDimensionEntity` — already supported end-to-end by
 * `buildAlignedGeometry` + the dimension renderer (no downstream changes).
 *
 * Slice-1 NON-associative (no `source1/2`): an arbitrary-axis follow-on-move
 * needs a vector `bimAnchor` in the shared `dim-association-service` (out of
 * scope, same limit as the Φ4-Β aligned planner).
 *
 * @see auto-dimension-interior-planner.ts — the fixed-axis (X/Y) sibling.
 * @see auto-dimension-aligned-planner.ts  — the per-member aligned sibling.
 */

import type { Entity } from '../../../types/entities';
import { isLineEntity, isPolylineEntity, isLWPolylineEntity } from '../../../types/entities';
import type { Point2D } from '../../../rendering/types/Types';
import { unitVector, perpUnit } from '../../../bim/grips/grip-math';
import { dotProduct } from '../../../rendering/entities/shared/geometry-vector-utils';
import {
  projectPointOnAxis,
  projectPolygonOnAxis,
} from '../../../bim/geometry/shared/polygon-axis-projection';
import { calculateBimEntity2DBounds } from '../../../bim/utils/bim-bounds';
import { segmentIntersection } from '../../../utils/geometry/GeometryUtils';
import { lineIntersectsRectangle } from '../../selection/universal-marquee-geometry';
import {
  classifyElement,
  detailCoordsFor,
  type AxisProjection,
} from './auto-dimension-reference-extraction';
import { dedupSorted, type CoordSource } from './auto-dimension-chain-planner';
import type {
  AutoDimReferenceBasis,
  AutoDimensionOptions,
  Bounds2D,
  PlannedSegment,
} from './auto-dimension-types';

/** Minimum span (mm) below which a cut-line segment is degenerate and skipped. */
const MIN_SEGMENT_MM = 1;

/**
 * Cut-line coordinate policy per reference basis — mirrors the interior grid
 * (`interiorCoordsFor`): `smart` reads as `axes` (element centers, the
 * structural-grid look), `faces` gives element faces, `axes` gives centers.
 * Delegates to `detailCoordsFor` so the per-basis math stays single-sourced.
 */
function cutlineBasis(basis: AutoDimReferenceBasis): AutoDimReferenceBasis {
  return basis === 'smart' ? 'axes' : basis;
}

/** The four corners of an axis-aligned bbox (for skew-axis face projection). */
function bboxCorners(b: Bounds2D): readonly Point2D[] {
  return [
    { x: b.min.x, y: b.min.y },
    { x: b.max.x, y: b.min.y },
    { x: b.max.x, y: b.max.y },
    { x: b.min.x, y: b.max.y },
  ];
}

/**
 * Project one element's bbox onto the cut-line axis → an `AxisProjection`
 * `{lo, hi, center}` in along-axis scalars, so `detailCoordsFor` picks the exact
 * same centers/faces it does for the perimeter & interior chains.
 */
function projectOntoCutAxis(
  bounds: Bounds2D,
  start: Point2D,
  u: Point2D,
): AxisProjection {
  const poly = projectPolygonOnAxis(bboxCorners(bounds), start.x, start.y, u.x, u.y);
  const cx = (bounds.min.x + bounds.max.x) / 2;
  const cy = (bounds.min.y + bounds.max.y) / 2;
  const center = projectPointOnAxis(cx, cy, start.x, start.y, u.x, u.y).along;
  return { lo: poly.alongMin, hi: poly.alongMax, center };
}

/**
 * ADR-563 Φ4-Α — raw (non-BIM) linear geometry the cut line can also dimension.
 * Exploded DXF plans carry plain `LINE` / `POLYLINE` / `LWPOLYLINE` segments
 * instead of BIM walls, so `classifyElement` returns null and the BIM bbox path
 * skips them. Here each REAL crossing contributes ONE coord — the exact
 * segment-segment intersection point projected onto the cut axis (correct for
 * any orientation, unlike an AABB projection). Reuses the `segmentIntersection`
 * SSoT (GeometryUtils); zero-thickness → edge always 'center'.
 */
function rawLinearCutCoords(
  e: Entity,
  start: Point2D,
  end: Point2D,
  u: Point2D,
): { coord: number; edge: CoordSource['edge'] }[] {
  const out: { coord: number; edge: CoordSource['edge'] }[] = [];
  const addHit = (p: Point2D | null | undefined): void => {
    if (!p) return;
    out.push({ coord: projectPointOnAxis(p.x, p.y, start.x, start.y, u.x, u.y).along, edge: 'center' });
  };
  if (isLineEntity(e)) {
    addHit(segmentIntersection(start, end, e.start, e.end)?.point);
  } else if (isPolylineEntity(e) || isLWPolylineEntity(e)) {
    const v = e.vertices;
    if (v && v.length >= 2) {
      const last = e.closed ? v.length : v.length - 1;
      for (let i = 0; i < last; i++) {
        addHit(segmentIntersection(start, end, v[i], v[(i + 1) % v.length])?.point);
      }
    }
  }
  return out;
}

/** Deduped along-axis coordinates of every element the cut line crosses. */
function crossedCoords(
  elements: readonly Entity[],
  start: Point2D,
  end: Point2D,
  u: Point2D,
  options: AutoDimensionOptions,
): CoordSource[] {
  const basis = cutlineBasis(options.referenceBasis);
  const raw: { coord: number; sourceEntityId: string; edge: CoordSource['edge'] }[] = [];
  for (const e of elements) {
    const cls = classifyElement(e);
    if (cls) {
      // BIM path — walls/structural/openings dimensioned via their bbox extent.
      if (cls === 'opening' && !options.includeOpenings) continue;
      const bounds = calculateBimEntity2DBounds(e);
      if (!bounds) continue;
      if (!lineIntersectsRectangle(start, end, bounds)) continue;
      const proj = projectOntoCutAxis(bounds, start, u);
      for (const c of detailCoordsFor(cls, proj, basis)) {
        raw.push({ coord: c.coord, sourceEntityId: e.id, edge: c.edge });
      }
      continue;
    }
    // Non-BIM path — raw exploded LINE / POLYLINE geometry (exact crossing).
    for (const c of rawLinearCutCoords(e, start, end, u)) {
      raw.push({ coord: c.coord, sourceEntityId: e.id, edge: c.edge });
    }
  }
  return dedupSorted(raw);
}

/**
 * Plan the aligned dimension chain for a user cut line.
 *
 * @param elements     candidate entities (whole active-level plan): BIM
 *                     walls/structural/openings (bbox extent) AND raw exploded
 *                     LINE / POLYLINE / LWPOLYLINE geometry (exact crossing).
 * @param cutStart     first click — cut-line start (world mm, snapped).
 * @param cutEnd       second click — cut-line end (world mm, snapped).
 * @param dimLinePoint third click / live cursor — its perpendicular distance
 *                     from the cut line sets which side + how far the chain sits.
 * @param options      dialog options (reference basis / openings).
 * @returns aligned `PlannedSegment[]` (empty when <2 crossings or degenerate line).
 */
export function planCutLineChain(
  elements: readonly Entity[],
  cutStart: Point2D,
  cutEnd: Point2D,
  dimLinePoint: Point2D,
  options: AutoDimensionOptions,
): PlannedSegment[] {
  const u = unitVector(cutStart, cutEnd);
  if (!u) return []; // degenerate / zero-length cut line
  const perp = perpUnit(u);
  const coords = crossedCoords(elements, cutStart, cutEnd, u, options);
  if (coords.length < 2) return [];

  // Signed perpendicular offset toward the placement point (which side + distance).
  const off = dotProduct({ x: dimLinePoint.x - cutStart.x, y: dimLinePoint.y - cutStart.y }, perp);
  const pointAt = (along: number): Point2D => ({
    x: cutStart.x + along * u.x,
    y: cutStart.y + along * u.y,
  });

  const out: PlannedSegment[] = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    if (b.coord - a.coord < MIN_SEGMENT_MM) continue;
    const extO1 = pointAt(a.coord);
    const extO2 = pointAt(b.coord);
    const dimLineRef: Point2D = { x: extO1.x + perp.x * off, y: extO1.y + perp.y * off };
    out.push({
      // `axis` only satisfies the type — no sources means the factory never
      // reads it (cut-line aligned dims are non-associative in this slice).
      axis: Math.abs(u.x) >= Math.abs(u.y) ? 'x' : 'y',
      dimensionType: 'aligned',
      defPoints: [extO1, extO2, dimLineRef],
      rotation: 0, // unused by AlignedDimensionEntity (dim line ∥ defPoints).
    });
  }
  return out;
}
