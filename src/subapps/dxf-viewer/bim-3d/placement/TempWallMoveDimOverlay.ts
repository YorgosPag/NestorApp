'use client';

/**
 * TempWallMoveDimOverlay — Revit-style temporary/listening dimensions for a wall as it
 * is dragged laterally with the 3D gizmo (ADR-363 Φ1G.5 Slice 2h).
 *
 * Thin subclass of `TempDim3DOverlayBase` (ADR-618): the scene group lifecycle, the
 * two-side sync, the screen-constant label scaling, and the transient dimension
 * envelope live in the base. This cell supplies ONLY the wall-move domain — it draws ≤2
 * blue witness lines (one per perpendicular side of the wall) to the nearest PARALLEL
 * reference wall, with a live value.
 *
 * SSoT reuse:
 *  - references + perpendicular distances: `resolveWallMoveDimReferences` (pure scene-unit maths)
 *  - render + label scaling + envelope: `TempDim3DOverlayBase` / `createDimension3DRenderer`
 *  - plan→world: `dxfPlanToWorld`
 */

import type * as THREE from 'three';
import type { WallEntity } from '../../bim/types/wall-types';
import {
  resolveWallMoveDimReferences,
  type WallMoveDimReference,
} from '../../bim/walls/wall-move-dim-references';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';
import { dxfPlanToWorld } from '../viewport/coordinate-transforms';
import { toVec3, type BimDimension3D, type Vec3 } from '../dimensions/dim3d-types';
import { TempDim3DOverlayBase } from './temp-dim-3d-overlay-base';

/** World-space plan translation of the dragged wall (3D gizmo move; `y` = elevation, ignored). */
export interface WallMoveTranslation {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export class TempWallMoveDimOverlay extends TempDim3DOverlayBase {
  constructor(scene: THREE.Scene) {
    super(scene, 'temp-wall-move-dims');
  }

  /**
   * Recompute + show the perpendicular witness lines for `wall` at its live (translated)
   * position against `candidateWalls`. `worldY` is the elevation of the dimensions (the
   * gizmo anchor height — the wall mid-height); `translation` is the gizmo's world move.
   */
  update(
    wall: WallEntity,
    candidateWalls: readonly WallEntity[],
    translation: WallMoveTranslation,
    worldY: number,
    camera: THREE.Camera,
    canvas: HTMLElement,
  ): void {
    if (this.isDisposed) return;
    const units = wall.params.sceneUnits ?? 'mm';
    const k = (mmToSceneUnits(units) || 1) * 1000; // world metres → scene-unit plan delta
    const dScene = { x: translation.x * k, y: -translation.z * k };
    const moving = {
      id: wall.id,
      start: translatePoint(wall.params.start, dScene),
      end: translatePoint(wall.params.end, dScene),
      thicknessMm: wall.params.thickness,
      sceneUnits: units,
    };
    const { references } = resolveWallMoveDimReferences(moving, candidateWalls);

    const posRef = references.find((r) => r.side === 'positive') ?? null;
    const negRef = references.find((r) => r.side === 'negative') ?? null;
    this.setSides(
      posRef ? this.buildDim('pos', posRef, units, worldY) : null,
      negRef ? this.buildDim('neg', negRef, units, worldY) : null,
      camera,
      canvas,
    );
  }

  // ── internals ──────────────────────────────────────────────────────────────

  /** Build the transient aligned dimension between the moving wall axis and a reference. */
  private buildDim(side: 'pos' | 'neg', ref: WallMoveDimReference, units: SceneUnits, worldY: number): BimDimension3D {
    const mmFactor = mmToSceneUnits(units) || 1;
    const endpointA = this.planWorld(ref.fromPlan, mmFactor, worldY);
    const endpointB = this.planWorld(ref.toPlan, mmFactor, worldY);
    return this.buildBaseDim(`temp-wall-move-dim-${side}`, endpointA, endpointB, ref.distanceMm);
  }

  /** Scene-unit plan point → THREE world Vec3 at `worldY` (the gizmo-anchor elevation). */
  private planWorld(plan: { x: number; y: number }, mmFactor: number, worldY: number): Vec3 {
    const world = dxfPlanToWorld(plan.x / mmFactor, plan.y / mmFactor, 0);
    world.y = worldY;
    return toVec3(world);
  }
}
