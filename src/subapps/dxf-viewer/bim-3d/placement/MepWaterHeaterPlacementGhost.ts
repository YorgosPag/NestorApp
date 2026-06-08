'use client';

/**
 * MepWaterHeaterPlacementGhost — translucent 3D preview of the domestic hot water
 * heater (θερμοσίφωνας) about to be placed. ADR-408 DHW, mirror of
 * `MepBoilerPlacementGhost`. Scene-side leaf object: added to the live scene in the
 * constructor, follows the cursor via `update`, removed on `dispose`. Pure Three.js —
 * no React, no store subscription.
 *
 * The ghost mesh is built by the SAME SSoT path the commit uses
 * (`buildDefaultMepWaterHeaterParams` → `computeMepWaterHeaterGeometry` →
 * `waterHeaterToMesh`) and reads overrides from the SAME
 * `mepWaterHeaterToolBridgeStore` — so the preview is exactly what the click creates
 * (WYSIWYG). A water heater keeps a fixed blue DHW-equipment colour (no per-kind
 * palette, mirror converter).
 */

import * as THREE from 'three';
import type { Point2D } from '../../rendering/types/Types';
import type { MepWaterHeaterEntity } from '../../bim/types/mep-water-heater-types';
import {
  buildMepWaterHeaterEntity,
  buildDefaultMepWaterHeaterParams,
  type MepWaterHeaterParamOverrides,
} from '../../hooks/drawing/mep-water-heater-completion';
import { computeMepWaterHeaterGeometry } from '../../bim/mep-water-heaters/mep-water-heater-geometry';
import { waterHeaterToMesh } from '../converters/BimToThreeConverter';
import { mepWaterHeaterToolBridgeStore } from '../../ui/ribbon/hooks/bridge/mep-water-heater-tool-bridge-store';

/** Blue DHW-equipment ghost tint (matches the committed water heater material family). */
const GHOST_COLOR = 0x2563eb;

/** Layer id stamped on the throwaway ghost entity (never persisted). */
const GHOST_LAYER_ID = '__ghost-mep-water-heater__';

export class MepWaterHeaterPlacementGhost {
  private readonly scene: THREE.Scene;
  private readonly material: THREE.MeshStandardMaterial;
  private mesh: THREE.Mesh | null = null;
  private entity: MepWaterHeaterEntity | null = null;
  private disposed = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.material = new THREE.MeshStandardMaterial({
      color: GHOST_COLOR,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      roughness: 0.6,
      metalness: 0.0,
    });
  }

  /** Rebuild the ghost at `scenePoint` (active scene units) on the active floor. */
  update(scenePoint: Readonly<Point2D>, floorElevationMm: number, levelId: string | undefined): void {
    if (this.disposed) return;
    const entity = this.buildGhostEntity(scenePoint);
    if (!entity) {
      this.setVisible(false);
      return;
    }
    this.entity = entity;
    this.removeMesh();
    const mesh = waterHeaterToMesh(entity, floorElevationMm, levelId);
    if (!mesh) return;
    mesh.material = this.material;
    mesh.userData = {};
    mesh.raycast = () => {};
    this.mesh = mesh;
    this.scene.add(mesh);
  }

  setVisible(visible: boolean): void {
    if (this.mesh) this.mesh.visible = visible;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.removeMesh();
    this.material.dispose();
  }

  private removeMesh(): void {
    if (!this.mesh) return;
    this.scene.remove(this.mesh);
    // Dispose every geometry in the subtree, not just the box: the mesh carries an
    // edge-overlay child. Materials are shared singletons — never disposed here.
    this.mesh.traverse((obj) => {
      const g = (obj as THREE.Mesh | THREE.LineSegments).geometry;
      if (g) g.dispose();
    });
    this.mesh = null;
  }

  private buildGhostEntity(scenePoint: Readonly<Point2D>): MepWaterHeaterEntity | null {
    const handle = mepWaterHeaterToolBridgeStore.get();
    const units = handle?.getSceneUnits() ?? 'mm';
    const overrides: MepWaterHeaterParamOverrides = handle ? { ...handle.overrides } : {};
    const params = buildDefaultMepWaterHeaterParams(scenePoint, overrides, units);
    const geometry = computeMepWaterHeaterGeometry(params);
    if (this.entity) return { ...this.entity, params, geometry };
    const result = buildMepWaterHeaterEntity(params, GHOST_LAYER_ID);
    return result.ok ? result.entity : null;
  }
}
