'use client';

/**
 * TempOpeningDimOverlay — Revit-style temporary/listening dimensions for a hosted
 * opening as it is dragged (ADR-363 Φ1G.5 Slice 2f).
 *
 * Thin subclass of `TempDim3DOverlayBase` (ADR-618): the scene group lifecycle, the
 * two-side sync, the screen-constant label scaling, and the transient dimension
 * envelope live in the base. This cell supplies ONLY the opening domain — it draws ≤2
 * blue witness lines (left jamb → nearest reference on the wall-start side, right jamb
 * → nearest reference on the wall-end side) with a live value.
 *
 * SSoT reuse:
 *  - distances + reference offsets: `resolveOpeningDimReferences` (pure mm maths)
 *  - wall-axis world points: `wallAxisPointAtOffsetMm` (same walk as the geometry)
 *  - render + label scaling + envelope: `TempDim3DOverlayBase` / `createDimension3DRenderer`
 */

import type * as THREE from 'three';
import type { OpeningEntity, OpeningParams } from '../../bim/types/opening-types';
import type { WallEntity } from '../../bim/types/wall-types';
import { resolveOpeningDimReferences } from '../../bim/walls/opening-dim-references';
import { wallAxisPointAtOffsetMm } from '../../bim/geometry/opening-geometry';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { dxfPlanToWorld } from '../viewport/coordinate-transforms';
import { toVec3, type BimDimension3D, type Vec3 } from '../dimensions/dim3d-types';
import { TempDim3DOverlayBase } from './temp-dim-3d-overlay-base';

/** Distances below this (mm) are a flush jamb — skip that witness line. */
const MIN_DIM_DISTANCE_MM = 1;

export class TempOpeningDimOverlay extends TempDim3DOverlayBase {
  constructor(scene: THREE.Scene) {
    super(scene, 'temp-opening-dims');
  }

  /**
   * Recompute + show the two witness lines for `resolvedParams` on `host` against its
   * `siblings`. Each side is hidden when its reference is flush with the jamb.
   */
  update(
    resolvedParams: OpeningParams,
    host: WallEntity,
    siblings: readonly OpeningEntity[],
    floorElevationMm: number,
    buildingBaseElevationM: number,
    camera: THREE.Camera,
    canvas: HTMLElement,
    candidateWalls: readonly WallEntity[] = [],
  ): void {
    if (this.isDisposed) return;
    const refs = resolveOpeningDimReferences(resolvedParams, host, siblings, candidateWalls);
    const units = host.params.sceneUnits ?? 'mm';
    const elevMm = floorElevationMm + resolvedParams.sillHeight + resolvedParams.height / 2;

    const leftDim = refs.leftDistMm >= MIN_DIM_DISTANCE_MM
      ? this.buildDim('left', refs.prevRefOffsetMm, refs.startJambOffsetMm, refs.leftDistMm, host, units, elevMm, buildingBaseElevationM)
      : null;
    const rightDim = refs.rightDistMm >= MIN_DIM_DISTANCE_MM
      ? this.buildDim('right', refs.endJambOffsetMm, refs.nextRefOffsetMm, refs.rightDistMm, host, units, elevMm, buildingBaseElevationM)
      : null;

    this.setSides(leftDim, rightDim, camera, canvas);
  }

  // ── internals ──────────────────────────────────────────────────────────────

  /** Build the transient aligned dimension between two wall-axis offsets (mm). */
  private buildDim(
    side: 'left' | 'right',
    aOffsetMm: number,
    bOffsetMm: number,
    distMm: number,
    host: WallEntity,
    units: SceneUnits,
    elevMm: number,
    buildingBaseElevationM: number,
  ): BimDimension3D {
    const endpointA = this.axisWorld(host, aOffsetMm, units, elevMm, buildingBaseElevationM);
    const endpointB = this.axisWorld(host, bOffsetMm, units, elevMm, buildingBaseElevationM);
    return this.buildBaseDim(`temp-opening-dim-${side}`, endpointA, endpointB, distMm);
  }

  /** Wall-axis point at `offsetMm` → THREE world Vec3 at `elevMm` (+ building base). */
  private axisWorld(
    host: WallEntity,
    offsetMm: number,
    units: SceneUnits,
    elevMm: number,
    buildingBaseElevationM: number,
  ): Vec3 {
    const mmFactor = mmToSceneUnits(units) || 1;
    const plan = wallAxisPointAtOffsetMm(host, offsetMm);
    const world = dxfPlanToWorld(plan.x / mmFactor, plan.y / mmFactor, elevMm);
    world.y += buildingBaseElevationM;
    return toVec3(world);
  }
}
