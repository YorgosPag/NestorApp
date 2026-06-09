'use client';

/**
 * ADR-408 — Relocatable gizmo base point / rotation centre (Revit «pick base point»).
 *
 * Ctrl+click on the selected entity relocates the gizmo origin (rotation pivot +
 * move base). This module resolves WHERE: it raycasts the entity's OWN meshes and
 * snaps to a vertex/edge/face via the ONE 3D snap SSoT (`pickDim3DSnap`, ADR-366) —
 * no new snap math. Returns the world point, or null when the cursor missed the
 * selected geometry. Pure-ish: no scene mutation, no store, no React.
 */

import * as THREE from 'three';
import {
  pickDim3DSnap,
  DEFAULT_DIM3D_SNAP_TOGGLES,
} from '../dimensions/dim3d-snap-engine-adapter';

export interface BasePointPickParams {
  readonly group: THREE.Object3D;
  readonly camera: THREE.Camera;
  readonly domElement: HTMLElement;
  readonly entityIds: readonly string[];
  readonly clientX: number;
  readonly clientY: number;
}

/**
 * Snap-pick a base point on the selected entity under the cursor. Collects only the
 * meshes tagged with one of `entityIds` (so the pick can't grab a neighbour), then
 * delegates to the 3D snap SSoT. Returns the world point, or null on a miss.
 */
export function pickEntityBasePoint(
  params: BasePointPickParams,
): { x: number; y: number; z: number } | null {
  const targets = collectEntityMeshes(params.group, params.entityIds);
  if (targets.length === 0) return null;
  const res = pickDim3DSnap({
    camera: params.camera,
    clientX: params.clientX,
    clientY: params.clientY,
    domElement: params.domElement,
    targets,
    toggles: DEFAULT_DIM3D_SNAP_TOGGLES,
  });
  if (res.mode === 'none') return null;
  return { x: res.position.x, y: res.position.y, z: res.position.z };
}

/** Every mesh under `group` tagged with one of the edited entity ids. */
function collectEntityMeshes(
  group: THREE.Object3D,
  entityIds: readonly string[],
): THREE.Object3D[] {
  const wanted = new Set(entityIds);
  const out: THREE.Object3D[] = [];
  group.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const id = obj.userData['bimId'] as string | undefined;
    if (id !== undefined && wanted.has(id)) out.push(obj);
  });
  return out;
}
