/**
 * applyBuildingVisibility — post-hoc mesh.visible / material mutation per building mode.
 * ADR-369 Q2.3. Pure function, no React.
 * Ghost material reuses getGhostMaterial from floor-visibility-state (SSoT).
 *
 * ADR-382 Phase C role split:
 *   - **Primary 'hide' path**: pre-mesh filter στο `BimSceneLayer.sync()` (resolver
 *     intersection). Buildings με mode='hide' δεν παράγουν meshes καθόλου.
 *   - **This function**: applies ghost styling for mode='ghost', and defense-in-
 *     depth for building toggles between rebuilds. Show restores original material.
 *
 * Symmetric με `applyFloorVisibility`. Keep idempotent.
 */

import * as THREE from 'three';
import type { BuildingVisMode } from './building-visibility-state';
import { getGhostMaterial } from './floor-visibility-state';

const ORIGINAL_MATERIAL = new WeakMap<THREE.Mesh, THREE.Material | THREE.Material[]>();

export function applyBuildingVisibility(
  group: THREE.Group,
  modes: ReadonlyMap<string, BuildingVisMode>,
): void {
  for (const child of group.children) {
    if (!(child instanceof THREE.Mesh)) continue;
    const buildingId = child.userData['buildingId'] as string | undefined;
    const mode: BuildingVisMode = buildingId ? (modes.get(buildingId) ?? 'show') : 'show';

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
