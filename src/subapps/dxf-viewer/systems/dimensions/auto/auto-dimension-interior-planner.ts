/**
 * ADR-563 Φ3 (Auto-Dimension) — Interior chain planner (pure).
 *
 * Adds the INTERIOR structural grid the big players place with a cut line
 * (ArchiCAD "Interior Dimensioning" — auto cut line at the plan centroid): two
 * orthogonal chains, one HORIZONTAL measuring X and one VERTICAL measuring Y,
 * running THROUGH the model centroid rather than offset outside like the
 * perimeter chains. Each chain dimensions the structural elements + interior
 * walls that cross it (openings excluded — those live in the perimeter detail
 * tier).
 *
 * Reuses the perimeter SSoT wholesale — `classifyElement` / `detailCoordsFor` /
 * `projectBoundsOntoAxis` (reference-extraction) for the per-element coordinate
 * decision, and `dedupSorted` (chain-planner) for `snapToGrid`-based quantized
 * dedup. No new geometry math, no new rounding helper (N.0.2).
 *
 * @see auto-dimension-chain-planner.ts — the perimeter sibling.
 * @see auto-dimension-engine.ts        — concatenates both planners' output.
 */

import type { Entity } from '../../../types/entities';
import type { Point2D } from '../../../rendering/types/Types';
import { calculateBimEntity2DBounds } from '../../../bim/utils/bim-bounds';
import {
  classifyElement,
  detailCoordsFor,
  projectBoundsOntoAxis,
  type AxisProjection,
  type ElementClass,
} from './auto-dimension-reference-extraction';
import { dedupSorted, type CoordSource } from './auto-dimension-chain-planner';
import type {
  AutoDimEdge,
  AutoDimReferenceBasis,
  AutoDimensionOptions,
  Bounds2D,
  PlannedSegment,
} from './auto-dimension-types';

/** Minimum span (mm) below which an interior segment is degenerate and skipped. */
const MIN_SEGMENT_MM = 1;

/**
 * Interior coordinate policy per reference basis. Unlike the perimeter detail
 * tier (`smart` → faces), the interior grid reads `smart` as centerlines — the
 * approved default look (spacing between column/wall axes). `faces` still gives
 * element faces, `axes` gives centers. Delegates to `detailCoordsFor` so the
 * per-basis math stays single-sourced.
 */
function interiorCoordsFor(
  cls: ElementClass,
  proj: AxisProjection,
  basis: AutoDimReferenceBasis,
): readonly { coord: number; edge: AutoDimEdge }[] {
  const effective: AutoDimReferenceBasis = basis === 'smart' ? 'axes' : basis;
  return detailCoordsFor(cls, proj, effective);
}

/** Collect the deduped, sorted interior coordinates on one world axis. */
function axisCoords(
  elements: readonly Entity[],
  options: AutoDimensionOptions,
  measuresX: boolean,
): CoordSource[] {
  const raw: { coord: number; sourceEntityId: string; edge: AutoDimEdge }[] = [];
  for (const e of elements) {
    const cls = classifyElement(e);
    if (!cls || cls === 'opening') continue; // structural + walls only (Φ3 choice).
    const bounds = calculateBimEntity2DBounds(e);
    if (!bounds) continue;
    const proj = projectBoundsOntoAxis(bounds, measuresX);
    for (const c of interiorCoordsFor(cls, proj, options.referenceBasis)) {
      raw.push({ coord: c.coord, sourceEntityId: e.id, edge: c.edge });
    }
  }
  return dedupSorted(raw);
}

/** Source descriptor for a def point, or undefined when the coord had no host. */
function sourceOf(cs: CoordSource): PlannedSegment['source1'] {
  return cs.id ? { id: cs.id, edge: cs.edge } : undefined;
}

/**
 * Build one interior chain along an axis at a fixed perpendicular baseline.
 * Horizontal chain: def points sit on `y = baseline` (rotation 0, axis 'x').
 * Vertical chain:   def points sit on `x = baseline` (rotation 90, axis 'y').
 * Witness lines are zero-length (dim line rides the centroid) — the clean
 * interior look; `buildLinearGeometry` accepts this (null ext lines).
 */
function buildAxisChain(
  coords: readonly CoordSource[],
  measuresX: boolean,
  baseline: number,
): PlannedSegment[] {
  const out: PlannedSegment[] = [];
  const point = (coord: number): Point2D =>
    measuresX ? { x: coord, y: baseline } : { x: baseline, y: coord };
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    if (b.coord - a.coord < MIN_SEGMENT_MM) continue;
    out.push({
      axis: measuresX ? 'x' : 'y',
      defPoints: [point(a.coord), point(b.coord), point(a.coord)],
      rotation: measuresX ? 0 : 90,
      source1: sourceOf(a),
      source2: sourceOf(b),
    });
  }
  return out;
}

/**
 * Plan the two interior chains (horizontal X + vertical Y) through the plan
 * centroid. Returns `[]` when neither axis has ≥2 distinct coordinates.
 *
 * @param elements  candidate BIM entities (openings ignored for interior).
 * @param options   user options (reference basis drives center vs faces).
 * @param overall   overall 2D bounds of the whole element set (centroid source).
 */
export function planInteriorChains(
  elements: readonly Entity[],
  options: AutoDimensionOptions,
  overall: Bounds2D,
): PlannedSegment[] {
  const cx = (overall.min.x + overall.max.x) / 2;
  const cy = (overall.min.y + overall.max.y) / 2;
  return [
    ...buildAxisChain(axisCoords(elements, options, true), true, cy),
    ...buildAxisChain(axisCoords(elements, options, false), false, cx),
  ];
}
