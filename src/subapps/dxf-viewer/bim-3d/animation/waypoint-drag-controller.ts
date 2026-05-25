'use client';

/**
 * ADR-366 §C.1.b — Waypoint Drag Controller (pure FSM + Three.js plane math).
 *
 * Owns the drag finite-state machine for the active waypoint handles:
 *
 *   idle  ──pointerdown on handle──▶  dragging
 *   idle  ──pointermove on handle──▶  hovering ──pointermove off──▶ idle
 *   dragging ──pointermove──▶  emit new world position
 *   dragging ──pointerup / cancel──▶  idle
 *
 * The drag plane is camera-aligned (plane normal = camera forward), passing
 * through the handle's world position at drag start. This is the standard
 * "free 3D translate" gizmo behaviour used by Blender, AutoCAD and Revit
 * when no constraint axis is selected — drag in any screen direction maps
 * to a world translation while preserving the original camera-relative
 * depth of the handle.
 *
 * Pure module: no React, no Zustand subscriptions. Caller (`use-waypoint-
 * drag-interaction`) wires DOM listeners + AnimationStore writes.
 */

import * as THREE from 'three';
import { applyAxisConstraint, type AxisLock } from './axis-constraint-projector';
import type { WaypointHandleRole } from './WaypointDragHandle';

export type DragFsmState = 'idle' | 'hovering' | 'dragging';

export interface DragPickResult {
  readonly role: WaypointHandleRole;
  readonly sprite: THREE.Object3D;
  readonly worldPos: THREE.Vector3;
}

export interface DragControllerEvents {
  /** Hover entered/left a handle. `role === null` clears hover. */
  readonly onHoverChange?: (role: WaypointHandleRole | null) => void;
  /** Drag started on a handle. */
  readonly onDragStart?: (role: WaypointHandleRole, worldPos: THREE.Vector3) => void;
  /** Drag move emits new handle world position. */
  readonly onDragMove?: (role: WaypointHandleRole, worldPos: THREE.Vector3) => void;
  /** Drag finished cleanly (pointerup). */
  readonly onDragEnd?: (role: WaypointHandleRole, worldPos: THREE.Vector3) => void;
  /** Drag cancelled (pointercancel, escape, tool deactivated). */
  readonly onDragCancel?: (role: WaypointHandleRole) => void;
}

export class WaypointDragController {
  private state: DragFsmState = 'idle';
  private dragRole: WaypointHandleRole | null = null;
  private readonly dragPlane = new THREE.Plane();
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private readonly tmpVec3 = new THREE.Vector3();
  private readonly startWorldPos = new THREE.Vector3();

  getState(): DragFsmState {
    return this.state;
  }

  /**
   * Test the cursor against the handles group. Returns the first sprite
   * carrying a `role` userData, or null when nothing was hit. Caller
   * passes the group only when handles are visible (renderer-side gate).
   */
  pick(
    handlesGroup: THREE.Group,
    camera: THREE.Camera,
    domElement: HTMLElement,
    clientX: number,
    clientY: number,
  ): DragPickResult | null {
    if (!setNdcFromClient(this.ndc, domElement, clientX, clientY)) return null;
    this.raycaster.setFromCamera(this.ndc, camera);
    const hits = this.raycaster.intersectObjects(handlesGroup.children, true);
    for (const hit of hits) {
      const role = readHandleRole(hit.object);
      if (role !== null) {
        const worldPos = new THREE.Vector3();
        hit.object.getWorldPosition(worldPos);
        return { role, sprite: hit.object, worldPos };
      }
    }
    return null;
  }

  /**
   * Update hover state (idle ↔ hovering). No-ops while dragging.
   */
  handleHover(role: WaypointHandleRole | null, events?: DragControllerEvents): void {
    if (this.state === 'dragging') return;
    if (role === null) {
      if (this.state === 'hovering') {
        this.state = 'idle';
        events?.onHoverChange?.(null);
      }
      return;
    }
    if (this.state === 'idle' || this.state === 'hovering') {
      this.state = 'hovering';
      events?.onHoverChange?.(role);
    }
  }

  /**
   * Start a drag at the provided handle world position. The drag plane is
   * computed once from camera forward + handle position and reused for
   * every subsequent pointermove in the same gesture.
   */
  startDrag(
    role: WaypointHandleRole,
    handleWorldPos: THREE.Vector3,
    camera: THREE.Camera,
    events?: DragControllerEvents,
  ): void {
    this.state = 'dragging';
    this.dragRole = role;
    this.startWorldPos.copy(handleWorldPos);
    computeCameraAlignedPlane(this.dragPlane, camera, handleWorldPos);
    events?.onDragStart?.(role, handleWorldPos.clone());
  }

  /**
   * Project the cursor onto the drag plane and emit the new world position.
   * Returns null when the plane is parallel to the view (no intersection)
   * — caller should preserve the previous position in that case.
   */
  updateDrag(
    camera: THREE.Camera,
    domElement: HTMLElement,
    clientX: number,
    clientY: number,
    events?: DragControllerEvents,
    axisLock?: AxisLock | null,
  ): THREE.Vector3 | null {
    if (this.state !== 'dragging' || this.dragRole === null) return null;
    if (!setNdcFromClient(this.ndc, domElement, clientX, clientY)) return null;
    this.raycaster.setFromCamera(this.ndc, camera);
    const hit = this.raycaster.ray.intersectPlane(this.dragPlane, this.tmpVec3);
    if (!hit) return null;
    let constrained: THREE.Vector3;
    if (axisLock) {
      const c = applyAxisConstraint(hit, this.startWorldPos, axisLock);
      constrained = new THREE.Vector3(c.x, c.y, c.z);
    } else {
      constrained = hit.clone();
    }
    events?.onDragMove?.(this.dragRole, constrained);
    return constrained;
  }

  /**
   * End drag cleanly. Returns the role that finished (caller usually
   * doesn't need it — emitted via events callbacks).
   */
  endDrag(events?: DragControllerEvents): WaypointHandleRole | null {
    if (this.state !== 'dragging' || this.dragRole === null) return null;
    const role = this.dragRole;
    const lastPos = this.tmpVec3.clone();
    this.state = 'idle';
    this.dragRole = null;
    events?.onDragEnd?.(role, lastPos);
    events?.onHoverChange?.(null);
    return role;
  }

  /**
   * Abort any in-flight drag without committing. Used on pointercancel,
   * tool deactivation, or component unmount.
   */
  cancelDrag(events?: DragControllerEvents): void {
    if (this.state !== 'dragging' || this.dragRole === null) return;
    const role = this.dragRole;
    this.state = 'idle';
    this.dragRole = null;
    events?.onDragCancel?.(role);
    events?.onHoverChange?.(null);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Set the camera-aligned drag plane. Normal = camera forward vector, point
 * on plane = handle world position at drag start. Plane is in world space.
 */
export function computeCameraAlignedPlane(
  out: THREE.Plane,
  camera: THREE.Camera,
  point: THREE.Vector3,
): THREE.Plane {
  const normal = new THREE.Vector3();
  camera.getWorldDirection(normal);
  out.setFromNormalAndCoplanarPoint(normal, point);
  return out;
}

/**
 * Convert client coordinates to NDC space using the renderer canvas rect.
 * Returns false when the canvas has zero dimensions (just mounted).
 */
export function setNdcFromClient(
  out: THREE.Vector2,
  domElement: HTMLElement,
  clientX: number,
  clientY: number,
): boolean {
  const rect = domElement.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  out.set(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  );
  return true;
}

/**
 * Walk up the parent chain reading `userData.role`. Returns the first
 * matching value or null. Mirror of BimEntityRaycaster's bimId walk.
 */
function readHandleRole(object: THREE.Object3D | null): WaypointHandleRole | null {
  let obj: THREE.Object3D | null = object;
  while (obj) {
    const role = obj.userData['role'] as WaypointHandleRole | undefined;
    const kind = obj.userData['kind'] as string | undefined;
    if (kind === 'waypoint-handle' && (role === 'position' || role === 'target')) {
      return role;
    }
    obj = obj.parent;
  }
  return null;
}
