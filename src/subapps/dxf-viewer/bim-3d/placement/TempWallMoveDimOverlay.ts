'use client';

/**
 * TempWallMoveDimOverlay — Revit-style temporary/listening dimensions for a wall as it
 * is dragged laterally with the 3D gizmo (ADR-363 Φ1G.5 Slice 2h).
 *
 * Sibling of `TempOpeningDimOverlay` (the opening counterpart): a scene-side leaf object
 * added to the live scene in the constructor, driven each move frame by the gizmo's
 * live-preview apply layer, hidden on commit/cancel, removed on `dispose`. Pure
 * Three.js — no React, no store subscription.
 *
 * It draws ≤2 blue witness lines (one per perpendicular side of the wall) to the nearest
 * PARALLEL reference wall, with a live value, reusing the manual-dimension SSoT
 * `createDimension3DRenderer`. The dimensions are a TRANSIENT read-model (never
 * persisted) — they vanish on release.
 *
 * SSoT reuse:
 *  - references + perpendicular distances: `resolveWallMoveDimReferences` (pure scene-unit maths)
 *  - render + screen-constant label: `createDimension3DRenderer` (manual-dimension renderer)
 *  - plan→world: `dxfPlanToWorld` / `getPixelWorldSize`
 */

import * as THREE from 'three';
import type { WallEntity } from '../../bim/types/wall-types';
import {
  resolveWallMoveDimReferences,
  type WallMoveDimReference,
} from '../../bim/walls/wall-move-dim-references';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';
import { dxfPlanToWorld, getPixelWorldSize } from '../viewport/coordinate-transforms';
import { createDimension3DRenderer } from '../dimensions/Dimension3DRenderer';
import type { LayoutOptions } from '../dimensions/dim3d-line-geometry';
import { toVec3, type BimDimension3D, type Vec3 } from '../dimensions/dim3d-types';

const MM_TO_M = 0.001;
/** On-screen height (px) of the dimension label, held CONSTANT across zoom (Revit). */
const TEMP_DIM_TEXT_PX = 48;
/** Label texture aspect (512×128 canvas → 4:1) — keeps the sprite undistorted. */
const TEMP_DIM_TEXT_ASPECT = 4;
/** Place the witness line + label ON the perpendicular (no side offset) so it is centred. */
const AXIS_LAYOUT: Partial<LayoutOptions> = { dimLineOffset: 0, textOffset: 0 };

/** World-space plan translation of the dragged wall (3D gizmo move; `y` = elevation, ignored). */
export interface WallMoveTranslation {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

type Dim3DHandle = ReturnType<typeof createDimension3DRenderer>;

export class TempWallMoveDimOverlay {
  private readonly scene: THREE.Scene;
  private readonly group: THREE.Group;
  private pos: Dim3DHandle | null = null;
  private neg: Dim3DHandle | null = null;
  private disposed = false;
  private readonly tmpWorld = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'temp-wall-move-dims';
    scene.add(this.group);
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
    if (this.disposed) return;
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
    this.group.visible = true;

    const posRef = references.find((r) => r.side === 'positive') ?? null;
    const negRef = references.find((r) => r.side === 'negative') ?? null;
    this.pos = this.syncSide(this.pos, posRef ? this.buildDim('pos', posRef, units, worldY) : null, camera, canvas);
    this.neg = this.syncSide(this.neg, negRef ? this.buildDim('neg', negRef, units, worldY) : null, camera, canvas);
  }

  hide(): void {
    this.group.visible = false;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.disposeSide(this.pos);
    this.disposeSide(this.neg);
    this.pos = null;
    this.neg = null;
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

  /** Build the transient aligned dimension between the moving wall axis and a reference. */
  private buildDim(side: 'pos' | 'neg', ref: WallMoveDimReference, units: SceneUnits, worldY: number): BimDimension3D {
    const mmFactor = mmToSceneUnits(units) || 1;
    const endpointA = this.planWorld(ref.fromPlan, mmFactor, worldY);
    const endpointB = this.planWorld(ref.toPlan, mmFactor, worldY);
    return {
      id: `temp-wall-move-dim-${side}`,
      projectId: '',
      companyId: '',
      mode: 'aligned',
      placement: { aligned: {} },
      anchor: { endpointA, endpointB },
      textOffset: { x: 0, y: 0 },
      textPlane: 'billboard',
      value: ref.distanceMm * MM_TO_M, // metres; formatted as mm by unit below
      unit: 'mm',
      precision: 0,
      leaderStyle: { shape: 'straight', arrowSize: 0.04 },
      createdBy: '',
      createdAt: '',
      updatedAt: '',
    };
  }

  /** Scene-unit plan point → THREE world Vec3 at `worldY` (the gizmo-anchor elevation). */
  private planWorld(plan: { x: number; y: number }, mmFactor: number, worldY: number): Vec3 {
    const world = dxfPlanToWorld(plan.x / mmFactor, plan.y / mmFactor, 0);
    world.y = worldY;
    return toVec3(world);
  }
}
