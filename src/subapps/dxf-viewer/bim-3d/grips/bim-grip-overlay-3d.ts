'use client';

/**
 * bim-grip-overlay-3d.ts — scene-side overlay for the 3D reshape grips (ADR-535 Φ1).
 *
 * Mirror of `BimGizmoOverlay`: owns the grip mesh set added to the live scene, keeps
 * each grip screen-constant + camera-facing (reuses the gizmo's `snapMarkerScreenScale`
 * SSoT), paints the hovered grip, and exposes a hit-test view + per-grip lookups for
 * the controller. The slab footprint can gain/lose vertices (edge-midpoint insertion),
 * so `setGrips` rebuilds the mesh set wholesale — a low-frequency op (selection / commit
 * re-sync), never per-frame.
 *
 * Pure Three.js leaf — no React, no `useSyncExternalStore`, no store subscription
 * (ADR-040: driven by the interaction hook, like the gizmo overlay).
 */

import * as THREE from 'three';
import type { GripInfo } from '../../hooks/grip-types';
import { snapMarkerScreenScale } from '../shared/snap-marker-core';
import {
  createGrip3DMeshes, GRIP_3D_COLOR, GRIP_3D_HOVER_COLOR,
  type Grip3DMeshSet, type Grip3DPart, type GripElevationMmFor,
} from './grip-mesh-factory-3d';

/** Screen-constant multiplier: gripScale = cameraDistance · tan(fov/2) · this. */
const GRIP_SCREEN_SCALE = 0.025;

export class BimGripOverlay3D {
  private readonly scene: THREE.Scene;
  private meshSet: Grip3DMeshSet | null = null;
  private hovered: number | null = null;
  private disposed = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  get visible(): boolean {
    return !this.disposed && !!this.meshSet && this.meshSet.root.visible;
  }

  /** Active grip hitboxes (controller hit-test view). */
  get hitboxes(): readonly THREE.Mesh[] {
    return this.meshSet ? this.meshSet.parts.map((p) => p.hitbox) : [];
  }

  /** Hitbox → gripIndex map (controller hit-test view). */
  get hitboxToIndex(): ReadonlyMap<THREE.Mesh, number> {
    return this.meshSet ? this.meshSet.hitboxToIndex : new Map();
  }

  /**
   * Rebuild the grip mesh set for the current slab footprint. Each grip rides its OWN
   * top-surface elevation (`elevationMmFor`, mm) so the cubes hug a tilted slab's sloped
   * top (ADR-535 Φ2). Pass an empty array to clear (non-slab / multi-select / deselected).
   * Resets hover.
   */
  setGrips(grips: readonly GripInfo[], elevationMmFor: GripElevationMmFor = () => 0): void {
    if (this.disposed) return;
    this.clearMeshes();
    if (grips.length === 0) return;
    this.meshSet = createGrip3DMeshes(grips, elevationMmFor);
    this.scene.add(this.meshSet.root);
  }

  setVisible(visible: boolean): void {
    if (this.meshSet) this.meshSet.root.visible = visible;
  }

  /** The `GripInfo` of grip `gripIndex`, or null. */
  gripByIndex(gripIndex: number): GripInfo | null {
    return this.partByIndex(gripIndex)?.grip ?? null;
  }

  /** Current world position of grip `gripIndex`, or null. */
  getGripWorld(gripIndex: number): THREE.Vector3 | null {
    const part = this.partByIndex(gripIndex);
    return part ? part.world.clone() : null;
  }

  /** Live-follow: move grip `gripIndex`'s square to `world` during a drag. */
  moveGrip(gripIndex: number, world: THREE.Vector3): void {
    const part = this.partByIndex(gripIndex);
    if (!part) return;
    part.world.copy(world);
    part.group.position.copy(world);
    part.group.updateMatrixWorld(true);
  }

  /** Highlight the hovered grip (gold). Returns true when the hovered grip changed. */
  setHover(gripIndex: number | null): boolean {
    if (this.disposed || gripIndex === this.hovered) return false;
    if (this.hovered !== null) this.paint(this.hovered, GRIP_3D_COLOR);
    if (gripIndex !== null) this.paint(gripIndex, GRIP_3D_HOVER_COLOR);
    this.hovered = gripIndex;
    return true;
  }

  /**
   * Keep every grip screen-constant (fixed pixel size during zoom/orbit). The cubes
   * stay AXIS-ALIGNED (no billboard) so they read as true 3D handles (ADR-535).
   */
  updateScale(camera: THREE.Camera): void {
    if (!this.meshSet) return;
    for (const part of this.meshSet.parts) {
      part.group.scale.setScalar(snapMarkerScreenScale(part.world, camera, GRIP_SCREEN_SCALE));
      part.group.position.copy(part.world);
      part.group.updateMatrixWorld(true);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clearMeshes();
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private partByIndex(gripIndex: number): Grip3DPart | null {
    return this.meshSet?.parts.find((p) => p.gripIndex === gripIndex) ?? null;
  }

  private paint(gripIndex: number, color: number): void {
    const part = this.partByIndex(gripIndex);
    if (part) (part.visual.material as THREE.MeshBasicMaterial).color.setHex(color);
  }

  private clearMeshes(): void {
    if (this.meshSet) {
      this.scene.remove(this.meshSet.root);
      this.meshSet.dispose();
      this.meshSet = null;
    }
    this.hovered = null;
  }
}
