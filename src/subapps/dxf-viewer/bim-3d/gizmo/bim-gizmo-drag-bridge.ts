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
import { worldDeltaToDxfDelta } from '../utils/bim3d-edit-math';
import { worldToDxfPlan } from '../viewport/coordinate-transforms';

/** Command-ready result of a finished gizmo drag. */
export type BridgeOutcome =
  | { readonly kind: 'move'; readonly deltaDxf: Point2D }
  | { readonly kind: 'rotate'; readonly pivotDxf: Point2D; readonly angleDeg: number }
  // ADR-402 Phase B — resize: the type-specific param patch is computed downstream
  // (`bim3d-resize-bridge`) from the axis + the DXF-mm slide delta + absolute cursor.
  | {
      readonly kind: 'resize';
      readonly axis: GizmoAxis;
      readonly mode: GizmoResizeMode;
      readonly deltaMm: Point2D;
      readonly cursorMm: Point2D;
    }
  | { readonly kind: 'none' };

const DELTA_EPSILON = 1e-6;
const ROTATE_AXIS_Y = new THREE.Vector3(0, 1, 0);

export class BimGizmoDragBridge {
  private constraint: GizmoDragConstraint | null = null;
  private readonly anchorWorld = new THREE.Vector3();
  private readonly dragAnchor = new THREE.Vector3();
  private readonly liveTranslation = new THREE.Vector3();
  private readonly rotateStartVec = new THREE.Vector3();
  private rotationRad = 0;

  isDragging(): boolean {
    return this.constraint !== null;
  }

  getActiveConstraint(): GizmoDragConstraint | null {
    return this.constraint;
  }

  /** World-space translation since drag start (live gizmo follow for move; zero for rotate). */
  getLiveTranslation(): THREE.Vector3 {
    return this.liveTranslation.clone();
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
    if (next.distanceToSquared(this.liveTranslation) <= DELTA_EPSILON) return false;
    this.liveTranslation.copy(next);
    return true;
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
    const deltaDxf = worldDeltaToDxfDelta(this.anchorWorld, end);
    if (deltaDxf.x === 0 && deltaDxf.y === 0) return { kind: 'none' };
    if (this.constraint.kind === 'resize') {
      const c = worldToDxfPlan(end);
      return {
        kind: 'resize',
        axis: this.constraint.axis,
        mode: this.constraint.mode,
        deltaMm: deltaDxf,
        cursorMm: { x: c.x, y: c.y },
      };
    }
    return { kind: 'move', deltaDxf };
  }

  end(): void {
    this.constraint = null;
  }

  cancel(): void {
    this.constraint = null;
    this.liveTranslation.set(0, 0, 0);
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
