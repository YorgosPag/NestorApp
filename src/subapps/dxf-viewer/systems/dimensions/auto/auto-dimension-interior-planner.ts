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
 * Φ4-Δ — the interior chains now carry Gap-to-Element WITNESS LINES (Revit
 * «Witness Line Control → Gap to Element»): each extension origin sits on the
 * host's near face (perpendicular axis) while the dim line stays on the
 * centroid, so `buildExtLine` draws a witness reaching each element (DIMEXO gap,
 * no bespoke witness geometry).
 *
 * Reuses the perimeter SSoT wholesale — `classifyElement` / `detailCoordsFor` /
 * `projectBoundsOntoAxis` (reference-extraction) for the per-element coordinate
 * decision, and `dedupSorted` / `quantizeCoord` (chain-planner) for
 * `snapToGrid`-based quantized dedup. No new geometry math, no new rounding
 * helper (N.0.2).
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
import { dedupSorted, quantizeCoord, type CoordSource } from './auto-dimension-chain-planner';
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

/**
 * The deduped interior coordinates on one world axis PLUS, per quantized coord,
 * the host's near face on the PERPENDICULAR axis (Φ4-Δ witness target).
 *
 * `perpByKey`: quantized coord → the element face closest to `baseline`
 * (min `|baseline − face|`). Keyed via `quantizeCoord` so keys line up with the
 * `coord` values `dedupSorted` returns. Drives the Gap-to-Element witness — the
 * extension origin sits on the near face, `buildExtLine` applies the DIMEXO gap.
 */
interface AxisCoordsResult {
  readonly coords: CoordSource[];
  readonly perpByKey: ReadonlyMap<number, number>;
}

/** The bbox face on `axis` nearest to `baseline` (Gap-to-Element witness target). */
function nearFaceToBaseline(lo: number, hi: number, baseline: number): number {
  return Math.abs(baseline - hi) < Math.abs(baseline - lo) ? hi : lo;
}

/** Collect the deduped interior coordinates + per-coord near-face on one axis. */
function axisCoords(
  elements: readonly Entity[],
  options: AutoDimensionOptions,
  measuresX: boolean,
  baseline: number,
): AxisCoordsResult {
  const raw: { coord: number; sourceEntityId: string; edge: AutoDimEdge }[] = [];
  const perpByKey = new Map<number, number>();
  for (const e of elements) {
    const cls = classifyElement(e);
    if (!cls || cls === 'opening') continue; // structural + walls only (Φ3 choice).
    const bounds = calculateBimEntity2DBounds(e);
    if (!bounds) continue;
    const proj = projectBoundsOntoAxis(bounds, measuresX);
    // Perpendicular projection → host faces the witness aims at (Gap-to-Element).
    const perp = projectBoundsOntoAxis(bounds, !measuresX);
    const nearFace = nearFaceToBaseline(perp.lo, perp.hi, baseline);
    for (const c of interiorCoordsFor(cls, proj, options.referenceBasis)) {
      raw.push({ coord: c.coord, sourceEntityId: e.id, edge: c.edge });
      // Keep the face closest to the dim line when coords collide (nearest wins).
      const key = quantizeCoord(c.coord);
      const existing = perpByKey.get(key);
      if (existing === undefined || Math.abs(baseline - nearFace) < Math.abs(baseline - existing)) {
        perpByKey.set(key, nearFace);
      }
    }
  }
  return { coords: dedupSorted(raw), perpByKey };
}

/** Source descriptor for a def point, or undefined when the coord had no host. */
function sourceOf(cs: CoordSource): PlannedSegment['source1'] {
  return cs.id ? { id: cs.id, edge: cs.edge } : undefined;
}

/**
 * Build one interior chain along an axis at a fixed perpendicular baseline.
 * Horizontal chain: dim line rides `y = baseline` (rotation 0, axis 'x').
 * Vertical chain:   dim line rides `x = baseline` (rotation 90, axis 'y').
 *
 * Φ4-Δ (Gap-to-Element, Revit «Witness Line Control»): each extension origin
 * sits on the host's NEAR FACE (perpendicular axis, from `perpByKey`) so the
 * witness line reaches the element; the dim-line ref stays on the centroid.
 * `buildExtLine` then applies the DIMEXO gap + DIMEXE overshoot — no bespoke
 * witness geometry. Coords with no recorded face fall back to `baseline`
 * (zero-length witness, the safe Φ3 look).
 */
function buildAxisChain(
  coords: readonly CoordSource[],
  measuresX: boolean,
  baseline: number,
  perpByKey: ReadonlyMap<number, number>,
): PlannedSegment[] {
  const out: PlannedSegment[] = [];
  const extOrigin = (coord: number): Point2D => {
    const perp = perpByKey.get(coord) ?? baseline;
    return measuresX ? { x: coord, y: perp } : { x: perp, y: coord };
  };
  const dimLineRef = (coord: number): Point2D =>
    measuresX ? { x: coord, y: baseline } : { x: baseline, y: coord };
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    if (b.coord - a.coord < MIN_SEGMENT_MM) continue;
    out.push({
      axis: measuresX ? 'x' : 'y',
      defPoints: [extOrigin(a.coord), extOrigin(b.coord), dimLineRef(a.coord)],
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
  const horizontal = axisCoords(elements, options, true, cy);
  const vertical = axisCoords(elements, options, false, cx);
  return [
    ...buildAxisChain(horizontal.coords, true, cy, horizontal.perpByKey),
    ...buildAxisChain(vertical.coords, false, cx, vertical.perpByKey),
  ];
}
