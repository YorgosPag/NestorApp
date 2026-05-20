/**
 * applyFloorVisibility — mutates Three.js Group mesh visibility per floor mode.
 * ADR-366 Phase 4 Group B (B.3). Pure function, no React.
 */

import * as THREE from 'three';
import type { FloorVisMode } from './floor-visibility-state';
import { getGhostMaterial } from './floor-visibility-state';

// Track original materials so we can restore them when mode → 'show'.
const ORIGINAL_MATERIAL = new WeakMap<THREE.Mesh, THREE.Material | THREE.Material[]>();

export function applyFloorVisibility(
  group: THREE.Group,
  modes: ReadonlyMap<string, FloorVisMode>,
): void {
  for (const child of group.children) {
    if (!(child instanceof THREE.Mesh)) continue;
    const levelId = child.userData['levelId'] as string | undefined;
    const mode: FloorVisMode = levelId ? (modes.get(levelId) ?? 'show') : 'show';

    if (mode === 'show') {
      child.visible = true;
      const orig = ORIGINAL_MATERIAL.get(child);
      if (orig) {
        child.material = orig;
        ORIGINAL_MATERIAL.delete(child);
      }
    } else if (mode === 'hide') {
      child.visible = false;
    } else {
      // ghost
      child.visible = true;
      if (!ORIGINAL_MATERIAL.has(child)) {
        ORIGINAL_MATERIAL.set(child, child.material);
      }
      const origMat = ORIGINAL_MATERIAL.get(child)!;
      child.material = Array.isArray(origMat)
        ? origMat.map(getGhostMaterial)
        : getGhostMaterial(origMat);
    }
  }
}
