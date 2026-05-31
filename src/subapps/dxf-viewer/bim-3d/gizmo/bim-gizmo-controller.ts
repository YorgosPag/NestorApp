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
import { testGizmoHit } from './gizmo-hit-test';
import { BimGizmoDragBridge, type BridgeOutcome } from './bim-gizmo-drag-bridge';
import type { SnapFn } from './bim3d-snap-bridge';
import type { BimGizmoOverlay } from './bim-gizmo-overlay';

type ResizeOutcome = Extract<BridgeOutcome, { kind: 'resize' }>;

/**
 * Live snapshot of the in-progress drag, for the entity follow preview (ADR-402).
 * Move/rotate map to a rigid mesh transform; resize carries the resize outcome so
 * the handler can rebuild the single entity's geometry via the converter SSoT.
 */
export type GizmoLivePreview =
  | { readonly kind: 'move'; readonly translation: THREE.Vector3 }
  | { readonly kind: 'rotate'; readonly pivot: THREE.Vector3; readonly angleRad: number }
  | { readonly kind: 'resize'; readonly outcome: ResizeOutcome };

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

  /** The active drag constraint (null when idle) — lets the handler build the right snapFn. */
  getActiveConstraint(): GizmoDragConstraint | null {
    return this.bridge.getActiveConstraint();
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
    const constraint = handleToConstraint(parseHandleId(hit.handleId));
    camera.getWorldDirection(this.cameraDir);
    this.startAnchor.copy(this.overlay.getPosition());
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
    // Move constraints make the gizmo follow the cursor; rotate + resize keep the
    // origin anchored to the entity centre (ADR-402 Phase B resize stays put).
    const kind = this.bridge.getActiveConstraint()?.kind;
    if (changed && kind !== 'rotate' && kind !== 'resize') {
      this.overlay.updatePosition(this.startAnchor.clone().add(this.bridge.getLiveTranslation()));
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
    const kind = this.bridge.getActiveConstraint()?.kind;
    if (!kind) return null;
    if (kind === 'rotate') {
      return { kind: 'rotate', pivot: this.startAnchor.clone(), angleRad: this.bridge.getLiveRotationRad() };
    }
    if (kind === 'resize') {
      const outcome = this.bridge.getOutcome();
      return outcome.kind === 'resize' ? { kind: 'resize', outcome } : null;
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
