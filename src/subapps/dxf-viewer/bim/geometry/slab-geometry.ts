/**
 * Slab geometry computation (ADR-363 Phase 3).
 *
 * Pure SSoT function — derives `SlabGeometry` cache από `SlabParams`.
 * Idempotent + side-effect free. Algorithm:
 *
 *   1. polygon = params.outline (closed CCW, mm world coords)
 *   2. area (m²) = |shoelaceArea(vertices)| / 1e6
 *   3. perimeter (m) = sum-of-edges / 1000
 *   4. bbox (mm) = AABB folds vertices σε z=0 plane
 *   5. netArea (m²) = area (Phase 3 — slab-openings subtraction Phase 3.5)
 *   6. volume (m³) = netArea × thickness / 1000
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5
 */

import type { SlabGeometry, SlabParams } from '../types/slab-types';
import type { SlabOpeningEntity } from '../types/slab-opening-types';
import {
  polygonArea,
  polygonBbox,
  polygonPerimeter,
} from './shared/polygon-utils';

const MM_TO_M = 1 / 1000;

/**
 * Compute `SlabGeometry` από `SlabParams`. Pure SSoT για slab-derived
 * γεωμετρία. Caller MUST ensure `outline.vertices.length >= 3` (validator
 * guard upstream). Όταν λιγότερες κορυφές, area/perimeter/volume = 0.
 *
 * Phase 3.7: Όταν δοθεί `slabOpenings`, το `netArea` = `area − Σ(opening.area)`
 * (clamped σε ≥ 0). Το `volume` υπολογίζεται με το `netArea`. Όταν παραλειφθεί
 * → netArea == area (legacy behaviour).
 *
 * Throws nothing — validation σε `validateSlabParams()`.
 */
export function computeSlabGeometry(
  params: SlabParams,
  slabOpenings?: readonly SlabOpeningEntity[],
): SlabGeometry {
  const vertices = params.outline.vertices;
  const bbox = polygonBbox(vertices);
  const areaMm2 = polygonArea(vertices);
  const perimeterMm = polygonPerimeter(vertices);
  const areaM2 = areaMm2 * (MM_TO_M * MM_TO_M);
  const perimeterM = perimeterMm * MM_TO_M;

  const openingsAreaM2 = sumSlabOpeningAreasM2(slabOpenings);
  const netAreaM2 = Math.max(0, areaM2 - openingsAreaM2);
  const thicknessMm = Math.max(0, params.thickness);
  const volumeM3 = netAreaM2 * thicknessMm * MM_TO_M;

  return {
    polygon: params.outline,
    bbox,
    area: areaM2,
    netArea: netAreaM2,
    volume: volumeM3,
    perimeter: perimeterM,
  };
}

/**
 * Sum των m² εμβαδών όλων των slab-openings που ζουν πάνω σε ένα slab.
 * Pure helper — caller φιλτράρει ήδη ανά slabId πριν δώσει τη λίστα. Όταν
 * `openings` undefined ή κενό → 0.
 */
function sumSlabOpeningAreasM2(
  openings: readonly SlabOpeningEntity[] | undefined,
): number {
  if (!openings || openings.length === 0) return 0;
  let total = 0;
  for (const o of openings) {
    if (o.geometry && Number.isFinite(o.geometry.area)) {
      total += o.geometry.area;
    }
  }
  return total;
}

/**
 * Convenience: returns the `bbox` diagonal max dimension σε m. Used από
 * validator για max free span warning (Phase 3 crude check).
 */
export function getSlabMaxBboxDimensionM(params: SlabParams): number {
  const bb = polygonBbox(params.outline.vertices);
  const dx = bb.max.x - bb.min.x;
  const dy = bb.max.y - bb.min.y;
  return Math.max(dx, dy) * MM_TO_M;
}
