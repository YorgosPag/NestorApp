/**
 * scene-framing-bounds — pure helpers for selection / scene bounding-box computation.
 * Extracted from `ThreeJsSceneManager` (ADR-366 Phase 4.4) to keep the manager ≤500 LOC
 * per Google file size rule (N.7.1). Pure: no Three.js singletons, no store reads.
 */

import * as THREE from 'three';

/**
 * Bounding box of the BIM mesh whose `userData.bimId === bimId`.
 * Returns null if no descendant matches; empty Box3 if the match has no geometry.
 */
export function computeBimSelectionBounds(
  bimGroup: THREE.Object3D,
  bimId: string,
): THREE.Box3 | null {
  let target: THREE.Object3D | null = null;
  bimGroup.traverse((obj) => {
    if (target) return;
    if (obj.userData['bimId'] === bimId) target = obj;
  });
  if (!target) return null;
  return new THREE.Box3().setFromObject(target);
}

/**
 * Combined scene bounds = BIM group + (optional) DXF bounds. Returns null when both
 * are empty so the caller can no-op rather than calling `frameBounds(empty, empty)`.
 */
export function computeSceneFramingBounds(
  bimGroup: THREE.Object3D,
  dxfBounds: THREE.Box3 | null,
): THREE.Box3 | null {
  const bim = new THREE.Box3().setFromObject(bimGroup);
  if (bim.isEmpty() && (!dxfBounds || dxfBounds.isEmpty())) return null;
  if (bim.isEmpty()) return dxfBounds;
  if (!dxfBounds || dxfBounds.isEmpty()) return bim;
  return bim.clone().union(dxfBounds);
}

/**
 * Selection-aware framing: tries the selection first, falls back to scene extents.
 * ADR-402 Phase C — frames the union bounds of the whole multi-selection.
 * Returns null when nothing is framable (caller should no-op).
 */
export function computeFramingTargetBounds(
  bimGroup: THREE.Object3D,
  dxfBounds: THREE.Box3 | null,
  selectedBimIds: readonly string[],
): THREE.Box3 | null {
  let sel: THREE.Box3 | null = null;
  for (const id of selectedBimIds) {
    const b = computeBimSelectionBounds(bimGroup, id);
    if (!b || b.isEmpty()) continue;
    if (sel) sel.union(b);
    else sel = b;
  }
  if (sel && !sel.isEmpty()) return sel;
  return computeSceneFramingBounds(bimGroup, dxfBounds);
}
