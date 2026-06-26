'use client';

/**
 * bim-grip-controller-3d.ts — 3D reshape-grip interaction FSM (hover → drag → idle),
 * ADR-535 Φ1.
 *
 * Mirror of `BimGizmoController`, but the projection is a single horizontal plane (the
 * slab top): a grip drag intersects the mouse ray with `y = planeWorldY` and measures a
 * plan-mm delta from the grab point (1:1 cursor follow). Pure — no React, no store, no
 * command dispatch. The interaction handlers own the commit: they call `endDrag()` and
 * route the `{grip, deltaMm}` through the view-agnostic `commitGrip3DReshape` on release
 * (single-commit; live slab reshape is Φ2).
 */

import * as THREE from 'three';
import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo } from '../../hooks/grip-types';
import { setNdcFromClient } from '../animation/waypoint-drag-controller';
import { testGrip3DHit } from './grip-3d-hit-test';
import { intersectRayHorizontalPlane, planDeltaMm } from './grip-plane-projection';
import type { BimGripOverlay3D } from './bim-grip-overlay-3d';

interface ActiveGripDrag {
  readonly gripIndex: number;
  readonly grip: GripInfo;
  /** Grip world position at drag start (the square follows this + cursor delta). */
  readonly gripStartWorld: THREE.Vector3;
  /** Ray∩plane point at drag start (the 1:1 follow anchor). */
  readonly anchorWorld: THREE.Vector3;
  readonly planeWorldY: number;
  deltaMm: Point2D;
}

export class BimGripController3D {
  private readonly overlay: BimGripOverlay3D;
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private drag: ActiveGripDrag | null = null;

  constructor(overlay: BimGripOverlay3D) {
    this.overlay = overlay;
  }

  isDragging(): boolean {
    return this.drag !== null;
  }

  /** Hover highlight under the cursor. Returns true when the hovered grip changed. */
  updateHover(camera: THREE.Camera, dom: HTMLElement, x: number, y: number): boolean {
    if (!this.overlay.visible || this.drag) return false;
    return this.overlay.setHover(this.cast(camera, dom, x, y));
  }

  /**
   * Try to start a grip drag at the cursor. Returns true when a reshape grip was hit
   * (caller disables OrbitControls + captures the pointer + skips the gizmo path).
   */
  beginDrag(camera: THREE.Camera, dom: HTMLElement, x: number, y: number): boolean {
    if (!this.overlay.visible) return false;
    const gripIndex = this.cast(camera, dom, x, y);
    if (gripIndex === null) return false;
    const grip = this.overlay.gripByIndex(gripIndex);
    const gripStartWorld = this.overlay.getGripWorld(gripIndex);
    if (!grip || !gripStartWorld) return false;
    const planeWorldY = this.overlay.getPlaneWorldY();
    const anchorWorld =
      intersectRayHorizontalPlane(this.raycaster.ray.origin, this.raycaster.ray.direction, planeWorldY)
      ?? gripStartWorld.clone();
    this.drag = { gripIndex, grip, gripStartWorld, anchorWorld, planeWorldY, deltaMm: { x: 0, y: 0 } };
    return true;
  }

  /** Update an in-progress grip drag — the square follows the cursor 1:1. */
  updateDrag(camera: THREE.Camera, dom: HTMLElement, x: number, y: number): boolean {
    if (!this.drag) return false;
    if (!setNdcFromClient(this.ndc, dom, x, y)) return false;
    this.raycaster.setFromCamera(this.ndc, camera);
    const cur = intersectRayHorizontalPlane(
      this.raycaster.ray.origin, this.raycaster.ray.direction, this.drag.planeWorldY,
    );
    if (!cur) return false;
    const deltaWorld = cur.clone().sub(this.drag.anchorWorld);
    this.overlay.moveGrip(this.drag.gripIndex, this.drag.gripStartWorld.clone().add(deltaWorld));
    this.drag.deltaMm = planDeltaMm(this.drag.anchorWorld, cur);
    return true;
  }

  /** Finish the drag → the grip + its plan-mm delta (caller commits), or null when idle. */
  endDrag(): { grip: GripInfo; deltaMm: Point2D } | null {
    if (!this.drag) return null;
    const out = { grip: this.drag.grip, deltaMm: this.drag.deltaMm };
    this.drag = null;
    return out;
  }

  /** Abort the drag — no command (caller refreshes the grips back to canonical). */
  cancelDrag(): void {
    this.drag = null;
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private cast(camera: THREE.Camera, dom: HTMLElement, x: number, y: number): number | null {
    if (!setNdcFromClient(this.ndc, dom, x, y)) return null;
    this.raycaster.setFromCamera(this.ndc, camera);
    return testGrip3DHit(this.raycaster, this.overlay.hitboxes, this.overlay.hitboxToIndex);
  }
}
