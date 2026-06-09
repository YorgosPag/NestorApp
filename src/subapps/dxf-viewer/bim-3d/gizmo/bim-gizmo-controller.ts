'use client';

/**
 * bim-gizmo-controller.ts — gizmo interaction FSM (hover → drag → idle).
 *
 * ADR-402 (3D Viewport BIM Element Editing) — GenArc gizmo port (Phase A).
 *
 * Pure (no React, no Zustand, no command dispatch). Bridges pointer rays to the
 * overlay (hover highlight + live gizmo follow) and the pure `BimGizmoDragBridge`
 * (constrained projection → command-ready outcome). The interaction handlers own
 * the command dispatch: they call `endDrag()` and dispatch the returned outcome as
 * ONE `MoveEntityCommand` / `RotateEntityCommand` on pointer-up (single-commit).
 *
 * Mirror of GenArc's `gizmoController`, but driving OUR overlay + bridge.
 */

import * as THREE from 'three';
import { setNdcFromClient } from '../animation/waypoint-drag-controller';
import { parseHandleId, handleToConstraint, type GizmoDragConstraint } from './gizmo-types';
import type { GizmoAxis, GizmoEndpoint } from './gizmo-types';
import { testGizmoHit } from './gizmo-hit-test';
import { BimGizmoDragBridge, type BridgeOutcome } from './bim-gizmo-drag-bridge';
import type { SnapFn } from './bim3d-snap-bridge';
import type { BimGizmoOverlay } from './bim-gizmo-overlay';

type ResizeOutcome = Extract<BridgeOutcome, { kind: 'resize' }>;
type EndpointOutcome = Extract<BridgeOutcome, { kind: 'endpoint-move' }>;

/**
 * Live snapshot of the in-progress drag, for the entity follow preview (ADR-402).
 * Move/rotate map to a rigid mesh transform; resize carries the resize outcome so
 * the handler can rebuild the single entity's geometry via the converter SSoT.
 */
export type GizmoLivePreview =
  | { readonly kind: 'move'; readonly translation: THREE.Vector3 }
  | { readonly kind: 'rotate'; readonly pivot: THREE.Vector3; readonly angleRad: number }
  | { readonly kind: 'resize'; readonly outcome: ResizeOutcome }
  // ADR-404 Phase 2 — tilt (X/Z rings). Like resize, the handler rebuilds the single
  // entity's geometry via the converter SSoT (shear ≠ rigid rotate). `angleDeg` is snapped.
  | { readonly kind: 'tilt'; readonly axis: GizmoAxis; readonly angleDeg: number }
  // ADR-408 Φ-D — endpoint move: the handler rebuilds the dragged segment's geometry
  // via the converter SSoT (a node move ≠ rigid transform) + stretches its followers.
  | { readonly kind: 'endpoint-move'; readonly endpoint: GizmoEndpoint; readonly outcome: EndpointOutcome };

export class BimGizmoController {
  private readonly overlay: BimGizmoOverlay;
  private readonly bridge = new BimGizmoDragBridge();
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private readonly cameraDir = new THREE.Vector3();
  private readonly startAnchor = new THREE.Vector3();

  constructor(overlay: BimGizmoOverlay) {
    this.overlay = overlay;
  }

  isDragging(): boolean {
    return this.bridge.isDragging();
  }

  /** Inject the snap callback for the active drag (ADR-402 Phase B). */
  setSnapFn(fn: SnapFn | null): void {
    this.bridge.setSnapFn(fn);
  }

  /** Track Shift for the tilt angle snap (ADR-404 Phase 2 — Shift = free). */
  setShiftHeld(held: boolean): void {
    this.bridge.setShiftHeld(held);
  }

  /** The active drag constraint (null when idle) — lets the handler build the right snapFn. */
  getActiveConstraint(): GizmoDragConstraint | null {
    return this.bridge.getActiveConstraint();
  }

  /**
   * ADR-363 Φ1G.5 Slice 2i — world endpoints of the linear reference (wall face line)
   * the active snap landed on this frame, or null. Drives the dashed alignment line.
   */
  getActiveAlignmentWorld(): { a: THREE.Vector3; b: THREE.Vector3 } | null {
    return this.bridge.getActiveAlignmentWorld();
  }

  /**
   * ADR-363 Φ1G.5 Slice 2i — the active snap candidate's description/type (for the
   * snap-type label), or null. Paired with `getActiveSnapWorld()` for the label position.
   */
  getActiveSnapLabel(): { description?: string; type?: string } | null {
    return this.bridge.getActiveSnapLabel();
  }

  /** ADR-363 Φ1G.5 Slice 2i — world position of the active snap target (label anchor), or null. */
  getActiveSnapWorld(): THREE.Vector3 | null {
    return this.bridge.getActiveSnapWorld();
  }

  /** Hover highlight under the cursor. Returns true when the hovered handle changed. */
  updateHover(camera: THREE.Camera, dom: HTMLElement, x: number, y: number): boolean {
    if (!this.overlay.visible || this.bridge.isDragging()) return false;
    const hit = this.castGizmo(camera, dom, x, y);
    return this.overlay.setHoverHandle(hit ? hit.handleId : null);
  }

  /**
   * Try to start a drag at the cursor. Returns true when a gizmo handle was hit
   * (caller should disable OrbitControls + capture the pointer).
   */
  beginDrag(camera: THREE.Camera, dom: HTMLElement, x: number, y: number): boolean {
    if (!this.overlay.visible) return false;
    const hit = this.castGizmo(camera, dom, x, y);
    if (!hit) return false;
    let constraint = handleToConstraint(parseHandleId(hit.handleId));
    camera.getWorldDirection(this.cameraDir);
    // ADR-408 Φ1 — the handle id carries no projection mode; stamp the overlay's
    // per-selection endpoint mode (`'free-3d'` σωλήνας / `'horizontal'` τοίχος-δοκός)
    // onto the constraint so the bridge projects on the right plane.
    if (constraint.kind === 'endpoint') {
      constraint = { ...constraint, mode: this.overlay.getEndpointMode() };
    }
    // ADR-408 Φ-D — an endpoint drag anchors on the ENDPOINT world (not the gizmo
    // centre): the projection plane passes through the dragged end and the live
    // translation is measured from there, so the handle tracks the cursor 1:1.
    const endpointWorld = constraint.kind === 'endpoint' ? this.overlay.getEndpointWorld(constraint.endpoint) : null;
    this.startAnchor.copy(endpointWorld ?? this.overlay.getPosition());
    return this.bridge.start(
      constraint, this.startAnchor,
      this.raycaster.ray.origin, this.raycaster.ray.direction, this.cameraDir,
    );
  }

  /** Update an in-progress drag. Move constraints make the gizmo follow the cursor. */
  updateDrag(camera: THREE.Camera, dom: HTMLElement, x: number, y: number): boolean {
    if (!this.bridge.isDragging()) return false;
    if (!setNdcFromClient(this.ndc, dom, x, y)) return false;
    this.raycaster.setFromCamera(this.ndc, camera);
    camera.getWorldDirection(this.cameraDir);
    const changed = this.bridge.update(this.raycaster.ray.origin, this.raycaster.ray.direction, this.cameraDir);
    // Move constraints make the gizmo follow the cursor; rotate + resize + endpoint
    // keep the gizmo CENTRE anchored to the entity (ADR-402 Phase B resize stays put).
    const constraint = this.bridge.getActiveConstraint();
    const kind = constraint?.kind;
    if (changed && kind !== 'rotate' && kind !== 'resize' && kind !== 'endpoint') {
      this.overlay.updatePosition(this.startAnchor.clone().add(this.bridge.getLiveTranslation()));
    }
    // ADR-408 Φ-D — the dragged endpoint HANDLE follows the cursor (the centre stays).
    if (changed && constraint?.kind === 'endpoint') {
      this.overlay.setDraggedEndpoint(constraint.endpoint, this.startAnchor.clone().add(this.bridge.getLiveTranslation()));
    }
    // ADR-402 Phase B — surface the live snap target as a 3D marker (square frame).
    if (changed) {
      const snapWorld = this.bridge.getActiveSnapWorld();
      if (snapWorld) this.overlay.showSnapMarker(snapWorld, camera);
      else this.overlay.hideSnapMarker();
    }
    return changed;
  }

  /**
   * Live preview of the in-progress drag (ADR-402) — the entity follow. Move/rotate
   * yield a rigid transform; resize yields the live resize outcome (peek — does NOT
   * end the drag). Null when idle or for a not-yet-meaningful drag.
   */
  getLivePreview(): GizmoLivePreview | null {
    const constraint = this.bridge.getActiveConstraint();
    const kind = constraint?.kind;
    if (!kind) return null;
    if (kind === 'rotate') {
      // ADR-404 — the Y ring is a rigid plan rotation; X/Z rings are a tilt (shear),
      // rebuilt via the converter SSoT like resize (the entity is not rigidly rotated).
      if (constraint && constraint.kind === 'rotate' && constraint.axis !== 'y') {
        return { kind: 'tilt', axis: constraint.axis, angleDeg: this.bridge.getLiveTiltDeg() };
      }
      return { kind: 'rotate', pivot: this.startAnchor.clone(), angleRad: this.bridge.getLiveRotationRad() };
    }
    if (kind === 'resize') {
      const outcome = this.bridge.getOutcome();
      return outcome.kind === 'resize' ? { kind: 'resize', outcome } : null;
    }
    // ADR-408 Φ-D — endpoint move: rebuild the dragged segment via the converter SSoT.
    if (kind === 'endpoint') {
      const outcome = this.bridge.getOutcome();
      return outcome.kind === 'endpoint-move'
        ? { kind: 'endpoint-move', endpoint: outcome.endpoint, outcome }
        : null;
    }
    // axis / plane / free → a rigid translation in world space.
    return { kind: 'move', translation: this.bridge.getLiveTranslation() };
  }

  /** Finish the drag and return the command-ready outcome (caller dispatches it). */
  endDrag(): BridgeOutcome {
    const outcome = this.bridge.getOutcome();
    this.bridge.end();
    this.overlay.hideSnapMarker();
    return outcome;
  }

  /** Abort the drag — snap the gizmo back to its pre-drag anchor, no command. */
  cancelDrag(): void {
    this.bridge.cancel();
    this.overlay.updatePosition(this.startAnchor);
    this.overlay.hideSnapMarker();
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private castGizmo(camera: THREE.Camera, dom: HTMLElement, x: number, y: number) {
    if (!setNdcFromClient(this.ndc, dom, x, y)) return null;
    this.raycaster.setFromCamera(this.ndc, camera);
    return testGizmoHit(this.raycaster, this.overlay.hitTestView);
  }
}
