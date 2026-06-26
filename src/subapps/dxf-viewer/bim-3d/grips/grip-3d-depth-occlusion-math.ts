/**
 * grip-3d-depth-occlusion-math.ts — PURE math for the GPU depth-occlusion of the 3D
 * reshape-grip overlay (ADR-535 Φ5b).
 *
 * The grips are a Canvas2D overlay drawn with the ONE 2D `UnifiedGripRenderer` (Φ5). To show
 * ONLY the foreground ones — Revit / Maxon (Cinema 4D) handle occlusion — we test each grip
 * against the GPU depth of the solid scene: a grip sitting BEHIND a solid surface (another
 * entity OR the selected entity's own body) is culled from both the draw and the hit-test.
 *
 * This module is the PURE, deterministic slice (no THREE render, no GPU): it projects a grip
 * world point to its depth-probe sample (screen UV + eye-space Z), decides occlusion with the
 * SAME formula the probe fragment shader runs (documentation + jest parity), and decodes the
 * GPU read-back bytes back into per-grip visibility. The GPU plumbing lives in
 * `grip-3d-depth-occluder.ts`.
 */

import * as THREE from 'three';

/** One grip's depth-probe inputs, derived from its world position + the live camera. */
export interface GripProbeSample {
  /** Depth-texture sample coordinate (screen UV, [0..1]). */
  readonly u: number;
  readonly v: number;
  /** Eye-space Z (negative in front of the camera) of the grip itself. */
  readonly viewZ: number;
  /** True when the grip is behind the camera or outside the frustum sides — never culled. */
  readonly offscreen: boolean;
}

const _view = new THREE.Vector3();
const _ndc = new THREE.Vector3();

/**
 * Project a grip world point to its depth-probe sample for the given camera. Returns the
 * screen UV at which to read the scene depth, the grip's own eye-space Z, and whether it
 * falls off-screen (off-screen grips are drawn out of view anyway and must never be culled
 * by occlusion). Pure — mutates only module-local scratch vectors.
 */
export function projectGripToProbe(world: THREE.Vector3, camera: THREE.Camera): GripProbeSample {
  // Eye-space Z (camera looks down −Z, so a visible grip has negative viewZ).
  _view.copy(world).applyMatrix4(camera.matrixWorldInverse);
  const viewZ = _view.z;
  // NDC → screen UV.
  _ndc.copy(world).project(camera);
  const u = _ndc.x * 0.5 + 0.5;
  const v = _ndc.y * 0.5 + 0.5;
  const offscreen = _ndc.z > 1 || _ndc.z < -1 || u < 0 || u > 1 || v < 0 || v > 1;
  return { u, v, viewZ, offscreen };
}

/**
 * Occlusion decision — the SAME rule the probe fragment shader applies (kept here for jest
 * parity + documentation). Both Z values are eye-space (negative in front of the camera); a
 * nearer surface has the LARGER (less negative) Z. A grip is occluded only when it sits at
 * least `biasMeters` BEHIND the nearest rendered surface — the bias absorbs the coplanar
 * self-surface case (a grip resting on its own face must NOT hide itself).
 */
export function isGripOccluded(gripViewZ: number, sceneViewZ: number, biasMeters: number): boolean {
  return gripViewZ < sceneViewZ - biasMeters;
}

/**
 * Decode the N×1 RGBA read-back buffer into per-grip visibility. The probe writes red = 1.0
 * (255) for a visible grip, 0 for an occluded one. Off-screen grips (per `offscreen[i]`) are
 * forced visible — they are simply outside the canvas, never "behind" geometry.
 */
export function decodeGripVisibility(
  bytes: Uint8Array,
  count: number,
  offscreen: readonly boolean[],
): boolean[] {
  const out: boolean[] = new Array(count);
  for (let i = 0; i < count; i++) {
    out[i] = offscreen[i] === true ? true : bytes[i * 4] >= 128;
  }
  return out;
}

/** Map a probe slot index to its clip-space X so point `i` rasterises into pixel column `i`. */
export function probeSlotClipX(index: number, count: number): number {
  return ((index + 0.5) / count) * 2 - 1;
}
