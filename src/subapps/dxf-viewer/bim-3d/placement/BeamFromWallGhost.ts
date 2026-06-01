'use client';

/**
 * BeamFromWallGhost — translucent 3D preview of the beam «Δοκάρι από τοίχο»
 * (ADR-363) is about to create on the hovered wall's axis.
 *
 * Scene-side leaf object (the BimGizmoOverlay / ColumnPlacementGhost pattern,
 * ADR-403): added to the live scene in the constructor, follows the hovered
 * wall via `showForWall`, hidden when no wall is under the cursor, removed on
 * `dispose`. Pure Three.js — no React, no store subscription (the hook drives it).
 *
 * The ghost mesh is built by the SAME SSoT the commit path uses
 * (`buildBeamFromWall` → `beamToMesh`) and reads overrides + scene units from
 * the SAME `beamToolBridgeStore` the 2D `useBeamTool` publishes — so the preview
 * is exactly the beam the click will create (WYSIWYG). Only the material is
 * swapped for a translucent one; the mesh is made non-pickable so it never
 * intercepts the wall hover/selection raycast underneath.
 *
 * Unlike ColumnPlacementGhost (cursor-driven), this ghost depends only on the
 * hovered wall, so it is rebuilt only when the wall reference changes — after a
 * commit + resync the store hands a fresh WallEntity, so the stale preview
 * (built from the pre-shorten params) is correctly discarded.
 */

import * as THREE from 'three';
import type { WallEntity } from '../../bim/types/wall-types';
import { buildBeamFromWall } from '../../bim/beams/beam-from-wall';
import { beamToolBridgeStore } from '../../bim/beams/beam-tool-bridge-store';
import { beamToMesh } from '../converters/BimToThreeConverter';
import { useBim3DEntitiesStore } from '../stores/Bim3DEntitiesStore';
import { resolveActiveFloorElevationMm } from './raycast-floor-point';

/** Layer id stamped on the throwaway ghost beam (never persisted). */
const GHOST_LAYER_ID = '__ghost-beam__';
const MM_TO_M = 0.001;

export class BeamFromWallGhost {
  private readonly scene: THREE.Scene;
  private readonly material: THREE.MeshStandardMaterial;
  private mesh: THREE.Mesh | null = null;
  /** Wall the current ghost was built for — rebuild only when the ref changes. */
  private wall: WallEntity | null = null;
  private disposed = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.material = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      roughness: 0.6,
      metalness: 0.0,
    });
  }

  /** Build (or reuse) the ghost beam on `wall`'s axis and show it. */
  showForWall(wall: WallEntity): void {
    if (this.disposed) return;
    // Same wall object as last frame → keep the existing mesh visible (no churn).
    if (this.wall === wall && this.mesh) {
      this.mesh.visible = true;
      return;
    }
    const handle = beamToolBridgeStore.get();
    const units = handle?.getSceneUnits() ?? 'mm';
    const overrides = handle?.overrides ?? {};
    const levelId = useBim3DEntitiesStore.getState().activeLevelId ?? undefined;
    const result = buildBeamFromWall(wall, overrides, levelId ?? GHOST_LAYER_ID, units);
    if (!result.ok) {
      this.hide();
      return;
    }
    this.removeMesh();
    // Active-floor datum (m) — mirrors BimSceneLayer.syncBeams base elevation so
    // the ghost sits exactly where the committed beam will render.
    const baseElevationM = resolveActiveFloorElevationMm() * MM_TO_M;
    const mesh = beamToMesh(result.entity, levelId, baseElevationM);
    if (!mesh) {
      this.hide();
      return;
    }
    mesh.material = this.material;
    // Non-pickable: the ghost must not intercept hover/selection object raycasts.
    mesh.userData = {};
    mesh.raycast = () => {};
    this.mesh = mesh;
    this.wall = wall;
    this.scene.add(mesh);
  }

  hide(): void {
    if (this.mesh) this.mesh.visible = false;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.removeMesh();
    this.material.dispose();
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private removeMesh(): void {
    if (!this.mesh) return;
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh = null;
    this.wall = null;
  }
}
