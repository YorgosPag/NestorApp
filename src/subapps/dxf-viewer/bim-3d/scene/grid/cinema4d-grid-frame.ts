/**
 * cinema4d-grid-frame.ts — per-frame grid CPU math (ADR-558, pure helpers).
 *
 * The decade LOD lives ENTIRELY in the fragment shader (per-fragment `fwidth`), so the CPU only
 * derives the hard finite EXTENT at which the grid stops. C4D does NOT distance-fade the grid toward
 * the horizon — the lines simply end at a boundary (verified: GetGridStep's `fade` is the LOD
 * crossfade, not a distance fade). Tying the extent to the camera→target distance keeps the hard
 * edge near the horizon at every zoom. Pure → unit-testable without a WebGL context.
 *
 * @module bim-3d/scene/grid/cinema4d-grid-frame
 */

import { GRID3D_EXTENT_K } from './cinema4d-grid-config';

export interface Grid3DExtentInput {
  /** Camera → orbit-target distance (m). */
  readonly distance: number;
}

/** Hard finite half-size (world m) of the grid square around the target — where the lines STOP. */
export function computeGrid3DExtent(input: Grid3DExtentInput): number {
  return Math.max(input.distance, 1e-3) * GRID3D_EXTENT_K;
}
