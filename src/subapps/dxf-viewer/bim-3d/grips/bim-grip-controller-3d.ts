'use client';

/**
 * bim-grip-controller-3d.ts — 3D reshape-grip interaction FSM (hover → drag → idle),
 * ADR-535 Φ1.
 *
 * Mirror of `BimGizmoController`, but the projection is a single horizontal plane (the
 * slab top): a grip drag intersects the mouse ray with `y = planeWorldY` and measures a
 * plan-mm delta from the grip's start (1:1 cursor follow). Pure — no React, no store, no
 * command dispatch. The interaction handlers own the commit: they call `endDrag()` and
 * route the `{grip, deltaMm}` through the view-agnostic `commitGrip3DReshape` on release.
 *
 * ADR-535 Φ2 — the dragged vertex SNAPS to nearby scene features via an injected
 * `SnapFn` (built by the handler from the ONE snap-engine SSoT, mirror of the gizmo
 * drag bridge's `applySnap`): the live vertex world point is mapped to plan-mm, snapped,
 * mapped back at the same elevation, and the plan-mm delta re-derived from the corrected
 * point — so the live reshape preview === the committed result. `currentDrag()` exposes
 * the in-progress `{grip, deltaMm}` so the handler can rebuild the slab mesh per frame.
 */

import * as THREE from 'three';
import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo } from '../../hooks/grip-types';
import { setNdcFromClient } from '../animation/waypoint-drag-controller';
import { worldToDxfPlan, dxfPlanToWorld } from '../viewport/coordinate-transforms';
import type { SnapFn } from '../gizmo/bim3d-snap-bridge';
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
  /** Injected snap callback (ADR-535 Φ2). Null = free drag (OSNAP off / unsupported). */
  private snapFn: SnapFn | null = null;

  constructor(overlay: BimGripOverlay3D) {
    this.overlay = overlay;
  }

  isDragging(): boolean {
    return this.drag !== null;
  }

  /**
   * Inject the snap callback for the current drag (ADR-535 Φ2). The handler builds it
   * from the snap-engine SSoT; `null` disables snapping. Keeps this controller pure —
   * no engine import here (mirror of `BimGizmoDragBridge.setSnapFn`).
   */
  setSnapFn(fn: SnapFn | null): void {
    this.snapFn = fn;
  }

  /** The in-progress grip + its live plan-mm delta (for the live reshape preview), or null. */
  currentDrag(): { grip: GripInfo; deltaMm: Point2D } | null {
    return this.drag ? { grip: this.drag.grip, deltaMm: this.drag.deltaMm } : null;
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
    // ADR-535 Φ2 — the drag projects onto the horizontal plane through THIS grip's own
    // elevation (a tilted slab's vertices sit at different Y). The slope re-derives the
    // moved vertex's z on commit/preview, so a plan-only horizontal drag is correct.
    const planeWorldY = gripStartWorld.y;
    const anchorWorld =
      intersectRayHorizontalPlane(this.raycaster.ray.origin, this.raycaster.ray.direction, planeWorldY)
      ?? gripStartWorld.clone();
    this.drag = { gripIndex, grip, gripStartWorld, anchorWorld, planeWorldY, deltaMm: { x: 0, y: 0 } };
    return true;
  }

  /**
   * Update an in-progress grip drag — the square follows the cursor 1:1, snapping the
   * dragged vertex to nearby scene features (ADR-535 Φ2). The plan-mm delta is measured
   * from the grip's start to the (possibly snapped) vertex, so it feeds `applySlabGripDrag`
   * verbatim and the live reshape preview === the committed result.
   */
  updateDrag(camera: THREE.Camera, dom: HTMLElement, x: number, y: number): boolean {
    if (!this.drag) return false;
    if (!setNdcFromClient(this.ndc, dom, x, y)) return false;
    this.raycaster.setFromCamera(this.ndc, camera);
    const cur = intersectRayHorizontalPlane(
      this.raycaster.ray.origin, this.raycaster.ray.direction, this.drag.planeWorldY,
    );
    if (!cur) return false;
    const deltaWorld = cur.clone().sub(this.drag.anchorWorld);
    const vertexWorld = this.applySnap(this.drag.gripStartWorld.clone().add(deltaWorld));
    this.overlay.moveGrip(this.drag.gripIndex, vertexWorld);
    this.drag.deltaMm = planDeltaMm(this.drag.gripStartWorld, vertexWorld);
    return true;
  }

  /** Finish the drag → the grip + its plan-mm delta (caller commits), or null when idle. */
  endDrag(): { grip: GripInfo; deltaMm: Point2D } | null {
    if (!this.drag) return null;
    const out = { grip: this.drag.grip, deltaMm: this.drag.deltaMm };
    this.drag = null;
    this.snapFn = null;
    return out;
  }

  /** Abort the drag — no command (caller refreshes the grips back to canonical). */
  cancelDrag(): void {
    this.drag = null;
    this.snapFn = null;
  }

  // ── internals ──────────────────────────────────────────────────────────────

  /**
   * Snap a live vertex world point to the nearest scene feature via the injected
   * `snapFn` (ADR-535 Φ2, mirror of `BimGizmoDragBridge.applySnap`): map → plan-mm,
   * snap, map back at the SAME elevation (the footprint reshape never changes z), so
   * the corrected point stays on the grip plane. No-op when nothing is injected /
   * nothing snaps (OSNAP off / out of tolerance) → the free 1:1 follow stands.
   */
  private applySnap(vertexWorld: THREE.Vector3): THREE.Vector3 {
    if (!this.snapFn) return vertexWorld;
    const plan = worldToDxfPlan(vertexWorld);
    const res = this.snapFn({ x: plan.x, y: plan.y });
    if (!res) return vertexWorld;
    return dxfPlanToWorld(res.snappedMm.x, res.snappedMm.y, plan.z);
  }

  private cast(camera: THREE.Camera, dom: HTMLElement, x: number, y: number): number | null {
    if (!setNdcFromClient(this.ndc, dom, x, y)) return null;
    this.raycaster.setFromCamera(this.ndc, camera);
    return testGrip3DHit(this.raycaster, this.overlay.hitboxes, this.overlay.hitboxToIndex);
  }
}
