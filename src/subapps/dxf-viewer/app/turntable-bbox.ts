/**
 * turntable-bbox — bbox resolver για το turntable animation path.
 * Extracted από `useDxfViewerCallbacks` (ADR-065 SRP split / ADR-366 §C.1.b).
 */

import type { SceneBbox } from '../bim-3d/animation/core/TurntablePathBuilder';
import { useCameraTargetStore } from '../bim-3d/stores/CameraTargetStore';
import { getSceneBbox } from '../bim-3d/stores/SceneBboxProvider';

/**
 * ADR-366 §C.1.b — camera-derived fallback bbox για turntable όταν δεν υπάρχει
 * mounted BIM scene (e.g. 2D-only viewer, ή empty 3D scene). Real bbox έρχεται
 * πρώτα από `getSceneBbox()` (SceneBboxProvider registered by BimViewport3D).
 * Fallback radius = camera→target distance / 2.
 */
function syntheticBboxFromCamera(): SceneBbox {
  const cam = useCameraTargetStore.getState();
  const dx = cam.position.x - cam.target.x;
  const dy = cam.position.y - cam.target.y;
  const dz = cam.position.z - cam.target.z;
  const radius = Math.max(2, Math.sqrt(dx * dx + dy * dy + dz * dz) * 0.5);
  return {
    min: { x: cam.target.x - radius, y: cam.target.y - radius, z: cam.target.z - radius },
    max: { x: cam.target.x + radius, y: cam.target.y + radius, z: cam.target.z + radius },
  };
}

/** Real BIM scene bbox first, camera fallback when 3D unmounted ή empty. */
export function resolveTurntableBbox(): SceneBbox {
  return getSceneBbox() ?? syntheticBboxFromCamera();
}
