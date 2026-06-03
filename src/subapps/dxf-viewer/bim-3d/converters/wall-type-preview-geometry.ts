/**
 * Wall-type live-preview band geometry (ADR-414) — pure math for the «Edit Wall
 * Type» dialog's left-hand 3D preview panel.
 *
 * Unlike `wall-layer-geometry.ts` (which splits a PLACED wall's along-length
 * `WallOpeningPiece`s across thickness), the preview shows a synthetic STRAIGHT
 * wall stub built straight from a `WallDna`: a short box per layer, stacked across
 * the wall thickness. This decouples the dialog from `WallEntity` geometry — it
 * only needs the draft `dna`.
 *
 * Reuses the ADR-413 SSoT `layerBoundaryFractions` so the band boundaries match
 * exactly what the real 3D wall renders. Dimensions are returned in METERS (the
 * 3D scene unit + the world-meter UV convention of `bim-uv-helpers.ts`), so the
 * shared texture singletons (`repeat = 1/tileSizeM`) tile physically.
 *
 * Layer order is exterior→interior; the exterior layer (fraction 0) sits at the
 * +Z face (toward the viewer in the 3/4 preview camera), matching the 2D
 * cross-section reading direction.
 *
 * Pure geometry — no THREE objects, no store reads. Each fn ≤40 lines.
 *
 * @see wall-layer-geometry.ts — placed-wall per-layer split (shares the fractions)
 * @see docs/centralized-systems/reference/adrs/ADR-414-wall-type-live-preview.md
 */

import type { WallDna } from '../../bim/types/wall-dna-types';
import { layerBoundaryFractions } from './wall-layer-geometry';

/** Stub dimensions (meters) for the synthetic preview wall. */
export interface WallPreviewStubDims {
  /** Length along X (meters). */
  readonly lengthM: number;
  /** Height along Y (meters). */
  readonly heightM: number;
}

/** One preview band: a box sized + positioned across the wall thickness (Z). */
export interface WallPreviewBand {
  /** DNA layer id — stable key for highlight + raycast tagging. */
  readonly layerId: string;
  /** DNA materialId → `getMaterial3D`. */
  readonly materialId: string;
  /** Box depth along Z (meters) = this layer's share of the total thickness. */
  readonly depthM: number;
  /** Box center Z (meters), measured from the wall mid-plane (Z=0). */
  readonly centerZM: number;
}

/** mm → m. */
function mmToM(mm: number): number {
  return mm / 1000;
}

/**
 * Build the per-layer preview bands for a DNA. Returns one band per positive-
 * thickness layer, centered on the wall mid-plane (Z=0), exterior at +Z. Empty
 * array when the DNA has no positive total thickness.
 */
export function buildWallTypePreviewBands(dna: WallDna): WallPreviewBand[] {
  const totalM = mmToM(dna.totalThickness);
  if (totalM <= 1e-6) return [];
  const fracs = layerBoundaryFractions(dna);
  const bands: WallPreviewBand[] = [];
  for (let i = 0; i < dna.layers.length; i++) {
    const layer = dna.layers[i];
    const f0 = fracs[i];
    const f1 = fracs[i + 1];
    const depthM = (f1 - f0) * totalM;
    if (depthM < 1e-6) continue; // zero-thickness layer → skip
    // Exterior (f=0) at +Z front; interior (f=1) at -Z back.
    const zNear = totalM / 2 - f0 * totalM;
    const zFar = totalM / 2 - f1 * totalM;
    bands.push({
      layerId: layer.id,
      materialId: layer.materialId,
      depthM,
      centerZM: (zNear + zFar) / 2,
    });
  }
  return bands;
}
