/**
 * band-stack-fit — the pure camera-fit math behind every «Edit … Type» dialog
 * preview (ADR-412/ADR-414). Extracted OUT of `BandStackPreviewRenderer` so the
 * hardest maths in the preview is unit-testable without a WebGL context: the
 * renderer owns the GPU, this owns the geometry.
 *
 * @see band-stack-preview-renderer.ts — the only caller
 */

import * as THREE from 'three';

/** Breathing margin so the tight fit doesn't graze the frustum edge. */
export const FIT_MARGIN = 1.04;

const WORLD_UP = new THREE.Vector3(0, 1, 0);

/**
 * Distance from the origin along `viewDir` at which a box of the given half-
 * extents is **fully** inside the frustum — every one of its 8 corners inside
 * BOTH the horizontal and vertical FOV — and no further.
 *
 * Solves it exactly rather than via a bounding sphere: a sphere over-zooms an
 * asymmetric 3/4 view and clipped the near corner (ADR-414 changelog (b)). For
 * each corner we take its depth along the view axis plus the distance the camera
 * must back off for that corner's lateral/vertical offset to fall inside the
 * respective FOV, and keep the worst case.
 */
export function solveFitDistance(
  halfExtents: readonly [number, number, number],
  viewDir: THREE.Vector3,
  fovDeg: number,
  aspect: number,
): number {
  const [hx, hy, hz] = halfExtents;
  const right = new THREE.Vector3().crossVectors(WORLD_UP, viewDir).normalize();
  const up = new THREE.Vector3().crossVectors(viewDir, right);
  const tanV = Math.tan((fovDeg * Math.PI) / 180 / 2);
  const tanH = tanV * aspect;
  let dist = 0;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const p = new THREE.Vector3(sx * hx, sy * hy, sz * hz);
    const depthAt = p.dot(viewDir); // corner's offset toward the camera
    dist = Math.max(dist, depthAt + Math.abs(p.dot(right)) / tanH, depthAt + Math.abs(p.dot(up)) / tanV);
  }
  return dist * FIT_MARGIN;
}
