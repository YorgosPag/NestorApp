/**
 * grip-3d-hit-test.ts — raycaster vs 3D reshape-grip hitboxes (ADR-535 Φ1).
 *
 * Mirror of `gizmo-hit-test.testGizmoHit` but WITHOUT priority: every reshape grip
 * is an equal, discrete square, so the nearest intersection wins. `intersectObjects`
 * already returns hits sorted by ascending distance, so the first entry is nearest.
 *
 * Pure Three.js — no React, no store.
 */

import type * as THREE from 'three';

/**
 * Test the raycaster against the grip hitbox meshes. Returns the `gripIndex` of the
 * nearest hit (via `hitboxToIndex`), or null when nothing was hit.
 */
export function testGrip3DHit(
  raycaster: THREE.Raycaster,
  hitboxes: readonly THREE.Mesh[],
  hitboxToIndex: ReadonlyMap<THREE.Mesh, number>,
): number | null {
  if (hitboxes.length === 0) return null;
  const hits = raycaster.intersectObjects([...hitboxes], false);
  if (hits.length === 0) return null;
  const idx = hitboxToIndex.get(hits[0].object as THREE.Mesh);
  return idx ?? null;
}
