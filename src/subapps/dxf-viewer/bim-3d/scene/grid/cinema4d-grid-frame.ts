/**
 * cinema4d-grid-frame.ts — per-frame grid CPU math (ADR-558, pure helper).
 *
 * The decade LOD is computed PER FRAGMENT in the shader (from the screen-space derivative), so the
 * grid spawns/merges lines continuously with BOTH zoom and camera tilt. The only CPU per-frame work
 * is the horizon-fade band — the distances from the camera at which the grid begins / finishes
 * dissolving into the grey background (C4D melts the grid into the horizon; no hard edge). Tying the
 * radii to the camera distance keeps the fade near the horizon at any zoom; a hard ceiling caps how
 * far the grid ever reaches. Pure → unit-testable without WebGL.
 *
 * @module bim-3d/scene/grid/cinema4d-grid-frame
 */

import { GRID3D_FADE_NEAR_K, GRID3D_FADE_FAR_K, GRID3D_MAX_REACH_M } from './cinema4d-grid-config';

export interface Grid3DFrameInput {
  /** Camera → orbit-target distance (m). */
  readonly distance: number;
}

export interface Grid3DFrame {
  /** Distance from the camera (m) where the grid is still full strength. */
  readonly fadeNear: number;
  /** Distance from the camera (m) where the grid has fully dissolved (capped at GRID3D_MAX_REACH_M). */
  readonly fadeFar: number;
}

/** Horizon-fade radii for this frame: view-relative (× camera distance) but capped at the hard reach. */
export function computeGrid3DFrame(input: Grid3DFrameInput): Grid3DFrame {
  const d = Math.max(input.distance, 1e-3);
  const fadeFar = Math.min(d * GRID3D_FADE_FAR_K, GRID3D_MAX_REACH_M);
  return {
    fadeNear: Math.min(d * GRID3D_FADE_NEAR_K, fadeFar * 0.6), // keep near < far
    fadeFar,
  };
}
