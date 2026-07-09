'use client';

/**
 * TempDim3DOverlayBase — SSoT for Revit-style temporary/listening 3D dimension overlays
 * (ADR-618, extracted from ADR-363 Φ1G.5).
 *
 * Both `TempOpeningDimOverlay` (opening drag) and `TempWallMoveDimOverlay` (wall gizmo
 * move) draw ≤2 blue witness lines with a live value, reusing the manual-dimension SSoT
 * `createDimension3DRenderer`. They carried a byte-identical copy of: the scene-side
 * group lifecycle (`scene.add`/`hide`/`remove`), the two-side create/update/hide sync
 * (`syncSide`), the screen-constant label scaling (`scaleText`), the side disposal, and
 * the transient `BimDimension3D` envelope. This base owns all of that; each subclass
 * supplies ONLY its domain `update(...)` — resolve references → build ≤2 dims → call
 * `setSides`. The dimensions are a TRANSIENT read-model (never persisted) — they vanish
 * on release. Pure Three.js leaf: no React, no store subscription.
 *
 * @see ../dimensions/Dimension3DRenderer.ts — the manual-dimension renderer SSoT
 */

import * as THREE from 'three';
import { getPixelWorldSize } from '../viewport/coordinate-transforms';
import { createDimension3DRenderer } from '../dimensions/Dimension3DRenderer';
import type { LayoutOptions } from '../dimensions/dim3d-line-geometry';
import type { BimDimension3D, Vec3 } from '../dimensions/dim3d-types';

/** Metres per millimetre — the dimension `value` is stored in metres, rendered as mm. */
const MM_TO_M = 0.001;
/** On-screen height (px) of the dimension label, held CONSTANT across zoom (Revit). */
const TEMP_DIM_TEXT_PX = 48;
/** Label texture aspect (512×128 canvas → 4:1) — keeps the sprite undistorted. */
const TEMP_DIM_TEXT_ASPECT = 4;
/**
 * Place the witness line + label ON the axis/perpendicular (no side offset) so the
 * dimension is centred and the billboard label stays visible from either side.
 */
const AXIS_LAYOUT: Partial<LayoutOptions> = { dimLineOffset: 0, textOffset: 0 };

type Dim3DHandle = ReturnType<typeof createDimension3DRenderer>;

export abstract class TempDim3DOverlayBase {
  protected readonly scene: THREE.Scene;
  protected readonly group: THREE.Group;
  private sideA: Dim3DHandle | null = null;
  private sideB: Dim3DHandle | null = null;
  private disposed = false;
  private readonly tmpWorld = new THREE.Vector3();

  constructor(scene: THREE.Scene, groupName: string) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = groupName;
    scene.add(this.group);
  }

  hide(): void {
    this.group.visible = false;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.disposeSide(this.sideA);
    this.disposeSide(this.sideB);
    this.sideA = null;
    this.sideB = null;
    this.scene.remove(this.group);
  }

  protected get isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Show/refresh the two witness sides for this frame. Either `dim` may be `null` to
   * hide that side (flush reference / no reference). Makes the group visible.
   */
  protected setSides(
    dimA: BimDimension3D | null,
    dimB: BimDimension3D | null,
    camera: THREE.Camera,
    canvas: HTMLElement,
  ): void {
    this.group.visible = true;
    this.sideA = this.syncSide(this.sideA, dimA, camera, canvas);
    this.sideB = this.syncSide(this.sideB, dimB, camera, canvas);
  }

  /**
   * Build the shared transient aligned-dimension envelope. Only the `id`, the two
   * endpoints, and the value (`distMm`) vary per side — everything else is constant.
   */
  protected buildBaseDim(id: string, endpointA: Vec3, endpointB: Vec3, distMm: number): BimDimension3D {
    return {
      id,
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
}
