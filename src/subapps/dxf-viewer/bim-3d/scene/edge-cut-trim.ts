/**
 * ADR-452 — CPU trim of fat-line edge overlays at the horizontal cut plane.
 *
 * The solid faces clip on the GPU (their materials accept clip planes), but the
 * fat-line edge overlay (`LineMaterial`) throws a shader-compile error when
 * clipped on this Three build. To make the edges hide GRADUALLY — shrinking
 * exactly at the cut plane as the slider moves, in lock-step with the faces —
 * we trim the line-segment geometry on the CPU instead:
 *   - segment fully at/below the cut → kept,
 *   - fully above → dropped,
 *   - crossing → trimmed to the intersection point on the plane.
 *
 * Pure + transform-correct (works for rotated/scaled overlays): each endpoint is
 * taken to world space via `matrixWorld`, classified against `worldCutY`, and the
 * trimmed point is mapped back to local space (the geometry stores local coords).
 */

import * as THREE from 'three';

/**
 * Trim flat local line-segment positions (`[x0,y0,z0, x1,y1,z1, …]`, pairs =
 * segments) to keep only the portion at/below `worldCutY`. Returns a NEW local
 * Float32Array (possibly empty when everything is above the cut).
 */
export function clipLineSegmentsToCutY(
  positions: ArrayLike<number>,
  matrixWorld: THREE.Matrix4,
  worldCutY: number,
): Float32Array {
  const inv = new THREE.Matrix4().copy(matrixWorld).invert();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const out: number[] = [];
  const n = positions.length - (positions.length % 6); // whole segments only
  for (let i = 0; i < n; i += 6) {
    a.set(positions[i], positions[i + 1], positions[i + 2]).applyMatrix4(matrixWorld);
    b.set(positions[i + 3], positions[i + 4], positions[i + 5]).applyMatrix4(matrixWorld);
    const aBelow = a.y <= worldCutY;
    const bBelow = b.y <= worldCutY;

    if (aBelow && bBelow) {
      // whole segment kept — emit original local coords verbatim
      out.push(
        positions[i], positions[i + 1], positions[i + 2],
        positions[i + 3], positions[i + 4], positions[i + 5],
      );
    } else if (!aBelow && !bBelow) {
      // whole segment above the cut — drop
      continue;
    } else {
      // crossing — intersection at y = worldCutY (world), mapped back to local
      const t = (worldCutY - a.y) / (b.y - a.y);
      const ix = a.x + (b.x - a.x) * t;
      const iz = a.z + (b.z - a.z) * t;
      const inter = new THREE.Vector3(ix, worldCutY, iz).applyMatrix4(inv);
      if (aBelow) {
        out.push(
          positions[i], positions[i + 1], positions[i + 2],
          inter.x, inter.y, inter.z,
        );
      } else {
        out.push(
          inter.x, inter.y, inter.z,
          positions[i + 3], positions[i + 4], positions[i + 5],
        );
      }
    }
  }
  return new Float32Array(out);
}

/**
 * World-Y extent (min/max) of flat local positions under `matrixWorld`.
 * Used to classify an overlay as fully-below / crossing / fully-above the cut so
 * only the crossing overlays pay the trim+upload cost.
 */
export function worldYRange(
  positions: ArrayLike<number>,
  matrixWorld: THREE.Matrix4,
): { minY: number; maxY: number } {
  const p = new THREE.Vector3();
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 2 < positions.length; i += 3) {
    p.set(positions[i], positions[i + 1], positions[i + 2]).applyMatrix4(matrixWorld);
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minY, maxY };
}
