/**
 * ThreeJsSceneManager — waypoint drag-handle public surface (ADR-366 §C.1.b).
 * Extracted from ThreeJsSceneManager for SRP / file-size SSoT (N.7.1).
 * Pure delegations to WaypointDragHandleRenderer; the manager keeps thin facades.
 */
import type * as THREE from 'three';
import type { WaypointDragHandleRenderer } from '../animation/WaypointDragHandle';

export function getWaypointHandlesRoot(
  disposed: boolean,
  renderer: WaypointDragHandleRenderer,
): THREE.Group | null {
  return disposed ? null : renderer.getHandlesGroup();
}

export function setWaypointHoverState(
  disposed: boolean,
  renderer: WaypointDragHandleRenderer,
  role: 'position' | 'target' | null,
  markDirty: () => void,
): void {
  if (disposed) return;
  renderer.setHoverState(role);
  markDirty();
}

export function setWaypointDragAxisLock(
  disposed: boolean,
  renderer: WaypointDragHandleRenderer,
  axis: 'X' | 'Y' | 'Z' | null,
  markDirty: () => void,
): void {
  if (disposed) return;
  renderer.setAxisLockVisual(axis);
  markDirty();
}

export function pickWaypointAxisArrow(
  disposed: boolean,
  renderer: WaypointDragHandleRenderer,
  domElement: HTMLElement,
  camera: THREE.Camera,
  clientX: number,
  clientY: number,
): 'X' | 'Y' | 'Z' | null {
  return disposed ? null : renderer.pickAxisArrow(domElement, camera, clientX, clientY);
}
