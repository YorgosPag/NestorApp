/**
 * Slab-type live-preview band geometry (ADR-412/ADR-414) — pure math for the
 * «Edit Slab Type» dialog's 3D preview panel. Slab analogue of
 * `wall-type-preview-geometry.ts`.
 *
 * Shows a synthetic flat SLAB stub built straight from a `SlabDna`: a thin box
 * per layer, STACKED VERTICALLY across the slab thickness (Y). Unlike the wall
 * preview (layers across thickness in Z), slab layers read top→bottom in Y —
 * exactly how a real floor section reads (finish on top, soffit at the bottom).
 *
 * Reuses the entity-agnostic SSoT `buildupBoundaryFractions` so the band
 * boundaries match what the real 3D multi-layer slab renders (Phase B). Returns
 * dimensions in METERS (the 3D scene + world-meter UV convention) so the shared
 * texture singletons tile physically.
 *
 * Layer 0 (fraction 0) is the TOP face (+Y); fraction 1 is the BOTTOM (−Y).
 *
 * Pure geometry — no THREE objects, no store reads.
 *
 * @see bim/types/layered-buildup.ts — buildupBoundaryFractions (shared SSoT)
 * @see wall-type-preview-geometry.ts — the wall sibling
 */

import type { SlabDna } from '../../bim/types/slab-dna-types';
import { buildupBoundaryFractions } from '../../bim/types/layered-buildup';

/** One preview band: a box sized + positioned across the slab thickness (Y). */
export interface SlabPreviewBand {
  /** DNA layer id — stable key for highlight + raycast tagging. */
  readonly layerId: string;
  /** DNA materialId → `getMaterial3D`. */
  readonly materialId: string;
  /** Box height along Y (meters) = this layer's share of the total thickness. */
  readonly heightM: number;
  /** Box center Y (meters), measured from the slab mid-plane (Y=0). */
  readonly centerYM: number;
}

/** mm → m. */
function mmToM(mm: number): number {
  return mm / 1000;
}

/**
 * Build the per-layer preview bands for a slab DNA. Returns one band per
 * positive-thickness layer, centered on the slab mid-plane (Y=0), top layer at
 * +Y. Empty array when the DNA has no positive total thickness.
 */
export function buildSlabTypePreviewBands(dna: SlabDna): SlabPreviewBand[] {
  const totalM = mmToM(dna.totalThickness);
  if (totalM <= 1e-6) return [];
  const fracs = buildupBoundaryFractions(dna);
  const bands: SlabPreviewBand[] = [];
  for (let i = 0; i < dna.layers.length; i++) {
    const layer = dna.layers[i];
    const f0 = fracs[i];
    const f1 = fracs[i + 1];
    const heightM = (f1 - f0) * totalM;
    if (heightM < 1e-6) continue; // zero-thickness layer → skip
    // Top (f=0) at +Y; bottom (f=1) at −Y.
    const yNear = totalM / 2 - f0 * totalM;
    const yFar = totalM / 2 - f1 * totalM;
    bands.push({
      layerId: layer.id,
      materialId: layer.materialId,
      heightM,
      centerYM: (yNear + yFar) / 2,
    });
  }
  return bands;
}
