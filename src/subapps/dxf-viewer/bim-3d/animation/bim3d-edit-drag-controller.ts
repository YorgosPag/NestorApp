'use client';

/**
 * ADR-402 Phase 1 §Sub-Phase 2 — BIM 3D move-gizmo drag controller.
 *
 * Pure FSM + Three.js plane math (no React, no Zustand, no scene mutation).
 * The caller (`use-bim3d-edit-interaction`) wires DOM listeners, the gizmo
 * renderer and command dispatch.
 *
 *   idle ──pointerdown on disc──▶ dragging ──pointermove──▶ emit world point
 *   dragging ──pointerup / cancel──▶ idle
 *
 * Unlike the waypoint controller (camera-aligned plane = free 3D translate),
 * this drags on the element's HORIZONTAL floor plane (`computeFloorPlane`) so a
 * whole-element move keeps its elevation — Revit/ArchiCAD "move in plan" feel.
 * Vertical edits go through the height grip (Sub-Phase 4), never this plane.
 *
 * The controller emits the constrained world point under the cursor; the hook
 * derives the DXF delta via `worldDeltaToDxfDelta(getStart(), point)` and feeds
 * the existing view-agnostic `MoveEntityCommand`.
 */

import * as THREE from 'three';
import { setNdcFromClient } from './waypoint-drag-controller';
import { applyAxisConstraint } from './axis-constraint-projector';
import { computeFloorPlane } from '../utils/bim3d-edit-math';
import type { Bim3DAxisLock } from '../stores/Bim3DEditStore';

export type EditFsmState = 'idle' | 'dragging';

/** Hit kind from a gizmo pick. `move-plane` = the floor disc (free move); `axis-*` = a lock arrow. */
export type EditHandleKind = 'move-plane' | 'axis-x' | 'axis-z';

export interface EditPickResult {
  readonly kind: EditHandleKind;
}

const M_TO_MM = 1000;

export class Bim3DEditDragController {
  private state: EditFsmState = 'idle';
  private readonly dragPlane = new THREE.Plane();
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private readonly tmpVec3 = new THREE.Vector3();
  private readonly startWorld = new THREE.Vector3();

  getState(): EditFsmState {
    return this.state;
  }

  isDragging(): boolean {
    return this.state === 'dragging';
  }

  /** World point on the floor plane where the drag began (gizmo anchor reference). */
  getStart(): THREE.Vector3 {
    return this.startWorld.clone();
  }

  /**
   * Raycast the gizmo handles group and classify the first tagged hit. Returns
   * null when nothing recognised was hit so the caller can fall through to
   * camera navigation (orbit/pan).
   */
  pick(
    handlesGroup: THREE.Group,
    camera: THREE.Camera,
    domElement: HTMLElement,
    clientX: number,
    clientY: number,
  ): EditPickResult | null {
    if (!setNdcFromClient(this.ndc, domElement, clientX, clientY)) return null;
    this.raycaster.setFromCamera(this.ndc, camera);
    const hits = this.raycaster.intersectObjects(handlesGroup.children, true);
    for (const hit of hits) {
      const kind = readHandleKind(hit.object);
      if (kind !== null) return { kind };
    }
    return null;
  }

  /**
   * Begin a floor-plane drag. The plane is the horizontal work-plane through the
   * gizmo anchor (`anchorWorldY` metres), computed once and reused for the gesture.
   * Returns false when the start ray is parallel to the floor (no intersection).
   */
  startDrag(
    anchorWorldY: number,
    camera: THREE.Camera,
    domElement: HTMLElement,
    clientX: number,
    clientY: number,
  ): boolean {
    // Floor plane = horizontal work-plane through the gizmo anchor (SSoT: bim3d-edit-math).
    this.dragPlane.copy(computeFloorPlane(anchorWorldY * M_TO_MM));
    if (!setNdcFromClient(this.ndc, domElement, clientX, clientY)) return false;
    this.raycaster.setFromCamera(this.ndc, camera);
    const hit = this.raycaster.ray.intersectPlane(this.dragPlane, this.tmpVec3);
    if (!hit) return false;
    this.startWorld.copy(hit);
    this.state = 'dragging';
    return true;
  }

  /**
   * Project the cursor onto the drag plane and return the constrained world
   * point. `axisLock` masks movement to a single world axis (X or Z) relative to
   * the drag start. Returns null when the ray is parallel to the plane.
   */
  updateDrag(
    camera: THREE.Camera,
    domElement: HTMLElement,
    clientX: number,
    clientY: number,
    axisLock: Bim3DAxisLock,
  ): THREE.Vector3 | null {
    if (this.state !== 'dragging') return null;
    if (!setNdcFromClient(this.ndc, domElement, clientX, clientY)) return null;
    this.raycaster.setFromCamera(this.ndc, camera);
    const hit = this.raycaster.ray.intersectPlane(this.dragPlane, this.tmpVec3);
    if (!hit) return null;
    if (axisLock) {
      const c = applyAxisConstraint(hit, this.startWorld, axisLock);
      return new THREE.Vector3(c.x, c.y, c.z);
    }
    return hit.clone();
  }

  endDrag(): void {
    this.state = 'idle';
  }

  cancelDrag(): void {
    this.state = 'idle';
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Walk up the parent chain reading the gizmo's `userData.kind`. Mirror of the
 * waypoint controller's role walk + BimEntityRaycaster's bimId walk.
 */
function readHandleKind(object: THREE.Object3D | null): EditHandleKind | null {
  let obj: THREE.Object3D | null = object;
  while (obj) {
    const kind = obj.userData['kind'] as string | undefined;
    if (kind === 'bim-edit-move-plane') return 'move-plane';
    if (kind === 'bim-edit-axis') {
      const axis = obj.userData['axis'] as string | undefined;
      if (axis === 'X') return 'axis-x';
      if (axis === 'Z') return 'axis-z';
    }
    obj = obj.parent;
  }
  return null;
}
