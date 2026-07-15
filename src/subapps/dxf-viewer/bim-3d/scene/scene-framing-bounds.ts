/**
 * scene-framing-bounds — pure helpers for selection / scene bounding-box computation.
 * Extracted from `ThreeJsSceneManager` (ADR-366 Phase 4.4) to keep the manager ≤500 LOC
 * per Google file size rule (N.7.1). Pure: no Three.js singletons, no store reads.
 */

import * as THREE from 'three';
import { finiteBox3FromObject } from './finite-bounds';

/**
 * Bounding box of the BIM mesh whose `userData.bimId === bimId`.
 * Returns null if no descendant matches OR the match has no geometry / non-finite bounds
 * (ADR-537 — NaN-safe `finiteBox3FromObject` SSoT, so a corrupt mesh never NaN-frames the camera).
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
  return finiteBox3FromObject(target);
}

/**
 * Combined scene bounds = BIM group + (optional) DXF bounds. Returns null when both
 * are empty so the caller can no-op rather than calling `frameBounds(empty, empty)`.
 * ADR-537 — the BIM bbox is NaN-safe (`finiteBox3FromObject`): a single corrupt BIM entity can no
 * longer poison the scene-framing box that feeds the shared camera.
 */
export function computeSceneFramingBounds(
  bimGroup: THREE.Object3D,
  dxfBounds: THREE.Box3 | null,
): THREE.Box3 | null {
  const bim = finiteBox3FromObject(bimGroup);
  const dxf = dxfBounds && !dxfBounds.isEmpty() ? dxfBounds : null;
  if (!bim && !dxf) return null;
  if (!bim) return dxf;
  if (!dxf) return bim;
  return bim.clone().union(dxf);
}

/**
 * Union bounds of the whole BIM multi-selection (ADR-402 Phase C), or null when NONE of the ids
 * resolve to a framable mesh. Selection-only — no scene-extents fallback, so a caller can union it
 * with a raw-DXF selection box (ADR-366 A.6.Q4 / ADR-537) before deciding whether to fall back.
 */
export function computeBimSelectionUnionBounds(
  bimGroup: THREE.Object3D,
  selectedBimIds: readonly string[],
): THREE.Box3 | null {
  let sel: THREE.Box3 | null = null;
  for (const id of selectedBimIds) {
    const b = computeBimSelectionBounds(bimGroup, id);
    if (!b || b.isEmpty()) continue;
    if (sel) sel.union(b);
    else sel = b;
  }
  return sel && !sel.isEmpty() ? sel : null;
}

/**
 * Selection-aware framing: tries the BIM selection first, falls back to scene extents.
 * ADR-402 Phase C — frames the union bounds of the whole multi-selection.
 * Returns null when nothing is framable (caller should no-op).
 */
export function computeFramingTargetBounds(
  bimGroup: THREE.Object3D,
  dxfBounds: THREE.Box3 | null,
  selectedBimIds: readonly string[],
): THREE.Box3 | null {
  return computeBimSelectionUnionBounds(bimGroup, selectedBimIds)
    ?? computeSceneFramingBounds(bimGroup, dxfBounds);
}
