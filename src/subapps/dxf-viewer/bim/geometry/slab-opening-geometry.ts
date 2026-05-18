/**
 * Slab-opening geometry computation (ADR-363 Phase 3.7).
 *
 * Pure SSoT function — derives `SlabOpeningGeometry` cache από
 * `SlabOpeningParams`. Idempotent + side-effect free. Re-uses shared
 * polygon-utils (mirrors `slab-geometry.ts`):
 *
 *   1. polygon = params.outline (closed CCW, mm world coords)
 *   2. area (m²) = |shoelaceArea| / 1e6
 *   3. perimeter (m) = sum-of-edges / 1000
 *   4. bbox (mm) = AABB folds vertices σε z=0 plane
 *
 * Caller MUST ensure `outline.vertices.length >= 3` (validator guard).
 * Όταν λιγότερες κορυφές → area/perimeter = 0.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5 §11.Q3
 */

import type {
  SlabOpeningGeometry,
  SlabOpeningParams,
} from '../types/slab-opening-types';
import {
  polygonArea,
  polygonBbox,
  polygonPerimeter,
} from './shared/polygon-utils';

const MM_TO_M = 1 / 1000;

/**
 * Compute `SlabOpeningGeometry` από `SlabOpeningParams`. Pure SSoT. Throws
 * nothing — validation lives σε `validateSlabOpeningParams()`.
 */
export function computeSlabOpeningGeometry(
  params: SlabOpeningParams,
): SlabOpeningGeometry {
  const vertices = params.outline.vertices;
  const bbox = polygonBbox(vertices);
  const areaMm2 = polygonArea(vertices);
  const perimeterMm = polygonPerimeter(vertices);
  return {
    polygon: params.outline,
    bbox,
    area: areaMm2 * (MM_TO_M * MM_TO_M),
    perimeter: perimeterMm * MM_TO_M,
  };
}

/**
 * Convenience: largest dimension (X ή Y) σε mm από bbox. Χρησιμοποιείται
 * από validator + ribbon dimensions readout.
 */
export function getSlabOpeningMaxDimensionMm(
  params: SlabOpeningParams,
): number {
  const bb = polygonBbox(params.outline.vertices);
  return Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y);
}

/**
 * Convenience: smallest dimension (X ή Y) σε mm από bbox.
 * Used by code-violation min-dimension check.
 */
export function getSlabOpeningMinDimensionMm(
  params: SlabOpeningParams,
): number {
  const bb = polygonBbox(params.outline.vertices);
  return Math.min(bb.max.x - bb.min.x, bb.max.y - bb.min.y);
}
