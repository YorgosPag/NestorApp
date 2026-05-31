'use client';

/**
 * bim-gizmo-drag-bridge.ts — pure math bridge: gizmo drag → DXF command inputs.
 *
 * ADR-402 (3D Viewport BIM Element Editing) — GenArc gizmo port (Phase A).
 *
 * Pure (no React, no Zustand, no scene mutation, no command dispatch). Translates
 * a constrained gizmo drag (using the ported `projectConstrained` math) into the
 * 2D `Point2D` (mm) delta / pivot+angle that the existing, view-agnostic commands
 * (`MoveEntityCommand`, `RotateEntityCommand`) already understand. The command
 * dispatch (levels / adapter / multi-floor) stays in the interaction handlers —
 * this object only computes WHAT to dispatch, on pointer-up (single-commit-on-release).
 *
 * Phase A constraints handled: move (axis X/Z, plane XZ, free) + rotate-Y. Other
 * handle kinds (resize, rotate X/Z, axis/plane involving world Y) are hidden by the
 * overlay so they never reach this bridge; `getOutcome()` returns `none` for them.
 */

import * as THREE from 'three';
import type { Point2D } from '../../rendering/types/Types';
import type { GizmoAxis, GizmoDragConstraint, GizmoResizeMode } from './gizmo-types';
import { projectConstrained } from './gizmo-projection';
import { worldDeltaToDxfDelta, worldUpDeltaToMm } from '../utils/bim3d-edit-math';
import { worldToDxfPlan, dxfPlanToWorld } from '../viewport/coordinate-transforms';
import type { SnapFn } from './bim3d-snap-bridge';

/** Command-ready result of a finished gizmo drag. */
export type BridgeOutcome =
  // ADR-402 — `deltaDxf` is the horizontal DXF-plan delta (X/Z arrows, plane, free);
  // `deltaUpMm` is the vertical (world-Y) delta in mm (axis-Y arrow → elevation move).
  // A horizontal drag carries `deltaUpMm: 0`; a pure vertical drag carries `deltaDxf` (0,0).
  | { readonly kind: 'move'; readonly deltaDxf: Point2D; readonly deltaUpMm: number }
  | { readonly kind: 'rotate'; readonly pivotDxf: Point2D; readonly angleDeg: number }
  // ADR-402 Phase B — resize: the type-specific param patch is computed downstream
  // (`bim3d-resize-bridge`) from the axis + the DXF-mm slide delta (horizontal) +
  // the vertical (world-Y) mm delta + the absolute cursor on the floor plane.
  | {
      readonly kind: 'resize';
      readonly axis: GizmoAxis;
      readonly mode: GizmoResizeMode;
      /** Horizontal DXF-plan slide delta (mm) — used for plan resize (X/Z). */
      readonly deltaMm: Point2D;
      /** Vertical (world-Y) slide delta (mm) — used for axis-Y resize (height/depth/thickness). */
      readonly deltaUpMm: number;
      readonly cursorMm: Point2D;
    }
  | { readonly kind: 'none' };

const DELTA_EPSILON = 1e-6;
const ROTATE_AXIS_Y = new THREE.Vector3(0, 1, 0);

export class BimGizmoDragBridge {
  private constraint: GizmoDragConstraint | null = null;
  private readonly anchorWorld = new THREE.Vector3();
  private readonly dragAnchor = new THREE.Vector3();
  /** Snap-corrected world translation (drives gizmo follow + outcome). */
  private readonly liveTranslation = new THREE.Vector3();
  /** Raw (un-snapped) translation — used only for change detection in `update()`. */
  private readonly rawTranslation = new THREE.Vector3();
  private readonly rotateStartVec = new THREE.Vector3();
  private rotationRad = 0;
  /** Injected snap callback (ADR-402 Phase B). Null = free drag (OSNAP off / unsupported). */
  private snapFn: SnapFn | null = null;
  /** World position of the active snap target this frame (for the 3D marker), or null. */
  private activeSnapWorld: THREE.Vector3 | null = null;

  isDragging(): boolean {
    return this.constraint !== null;
  }

  getActiveConstraint(): GizmoDragConstraint | null {
    return this.constraint;
  }

  /**
   * Inject the snap callback for the current drag (ADR-402 Phase B). The handler
   * builds it from the snap-engine SSoT; `null` disables snapping (OSNAP off /
   * rotate / vertical resize). Keeps this bridge pure — no engine import here.
   */
  setSnapFn(fn: SnapFn | null): void {
    this.snapFn = fn;
  }

  /** World position of the snap target hit this frame, or null when nothing snapped. */
  getActiveSnapWorld(): THREE.Vector3 | null {
    return this.activeSnapWorld ? this.activeSnapWorld.clone() : null;
  }

  /** World-space translation since drag start (live gizmo follow for move; zero for rotate). */
  getLiveTranslation(): THREE.Vector3 {
    return this.liveTranslation.clone();
  }

  /**
   * Signed rotation (radians, about world +Y) accumulated this drag — drives the
   * live entity rotate preview (ADR-402 live preview). 0 for a non-rotate drag.
   */
  getLiveRotationRad(): number {
    return this.rotationRad;
  }

  /**
   * Begin a constrained drag. `anchorWorld` is the gizmo origin (entity world
   * centre). Returns false for unsupported constraints (rotate ray parallel).
   */
  start(
    constraint: GizmoDragConstraint,
    anchorWorld: THREE.Vector3,
    rayOrigin: THREE.Vector3,
    rayDir: THREE.Vector3,
    cameraDir: THREE.Vector3,
  ): boolean {
    this.constraint = constraint;
    this.anchorWorld.copy(anchorWorld);
    this.liveTranslation.set(0, 0, 0);
    this.rawTranslation.set(0, 0, 0);
    this.activeSnapWorld = null;
    this.rotationRad = 0;

    if (constraint.kind === 'rotate') {
      const v0 = this.projectRotateVector(rayOrigin, rayDir);
      if (!v0) { this.constraint = null; return false; }
      this.rotateStartVec.copy(v0);
      return true;
    }
    this.dragAnchor.copy(projectConstrained(rayOrigin, rayDir, anchorWorld, constraint, cameraDir));
    return true;
  }

  /** Update with a new mouse ray. Returns true when the live delta/angle changed. */
  update(rayOrigin: THREE.Vector3, rayDir: THREE.Vector3, cameraDir: THREE.Vector3): boolean {
    if (!this.constraint) return false;
    if (this.constraint.kind === 'rotate') return this.updateRotate(rayOrigin, rayDir);

    const current = projectConstrained(rayOrigin, rayDir, this.anchorWorld, this.constraint, cameraDir);
    const next = current.sub(this.dragAnchor);
    // Change detection runs on the RAW translation: a snapped `liveTranslation`
    // can sit still across frames while the cursor keeps moving inside the snap
    // tolerance, so comparing the snapped value would freeze further updates.
    if (next.distanceToSquared(this.rawTranslation) <= DELTA_EPSILON) return false;
    this.rawTranslation.copy(next);
    this.liveTranslation.copy(next);
    this.applySnap();
    return true;
  }

  /**
   * Snap the primary control point (move: gizmo anchor; resize: dragged handle)
   * to the nearest scene feature via the injected `snapFn`, then re-derive
   * `liveTranslation` so the gizmo follow + the command outcome both honour it.
   * No-op for rotate and for vertical (axis-Y) resize, and whenever `snapFn`
   * returns null (OSNAP off / nothing in tolerance) → the free drag stands.
   */
  private applySnap(): void {
    this.activeSnapWorld = null;
    if (!this.snapFn || !this.constraint) return;
    if (this.constraint.kind === 'rotate') return;
    if (this.constraint.kind === 'resize' && this.constraint.axis === 'y') return;
    // ADR-402 — the axis-Y MOVE arrow is a vertical elevation drag; plan snapping
    // is meaningless (the plan position does not change), mirror the resize-Y guard.
    if (this.constraint.kind === 'axis' && this.constraint.axis === 'y') return;
    const endWorld = this.anchorWorld.clone().add(this.liveTranslation);
    const endPlan = worldToDxfPlan(endWorld);
    const res = this.snapFn({ x: endPlan.x, y: endPlan.y });
    if (!res) return;
    // Keep the element's elevation (endPlan.z): snapping only shifts the plan.
    const corrected = dxfPlanToWorld(res.snappedMm.x, res.snappedMm.y, endPlan.z);
    this.liveTranslation.copy(corrected).sub(this.anchorWorld);
    this.activeSnapWorld = dxfPlanToWorld(res.markerMm.x, res.markerMm.y, endPlan.z);
  }

  /** Command-ready outcome to dispatch on pointer-up. */
  getOutcome(): BridgeOutcome {
    if (!this.constraint) return { kind: 'none' };
    if (this.constraint.kind === 'rotate') {
      const angleDeg = THREE.MathUtils.radToDeg(this.rotationRad);
      if (Math.abs(angleDeg) < 1e-4) return { kind: 'none' };
      const p = worldToDxfPlan(this.anchorWorld);
      return { kind: 'rotate', pivotDxf: { x: p.x, y: p.y }, angleDeg };
    }
    const end = this.anchorWorld.clone().add(this.liveTranslation);
    // Resize handled FIRST: an axis-Y resize produces a purely vertical slide, so
    // its horizontal `deltaDxf` is (0,0). The move guard below would mis-classify
    // that as a no-op, so resize gets its own guard that also considers `deltaUpMm`.
    if (this.constraint.kind === 'resize') {
      const deltaMm = worldDeltaToDxfDelta(this.anchorWorld, end);
      const deltaUpMm = worldUpDeltaToMm(this.anchorWorld, end);
      if (deltaMm.x === 0 && deltaMm.y === 0 && deltaUpMm === 0) return { kind: 'none' };
      const c = worldToDxfPlan(end);
      return {
        kind: 'resize',
        axis: this.constraint.axis,
        mode: this.constraint.mode,
        deltaMm,
        deltaUpMm,
        cursorMm: { x: c.x, y: c.y },
      };
    }
    // ADR-402 — the axis-Y arrow yields a purely vertical slide (deltaDxf 0,0), so
    // the move guard must also consider `deltaUpMm` (mirror of the resize guard above).
    const deltaDxf = worldDeltaToDxfDelta(this.anchorWorld, end);
    const deltaUpMm = worldUpDeltaToMm(this.anchorWorld, end);
    if (deltaDxf.x === 0 && deltaDxf.y === 0 && deltaUpMm === 0) return { kind: 'none' };
    return { kind: 'move', deltaDxf, deltaUpMm };
  }

  end(): void {
    this.constraint = null;
    this.snapFn = null;
    this.activeSnapWorld = null;
  }

  cancel(): void {
    this.constraint = null;
    this.snapFn = null;
    this.activeSnapWorld = null;
    this.liveTranslation.set(0, 0, 0);
    this.rawTranslation.set(0, 0, 0);
    this.rotationRad = 0;
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private updateRotate(rayOrigin: THREE.Vector3, rayDir: THREE.Vector3): boolean {
    const cur = this.projectRotateVector(rayOrigin, rayDir);
    if (!cur) return false;
    const cross = this.rotateStartVec.clone().cross(cur);
    const dot = THREE.MathUtils.clamp(this.rotateStartVec.dot(cur), -1, 1);
    const signed = Math.atan2(ROTATE_AXIS_Y.dot(cross), dot);
    if (Math.abs(signed - this.rotationRad) <= DELTA_EPSILON) return false;
    this.rotationRad = signed;
    return true;
  }

  /** Project the mouse ray onto the rotation plane (normal +Y) through the anchor. */
  private projectRotateVector(rayOrigin: THREE.Vector3, rayDir: THREE.Vector3): THREE.Vector3 | null {
    const denom = ROTATE_AXIS_Y.dot(rayDir);
    const v = new THREE.Vector3();
    if (Math.abs(denom) > 1e-8) {
      const t = ROTATE_AXIS_Y.dot(this.anchorWorld.clone().sub(rayOrigin)) / denom;
      v.copy(rayOrigin).addScaledVector(rayDir, t).sub(this.anchorWorld);
    } else {
      const t = this.anchorWorld.clone().sub(rayOrigin).dot(rayDir);
      v.copy(rayOrigin).addScaledVector(rayDir, t).sub(this.anchorWorld);
    }
    v.y = 0; // project onto the horizontal rotation plane
    return v.lengthSq() < 1e-10 ? null : v.normalize();
  }
}
