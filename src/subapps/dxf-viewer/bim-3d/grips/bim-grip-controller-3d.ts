'use client';

/**
 * bim-grip-controller-3d.ts — 3D reshape-grip interaction FSM (hover → drag → idle),
 * ADR-535 Φ1 grips · Φ2 live preview / snap · Φ5 screen-space pick.
 *
 * Φ5 — the grips are a Canvas2D overlay (no scene meshes), so picking is SCREEN-SPACE
 * (mirror the 2D `GripInteractionDetector`): each grip is projected to canvas-local px
 * through the SAME projector the overlay draws with (`makeGripPlanToCanvas`) and the
 * nearest one inside the pixel pick radius wins. The DRAG projection stays 3D: the mouse
 * ray intersects the horizontal plane through the dragged grip's own elevation (a tilted
 * slab's vertices sit at different Y), giving a plan-mm delta fed verbatim to the SAME
 * view-agnostic `applySlabGripDrag` / `UpdateSlabParamsCommand` the 2D grips use.
 *
 * The grip set + per-vertex elevation come from `Grip3DOverlayStore` (the overlay's SSoT);
 * the live hover index + dragged plan position are written to the non-reactive
 * `grip3DOverlayInteraction` so the overlay RAF paints them with zero re-render. Pure of
 * React — no JSX, no hooks, no command dispatch (the handlers own the commit on release).
 *
 * ADR-535 Φ2 — the dragged vertex SNAPS to nearby scene features via an injected `SnapFn`
 * (built by the handler from the ONE snap-engine SSoT, mirror of the gizmo drag bridge's
 * `applySnap`): the live vertex world point is mapped to plan-mm, snapped, mapped back at
 * the same elevation, and the plan-mm delta re-derived — so the live reshape preview ===
 * the committed result.
 */

import * as THREE from 'three';
import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo } from '../../hooks/grip-types';
import { setNdcFromClient } from '../animation/waypoint-drag-controller';
import { worldToDxfPlan, dxfPlanToWorld } from '../viewport/coordinate-transforms';
import type { SnapFn } from '../gizmo/bim3d-snap-bridge';
import { intersectRayHorizontalPlane, planDeltaMm } from './grip-plane-projection';
import { makeGripPlanToCanvas } from './grip-3d-screen-project';
import { findGripAtScreen } from './grip-3d-screen-hit-test';
import { isGripOccluded } from './grip-3d-occlusion';
import { useGrip3DOverlayStore, grip3DOverlayInteraction } from '../stores/Grip3DOverlayStore';

/** Screen-space pick radius (px) — generous, like the 2D grip pickbox. */
const GRIP_HIT_RADIUS_PX = 10;

interface ActiveGripDrag {
  /** Array index into the live grip set (the overlay paints this square live). */
  readonly index: number;
  readonly grip: GripInfo;
  /** Grip world position at drag start (the square follows this + cursor delta). */
  readonly gripStartWorld: THREE.Vector3;
  /** Ray∩plane point at drag start (the 1:1 follow anchor). */
  readonly anchorWorld: THREE.Vector3;
  readonly planeWorldY: number;
  deltaMm: Point2D;
}

export class BimGripController3D {
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private drag: ActiveGripDrag | null = null;
  /** Injected snap callback (ADR-535 Φ2). Null = free drag (OSNAP off / unsupported). */
  private snapFn: SnapFn | null = null;
  /** Scene geometry for the depth-occlusion test (ADR-535 Φ5). Null = no occlusion. */
  private occluders: THREE.Object3D | null = null;

  isDragging(): boolean {
    return this.drag !== null;
  }

  /**
   * Set the scene geometry used to occlude grips (ADR-535 Φ5) — the BIM entity group. A
   * grip hidden behind geometry becomes neither pickable (here) nor drawn (overlay).
   */
  setOccluders(occluders: THREE.Object3D | null): void {
    this.occluders = occluders;
  }

  /**
   * Inject the snap callback for the current drag (ADR-535 Φ2). The handler builds it
   * from the snap-engine SSoT; `null` disables snapping. Keeps this controller pure.
   */
  setSnapFn(fn: SnapFn | null): void {
    this.snapFn = fn;
  }

  /** The in-progress grip + its live plan-mm delta (for the live reshape preview), or null. */
  currentDrag(): { grip: GripInfo; deltaMm: Point2D } | null {
    return this.drag ? { grip: this.drag.grip, deltaMm: this.drag.deltaMm } : null;
  }

  /**
   * ADR-535 Φ4 — the reshape grip under the cursor (right-click vertex menu), WITHOUT
   * starting a drag. Returns its `GripInfo` (carries the `*GripKind` discriminator + the
   * `vertex` / `midpoint` type that decides delete-corner vs insert-corner), or null when
   * the cursor is off every grip. Reuses the SAME screen-space hit-test the hover / drag
   * path uses — one pick SSoT.
   */
  gripAt(camera: THREE.Camera, dom: HTMLElement, x: number, y: number): GripInfo | null {
    const index = this.hitTest(camera, dom, x, y);
    return index === null ? null : (this.grips()[index] ?? null);
  }

  /** Hover highlight under the cursor. Returns true when the hovered grip changed. */
  updateHover(camera: THREE.Camera, dom: HTMLElement, x: number, y: number): boolean {
    if (this.drag) return false;
    const index = this.hitTest(camera, dom, x, y);
    if (grip3DOverlayInteraction.hoverIndex === index) return false;
    grip3DOverlayInteraction.hoverIndex = index;
    return true;
  }

  /**
   * Try to start a grip drag at the cursor. Returns true when a reshape grip was hit
   * (caller disables OrbitControls + captures the pointer + skips the gizmo path).
   */
  beginDrag(camera: THREE.Camera, dom: HTMLElement, x: number, y: number): boolean {
    const index = this.hitTest(camera, dom, x, y);
    if (index === null) return false;
    const grip = this.grips()[index];
    if (!grip) return false;
    if (!setNdcFromClient(this.ndc, dom, x, y)) return false;
    this.raycaster.setFromCamera(this.ndc, camera);
    // ADR-535 Φ2 — the drag projects onto the horizontal plane through THIS grip's own
    // elevation (a tilted slab's vertices sit at different Y). The slope re-derives the
    // moved vertex's z on commit/preview, so a plan-only horizontal drag is correct.
    const elevMm = useGrip3DOverlayStore.getState().elevFor(grip.position);
    const gripStartWorld = dxfPlanToWorld(grip.position.x, grip.position.y, elevMm);
    const planeWorldY = gripStartWorld.y;
    const anchorWorld =
      intersectRayHorizontalPlane(this.raycaster.ray.origin, this.raycaster.ray.direction, planeWorldY)
      ?? gripStartWorld.clone();
    this.drag = { index, grip, gripStartWorld, anchorWorld, planeWorldY, deltaMm: { x: 0, y: 0 } };
    grip3DOverlayInteraction.hoverIndex = null;
    grip3DOverlayInteraction.drag = { index, livePlanPos: { x: grip.position.x, y: grip.position.y } };
    return true;
  }

  /**
   * Update an in-progress grip drag — the square follows the cursor 1:1, snapping the
   * dragged vertex to nearby scene features (ADR-535 Φ2). The plan-mm delta is measured
   * from the grip's start to the (possibly snapped) vertex, so it feeds `applySlabGripDrag`
   * verbatim and the live reshape preview === the committed result. Writes the snapped
   * plan position to `grip3DOverlayInteraction` so the overlay paints the square live.
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
    this.drag.deltaMm = planDeltaMm(this.drag.gripStartWorld, vertexWorld);
    if (grip3DOverlayInteraction.drag) {
      const plan = worldToDxfPlan(vertexWorld);
      grip3DOverlayInteraction.drag.livePlanPos = { x: plan.x, y: plan.y };
    }
    return true;
  }

  /** Finish the drag → the grip + its plan-mm delta (caller commits), or null when idle. */
  endDrag(): { grip: GripInfo; deltaMm: Point2D } | null {
    if (!this.drag) return null;
    const out = { grip: this.drag.grip, deltaMm: this.drag.deltaMm };
    this.drag = null;
    this.snapFn = null;
    grip3DOverlayInteraction.drag = null;
    return out;
  }

  /** Abort the drag — no command (caller refreshes the grips back to canonical). */
  cancelDrag(): void {
    this.drag = null;
    this.snapFn = null;
    grip3DOverlayInteraction.drag = null;
  }

  // ── internals ──────────────────────────────────────────────────────────────

  /** The live grip set (the overlay's SSoT). */
  private grips(): readonly GripInfo[] {
    return useGrip3DOverlayStore.getState().grips;
  }

  /**
   * Screen-space nearest-grip pick (ADR-535 Φ5). Projects every grip to canvas-local px
   * with the SAME projector the overlay draws with, then finds the nearest within the
   * pixel radius. `x`/`y` are CLIENT px → rebased to canvas-local via the dom rect.
   */
  private hitTest(camera: THREE.Camera, dom: HTMLElement, x: number, y: number): number | null {
    const st = useGrip3DOverlayStore.getState();
    if (st.grips.length === 0) return null;
    const rect = dom.getBoundingClientRect();
    const project = makeGripPlanToCanvas(camera, dom, st.elevFor);
    // ADR-535 Φ5 — a grip hidden behind geometry must not be pickable either (mirror the
    // overlay's draw cull), so an occluded grip is skipped by the nearest-wins search.
    const accept = this.occluders
      ? (i: number): boolean => {
          const p = st.grips[i].position;
          const world = dxfPlanToWorld(p.x, p.y, st.elevFor(p));
          return !isGripOccluded(world, camera, this.occluders, st.selfIds);
        }
      : undefined;
    return findGripAtScreen(st.grips, project, x - rect.left, y - rect.top, GRIP_HIT_RADIUS_PX, accept);
  }

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
}
