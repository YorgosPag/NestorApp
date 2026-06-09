'use client';

/**
 * OpeningMoveGhost — translucent 3D preview of a hosted opening (door/window) as it
 * is dragged onto / along a wall (ADR-363 Φ1G.5 Slice 2d, Revit-style host-aware move).
 *
 * Scene-side leaf object (the BeamFromWallGhost / ColumnPlacementGhost pattern,
 * ADR-403): added to the live scene in the constructor, follows the wall under the
 * cursor via `showFor`, hidden when the cursor misses a wall, removed on `dispose`.
 * Pure Three.js — no React, no store subscription (the `useBim3DOpeningMove` hook
 * drives it).
 *
 * The ghost body is built by the SAME SSoT the wall converter uses to embed an
 * opening (`computeOpeningGeometry` → `buildOpeningMesh`) — so the preview is exactly
 * the opening the release will commit (WYSIWYG: correct rotation + thickness on the
 * resolved host). Only the materials are swapped for ONE translucent material; the
 * group is added to `scene` (not `bimLayer.group`), so it is invisible to the BIM
 * raycaster underneath (the cursor keeps reading the real wall surface).
 *
 * NOTE the «hole» in the wall is NOT moved live (that is a per-frame wall rebuild,
 * the cost the gizmo path avoided): during the drag the wall shows the old void and
 * this ghost previews where the opening lands; the release re-syncs the wall meshes
 * with the void on the resolved host.
 */

import * as THREE from 'three';
import type { OpeningEntity, OpeningParams } from '../../bim/types/opening-types';
import type { WallEntity } from '../../bim/types/wall-types';
import { computeOpeningGeometry } from '../../bim/geometry/opening-geometry';
import { buildOpeningMesh, type OpeningMeshMaterials } from '../converters/opening-mesh';

export class OpeningMoveGhost {
  private readonly scene: THREE.Scene;
  private readonly material: THREE.MeshStandardMaterial;
  private readonly materials: OpeningMeshMaterials;
  private group: THREE.Group | null = null;
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
    // One translucent material for every part (κάσα / φύλλο / υαλοστάσιο) of the ghost.
    this.materials = { frame: this.material, leaf: this.material, glass: this.material };
  }

  /**
   * Build (replacing the previous) the translucent opening body for `resolvedParams`
   * on `host` and show it. Geometry is recomputed against the resolved host via the
   * SSoT, so the ghost auto-rotates + matches the host thickness. No-ops to `hide`
   * when the geometry is degenerate.
   */
  showFor(
    opening: OpeningEntity,
    resolvedParams: OpeningParams,
    host: WallEntity,
    floorElevationMm: number,
    buildingBaseElevationM: number,
  ): void {
    if (this.disposed) return;
    const units = host.params.sceneUnits ?? 'mm';
    const geometry = computeOpeningGeometry(resolvedParams, host, units);
    const ghostEntity: OpeningEntity = { ...opening, params: resolvedParams, geometry };
    const group = buildOpeningMesh(ghostEntity, host, this.materials, floorElevationMm, buildingBaseElevationM);
    this.removeGroup();
    if (!group) return;
    // Non-pickable: strip the bim tags so the ghost never intercepts a raycast.
    group.traverse((obj) => {
      obj.userData = {};
      obj.raycast = () => {};
    });
    this.group = group;
    this.scene.add(group);
  }

  hide(): void {
    if (this.group) this.group.visible = false;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.removeGroup();
    this.material.dispose();
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private removeGroup(): void {
    if (!this.group) return;
    this.scene.remove(this.group);
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) obj.geometry.dispose();
    });
    this.group = null;
  }
}
