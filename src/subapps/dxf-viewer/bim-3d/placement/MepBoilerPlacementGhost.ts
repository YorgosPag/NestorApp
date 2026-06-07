'use client';

/**
 * MepBoilerPlacementGhost — translucent 3D preview of the heating boiler (λέβητας)
 * about to be placed. ADR-408 Εύρος Β #2, mirror of `MepRadiatorPlacementGhost`.
 * Scene-side leaf object: added to the live scene in the constructor, follows the
 * cursor via `update`, removed on `dispose`. Pure Three.js — no React, no store
 * subscription.
 *
 * The ghost mesh is built by the SAME SSoT path the commit uses
 * (`buildDefaultMepBoilerParams` → `computeMepBoilerGeometry` → `boilerToMesh`) and
 * reads overrides from the SAME `mepBoilerToolBridgeStore` — so the preview is
 * exactly what the click creates (WYSIWYG). A boiler keeps a fixed warm-red
 * heating-equipment colour (no per-kind palette, mirror converter).
 */

import * as THREE from 'three';
import type { Point2D } from '../../rendering/types/Types';
import type { MepBoilerEntity } from '../../bim/types/mep-boiler-types';
import {
  buildMepBoilerEntity,
  buildDefaultMepBoilerParams,
  type MepBoilerParamOverrides,
} from '../../hooks/drawing/mep-boiler-completion';
import { computeMepBoilerGeometry } from '../../bim/mep-boilers/mep-boiler-geometry';
import { boilerToMesh } from '../converters/BimToThreeConverter';
import { mepBoilerToolBridgeStore } from '../../ui/ribbon/hooks/bridge/mep-boiler-tool-bridge-store';

/** Warm-red heating-equipment ghost tint (matches the committed boiler material family). */
const GHOST_COLOR = 0xdc2626;

/** Layer id stamped on the throwaway ghost entity (never persisted). */
const GHOST_LAYER_ID = '__ghost-mep-boiler__';

export class MepBoilerPlacementGhost {
  private readonly scene: THREE.Scene;
  private readonly material: THREE.MeshStandardMaterial;
  private mesh: THREE.Mesh | null = null;
  private entity: MepBoilerEntity | null = null;
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
    const mesh = boilerToMesh(entity, floorElevationMm, levelId);
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

  private buildGhostEntity(scenePoint: Readonly<Point2D>): MepBoilerEntity | null {
    const handle = mepBoilerToolBridgeStore.get();
    const units = handle?.getSceneUnits() ?? 'mm';
    const overrides: MepBoilerParamOverrides = handle ? { ...handle.overrides } : {};
    const params = buildDefaultMepBoilerParams(scenePoint, overrides, units);
    const geometry = computeMepBoilerGeometry(params);
    if (this.entity) return { ...this.entity, params, geometry };
    const result = buildMepBoilerEntity(params, GHOST_LAYER_ID);
    return result.ok ? result.entity : null;
  }
}
