/**
 * cinema4d-grid-frame.ts — per-frame grid CPU math (ADR-558, pure helpers).
 *
 * The decade LOD now lives ENTIRELY in the fragment shader (per-fragment `fwidth`), so the CPU only
 * derives the distance-fog radii that dissolve the bounded plane into the horizon. Tying them to the
 * camera→target distance keeps the horizon at a constant screen depth at every zoom. Pure →
 * unit-testable without a WebGL context.
 *
 * @module bim-3d/scene/grid/cinema4d-grid-frame
 */

import { GRID3D_FADE_START_K, GRID3D_FADE_END_K } from './cinema4d-grid-config';

export interface Grid3DFogInput {
  /** Camera → orbit-target distance (m). */
  readonly distance: number;
}

export interface Grid3DFog {
  readonly fadeStart: number;
  readonly fadeEnd: number;
}

/** Distance-fog radii (world m) for the horizon dissolve, scaled by the view distance. */
export function computeGrid3DFog(input: Grid3DFogInput): Grid3DFog {
  const d = Math.max(input.distance, 1e-3);
  return {
    fadeStart: d * GRID3D_FADE_START_K,
    fadeEnd: d * GRID3D_FADE_END_K,
  };
}
