/**
 * screen-dot-material — a round marker of constant ON-SCREEN size, HiDPI-correct (ADR-920 Β4.8 Β2.2).
 *
 * Extracted from the auto-breakline review's corner markers when the committed breaklines needed the
 * same disc for their vertices (N.18). Three decisions travel with it and must not drift apart:
 *
 * - `sizeAttenuation: false` → the same size at any camera distance, like the ⊙ marker and 2D grips.
 * - `size` is applied by three in DEVICE pixels (`gl_PointSize = size`, no ratio anywhere), so it is
 *   re-scaled by the viewport's pixel ratio on every change — otherwise a 4 px dot is 2 px on a HiDPI
 *   screen, which is exactly where it stops being findable.
 * - The disc is the shared generated texture (`round-dot-texture`), not a `gl_PointCoord` discard: same
 *   round result with an antialiased rim, and none of the `onBeforeCompile` hazards ADR-689 records.
 *   `transparent` (not `alphaToCoverage`) is safe because a marker set never overlaps itself.
 *
 * The texture is SHARED, so it is not freed here — `disposeRoundDotTexture` belongs to the one
 * teardown that knows every user is gone (`disposeTerrainMaterials3D`).
 *
 * @module bim-3d/materials/screen-dot-material
 * @enterprise ADR-920 — Topography breaklines · ADR-650 — Topography · ADR-584 — Anti-Duplication
 */

import * as THREE from 'three';
import { bimEdgeResolutionStore } from '../edges/bim-edge-resolution-store';
import { getRoundDotTexture } from './round-dot-texture';

export interface ScreenDotMaterialParams {
  /** Fill colour (CSS hex). */
  readonly color: string;
  /** On-screen diameter in CSS px (pre-DPR). */
  readonly diameterPx: number;
  /** false → visible THROUGH occluding geometry. Default true. */
  readonly depthTest?: boolean;
}

export interface ScreenDotMaterial {
  readonly material: THREE.PointsMaterial;
  /** Stop tracking the pixel ratio. Does NOT dispose the material — the caller owns it. */
  readonly unsubscribe: () => void;
}

export function createScreenDotMaterial(params: ScreenDotMaterialParams): ScreenDotMaterial {
  const texture = getRoundDotTexture();
  const material = new THREE.PointsMaterial({
    color: new THREE.Color(params.color).getHex(),
    size: params.diameterPx,
    sizeAttenuation: false,
    depthTest: params.depthTest ?? true,
    depthWrite: false,
    transparent: true,
    ...(texture ? { map: texture } : null),
  });
  const applyRatio = (): void => {
    material.size = params.diameterPx * bimEdgeResolutionStore.getSize().pixelRatio;
  };
  applyRatio();
  return { material, unsubscribe: bimEdgeResolutionStore.subscribe(applyRatio) };
}
