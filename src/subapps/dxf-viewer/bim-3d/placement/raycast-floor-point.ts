/**
 * raycast-floor-point — SSoT for projecting a screen click onto the active
 * floor plane in the 3D viewport.
 *
 * ADR-403 (3D BIM Element Placement). Reuses the existing SSoT pieces — no new
 * raycast/NDC/plane math:
 *   - `clientToNdc` (BimEntityRaycaster) — client px → NDC.
 *   - `computeFloorPlane` (bim3d-edit-math) — the Y-up work-plane at an
 *     elevation (the same plane the gizmo move drag projects onto).
 *   - `raycaster.ray.intersectPlane` — the canonical ray↔plane pattern used by
 *     the waypoint drag controller and the section box.
 *
 * Module-level raycaster avoids per-call allocation (mirrors BimEntityRaycaster).
 */

import * as THREE from 'three';
import { clientToNdc } from '../systems/raycaster/BimEntityRaycaster';
import { computeFloorPlane } from '../utils/bim3d-edit-math';
import { useViewMode3DStore } from '../stores/ViewMode3DStore';
import { useBim3DEntitiesStore } from '../stores/Bim3DEntitiesStore';
import { getMultiFloorStack } from '../scene/multi-floor-3d-source';

const _raycaster = new THREE.Raycaster();

/**
 * Project a screen click (clientX/clientY) onto the horizontal floor plane at
 * `floorElevationMm`, returning the WORLD-space hit point (metres) or null when
 * the element is not laid out or the ray is parallel to the floor.
 */
export function raycastFloorPoint(
  camera: THREE.Camera,
  domElement: HTMLElement,
  clientX: number,
  clientY: number,
  floorElevationMm: number,
): THREE.Vector3 | null {
  const ndc = clientToNdc(domElement, clientX, clientY);
  if (!ndc) return null;
  _raycaster.setFromCamera(ndc, camera);
  const plane = computeFloorPlane(floorElevationMm);
  const out = new THREE.Vector3();
  return _raycaster.ray.intersectPlane(plane, out) ? out : null;
}

/**
 * Elevation (mm) of the floor a new BIM element should be placed on — always the
 * ACTIVE floor (Giorgio's decision, ADR-403):
 *   - single-floor scope → 0 (every entity elevation is floor-relative).
 *   - "Όλοι οι όροφοι" (all) → the active floor's `floorElevationMm` from the
 *     multi-floor stack, so a click stays on the floor being edited rather than
 *     drifting onto another storey's slab.
 */
export function resolveActiveFloorElevationMm(): number {
  const vm = useViewMode3DStore.getState();
  if (vm.floor3DScope !== 'all') return 0;
  const activeLevelId = useBim3DEntitiesStore.getState().activeLevelId;
  const active = getMultiFloorStack().find((e) => e.levelId === activeLevelId);
  return active?.floorElevationMm ?? 0;
}
