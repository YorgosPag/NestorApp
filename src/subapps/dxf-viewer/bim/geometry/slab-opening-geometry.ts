/**
 * Slab-opening geometry computation (ADR-363 Phase 3.7, ADR-370 scene-units SSoT).
 *
 * Pure SSoT function — derives `SlabOpeningGeometry` cache από
 * `SlabOpeningParams`. Idempotent + side-effect free. Mirrors `slab-geometry`:
 *
 *   1. polygon = params.outline (closed CCW, σε scene-units world coords)
 *   2. area (m²)        = shoelace * canvasToM²
 *   3. perimeter (m)    = sum-of-edges * canvasToM
 *   4. bbox             = AABB folds vertices σε z=0 plane (scene-units)
 *
 * Όπου `canvasToM = (1 / mmToSceneUnits(sceneUnits)) * 1e-3`, ώστε vertices σε
 * `m` / `cm` / `mm` / `in` / `ft` να μετατρέπονται σωστά σε metres.
 *
 * Caller MUST ensure `outline.vertices.length >= 3` (validator guard).
 * Όταν λιγότερες κορυφές → area/perimeter = 0.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5 §11.Q3
 * @see docs/centralized-systems/reference/adrs/ADR-370-bim-readonly-visualization.md
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
import { mmToSceneUnits } from '../../utils/scene-units';

const MM_TO_M = 1 / 1000;

/**
 * Compute `SlabOpeningGeometry` από `SlabOpeningParams`. Pure SSoT. Throws
 * nothing — validation lives σε `validateSlabOpeningParams()`.
 */
export function computeSlabOpeningGeometry(
  params: SlabOpeningParams,
): SlabOpeningGeometry {
  const s = mmToSceneUnits(params.sceneUnits ?? 'mm');
  const canvasToM = (1 / s) * MM_TO_M;

  const vertices = params.outline.vertices;
  const bbox = polygonBbox(vertices);
  const areaCanvas2 = polygonArea(vertices);
  const perimeterCanvas = polygonPerimeter(vertices);
  return {
    polygon: params.outline,
    bbox,
    area: areaCanvas2 * canvasToM * canvasToM,
    perimeter: perimeterCanvas * canvasToM,
  };
}

/**
 * Convenience: largest dimension (X ή Y) σε mm από bbox. Χρησιμοποιείται
 * από validator + ribbon dimensions readout. Always returns mm regardless
 * of `params.sceneUnits`.
 */
export function getSlabOpeningMaxDimensionMm(
  params: SlabOpeningParams,
): number {
  const canvasToMm = 1 / mmToSceneUnits(params.sceneUnits ?? 'mm');
  const bb = polygonBbox(params.outline.vertices);
  return Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y) * canvasToMm;
}

/**
 * Convenience: smallest dimension (X ή Y) σε mm από bbox.
 * Used by code-violation min-dimension check. Always returns mm.
 */
export function getSlabOpeningMinDimensionMm(
  params: SlabOpeningParams,
): number {
  const canvasToMm = 1 / mmToSceneUnits(params.sceneUnits ?? 'mm');
  const bb = polygonBbox(params.outline.vertices);
  return Math.min(bb.max.x - bb.min.x, bb.max.y - bb.min.y) * canvasToMm;
}
