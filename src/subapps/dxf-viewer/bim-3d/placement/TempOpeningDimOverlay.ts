'use client';

/**
 * TempOpeningDimOverlay — Revit-style temporary/listening dimensions for a hosted
 * opening as it is dragged (ADR-363 Φ1G.5 Slice 2f).
 *
 * Scene-side leaf object (the BeamFromWallGhost / ColumnPlacementGhost pattern): added
 * to the live scene in the constructor, follows the dragged opening via `update`,
 * hidden when the drag pauses/misses, removed on `dispose`. Pure Three.js — no React,
 * no store subscription (the `useBim3DOpeningMove` hook drives it).
 *
 * It draws ≤2 blue witness lines (left jamb → nearest reference on the wall-start
 * side, right jamb → nearest reference on the wall-end side) with a live value, by
 * reusing the manual-dimension SSoT `createDimension3DRenderer`. The dimensions are
 * a TRANSIENT read-model (never persisted, like the ghost) — they vanish on release.
 *
 * SSoT reuse:
 *  - distances + reference offsets: `resolveOpeningDimReferences` (pure mm maths)
 *  - wall-axis world points: `wallAxisPointAtOffsetMm` (same walk as the geometry)
 *  - render: `createDimension3DRenderer` (manual-dimension renderer, billboard text)
 */

import * as THREE from 'three';
import type { OpeningEntity, OpeningParams } from '../../bim/types/opening-types';
import type { WallEntity } from '../../bim/types/wall-types';
import { resolveOpeningDimReferences } from '../../bim/walls/opening-dim-references';
import { wallAxisPointAtOffsetMm } from '../../bim/geometry/opening-geometry';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { dxfPlanToWorld, getPixelWorldSize } from '../viewport/coordinate-transforms';
import { createDimension3DRenderer } from '../dimensions/Dimension3DRenderer';
import type { LayoutOptions } from '../dimensions/dim3d-line-geometry';
import { toVec3, type BimDimension3D, type Vec3 } from '../dimensions/dim3d-types';

const MM_TO_M = 0.001;
/** Distances below this (mm) are a flush jamb — skip that witness line. */
const MIN_DIM_DISTANCE_MM = 1;
/** On-screen height (px) of the dimension label, held CONSTANT across zoom (Revit). */
const TEMP_DIM_TEXT_PX = 48;
/** Label texture aspect (512×128 canvas → 4:1) — keeps the sprite undistorted. */
const TEMP_DIM_TEXT_ASPECT = 4;
/**
 * Place the witness line + label ON the wall axis (no side offset) so the dimension
 * is centred on the wall and the billboard label stays visible from either side.
 */
const AXIS_LAYOUT: Partial<LayoutOptions> = { dimLineOffset: 0, textOffset: 0 };

type Dim3DHandle = ReturnType<typeof createDimension3DRenderer>;

export class TempOpeningDimOverlay {
  private readonly scene: THREE.Scene;
  private readonly group: THREE.Group;
  private left: Dim3DHandle | null = null;
  private right: Dim3DHandle | null = null;
  private disposed = false;
  private readonly tmpWorld = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'temp-opening-dims';
    scene.add(this.group);
  }

  /**
   * Recompute + show the two witness lines for `resolvedParams` on `host` against
   * its `siblings`. Each side is hidden when its reference is flush with the jamb.
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
    if (this.disposed) return;
    const refs = resolveOpeningDimReferences(resolvedParams, host, siblings, candidateWalls);
    const units = host.params.sceneUnits ?? 'mm';
    const elevMm = floorElevationMm + resolvedParams.sillHeight + resolvedParams.height / 2;
    this.group.visible = true;

    const leftDim = refs.leftDistMm >= MIN_DIM_DISTANCE_MM
      ? this.buildDim('left', refs.prevRefOffsetMm, refs.startJambOffsetMm, refs.leftDistMm, host, units, elevMm, buildingBaseElevationM)
      : null;
    const rightDim = refs.rightDistMm >= MIN_DIM_DISTANCE_MM
      ? this.buildDim('right', refs.endJambOffsetMm, refs.nextRefOffsetMm, refs.rightDistMm, host, units, elevMm, buildingBaseElevationM)
      : null;

    this.left = this.syncSide(this.left, leftDim, camera, canvas);
    this.right = this.syncSide(this.right, rightDim, camera, canvas);
  }

  hide(): void {
    this.group.visible = false;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.disposeSide(this.left);
    this.disposeSide(this.right);
    this.left = null;
    this.right = null;
    this.scene.remove(this.group);
  }

  // ── internals ──────────────────────────────────────────────────────────────

  /** Create/update a side renderer from `dim`, or hide it when `dim` is null. */
  private syncSide(
    existing: Dim3DHandle | null,
    dim: BimDimension3D | null,
    camera: THREE.Camera,
    canvas: HTMLElement,
  ): Dim3DHandle | null {
    if (!dim) {
      if (existing) existing.root.visible = false;
      return existing;
    }
    let handle = existing;
    if (!handle) {
      handle = createDimension3DRenderer(dim, AXIS_LAYOUT);
      this.group.add(handle.root);
    } else {
      handle.update(dim);
      handle.root.visible = true;
    }
    this.scaleText(handle, camera, canvas);
    return handle;
  }

  /** Hold the label at a constant on-screen pixel height regardless of zoom (Revit). */
  private scaleText(handle: Dim3DHandle, camera: THREE.Camera, canvas: HTMLElement): void {
    const sprite = handle.textSprite;
    const dist = camera.position.distanceTo(sprite.getWorldPosition(this.tmpWorld));
    const worldH = getPixelWorldSize(dist, camera, canvas) * TEMP_DIM_TEXT_PX;
    if (worldH > 0) sprite.scale.set(worldH * TEMP_DIM_TEXT_ASPECT, worldH, 1);
  }

  private disposeSide(handle: Dim3DHandle | null): void {
    if (!handle) return;
    this.group.remove(handle.root);
    handle.dispose();
  }

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
    return {
      id: `temp-opening-dim-${side}`,
      projectId: '',
      companyId: '',
      mode: 'aligned',
      placement: { aligned: {} },
      anchor: { endpointA, endpointB },
      textOffset: { x: 0, y: 0 },
      textPlane: 'billboard',
      value: distMm * MM_TO_M, // metres; formatted as mm by unit below
      unit: 'mm',
      precision: 0,
      leaderStyle: { shape: 'straight', arrowSize: 0.04 },
      createdBy: '',
      createdAt: '',
      updatedAt: '',
    };
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
