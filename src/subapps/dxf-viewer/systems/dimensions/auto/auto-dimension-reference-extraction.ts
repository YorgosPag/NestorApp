/**
 * ADR-563 (Auto-Dimension) — Reference-point extraction (pure).
 *
 * Turns a set of BIM elements into `ReferencePoint[]`: scalar coordinates along
 * each side's measured axis, grouped by tier. This is the "which points get
 * dimensioned" decision the big players expose as a reference-basis choice
 * (ArchiCAD *Composite Wall Reference* / Revit *Wall faces vs centerlines*).
 *
 * Smart basis (default): structural (column/foundation/beam) contribute their
 * center to the `axes` tier and their extent edges to the `detail` tier; walls
 * contribute faces to `detail` and centerline to `axes`; openings contribute
 * their center to `detail`.
 *
 * Reuses `calculateBimEntity2DBounds` (bim/utils) — the SSoT for projecting a
 * BIM entity's `geometry.bbox` to a 2D AABB. No new geometry math.
 */

import type { Entity } from '../../../types/entities';
import {
  isWallEntity,
  isColumnEntity,
  isFoundationEntity,
  isBeamEntity,
  isOpeningEntity,
} from '../../../types/entities';
import { calculateBimEntity2DBounds } from '../../../bim/utils/bim-bounds';
import {
  AUTO_DIM_SIDES,
  sideMeasuresX,
  type AutoDimEdge,
  type AutoDimSide,
  type AutoDimensionOptions,
  type Bounds2D,
  type ReferencePoint,
} from './auto-dimension-types';

/** Coarse element class driving reference selection. */
type ElementClass = 'wall' | 'structural' | 'opening';

function classifyElement(e: Entity): ElementClass | null {
  if (isWallEntity(e)) return 'wall';
  if (isColumnEntity(e) || isFoundationEntity(e) || isBeamEntity(e)) return 'structural';
  if (isOpeningEntity(e)) return 'opening';
  return null;
}

/** Projection of a 2D AABB onto a side's measured axis (X for N/S, Y for E/W). */
interface AxisProjection {
  readonly lo: number;
  readonly hi: number;
  readonly center: number;
}

function projectOntoSideAxis(bounds: Bounds2D, side: AutoDimSide): AxisProjection {
  const lo = sideMeasuresX(side) ? bounds.min.x : bounds.min.y;
  const hi = sideMeasuresX(side) ? bounds.max.x : bounds.max.y;
  return { lo, hi, center: (lo + hi) / 2 };
}

/** Detail-tier coordinates for one element (edges vs center per reference basis). */
function detailCoordsFor(
  cls: ElementClass,
  proj: AxisProjection,
  basis: AutoDimensionOptions['referenceBasis'],
): readonly { coord: number; edge: AutoDimEdge }[] {
  if (cls === 'opening') {
    return [{ coord: proj.center, edge: 'center' }];
  }
  // 'axes' basis collapses even the detail tier to centers (structural grid look).
  if (basis === 'axes') {
    return [{ coord: proj.center, edge: 'center' }];
  }
  // 'faces' / 'smart' → both extent edges (walls→faces, structural→element width).
  return [
    { coord: proj.lo, edge: 'min' },
    { coord: proj.hi, edge: 'max' },
  ];
}

/**
 * Extract every reference coordinate for the enabled sides & tiers.
 *
 * @param elements  candidate BIM entities (non-BIM entities are ignored).
 * @param options   user options (tiers / sides / basis / openings).
 * @param overall   overall 2D bounds of the whole element set (for the overall tier).
 */
export function extractReferencePoints(
  elements: readonly Entity[],
  options: AutoDimensionOptions,
  overall: Bounds2D,
): ReferencePoint[] {
  const out: ReferencePoint[] = [];
  const enabledSides = AUTO_DIM_SIDES.filter((s) => options.sides[s]);

  for (const side of enabledSides) {
    // ── overall tier — a single span from the global min→max on this axis ──
    if (options.tiers.overall) {
      const lo = sideMeasuresX(side) ? overall.min.x : overall.min.y;
      const hi = sideMeasuresX(side) ? overall.max.x : overall.max.y;
      out.push({ coord: lo, side, tier: 'overall', sourceEntityId: '', edge: 'min' });
      out.push({ coord: hi, side, tier: 'overall', sourceEntityId: '', edge: 'max' });
    }

    // ── per-element detail + axes tiers ──
    for (const e of elements) {
      const cls = classifyElement(e);
      if (!cls) continue;
      if (cls === 'opening' && !options.includeOpenings) continue;
      const bounds = calculateBimEntity2DBounds(e);
      if (!bounds) continue;
      const proj = projectOntoSideAxis(bounds, side);

      if (options.tiers.detail) {
        for (const c of detailCoordsFor(cls, proj, options.referenceBasis)) {
          out.push({ coord: c.coord, side, tier: 'detail', sourceEntityId: e.id, edge: c.edge });
        }
      }
      // Axes tier: structural grid — element centers only (openings excluded).
      if (options.tiers.axes && cls !== 'opening') {
        out.push({ coord: proj.center, side, tier: 'axes', sourceEntityId: e.id, edge: 'center' });
      }
    }
  }

  return out;
}
