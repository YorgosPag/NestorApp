'use client';

/**
 * MepManifoldPlacementGhost — translucent 3D preview of the manifold about to
 * be placed. ADR-408 Φ12, mirror of `ElectricalPanelPlacementGhost`. Scene-side
 * leaf object: added to the live scene in the constructor, follows the cursor via
 * `update`, removed on `dispose`. Pure Three.js — no React, no store subscription.
 *
 * The ghost mesh is built by the SAME SSoT path the commit uses
 * (`buildDefaultMepManifoldParams` → `computeMepManifoldGeometry` →
 * `manifoldToMesh`) and reads overrides from the SAME `mepManifoldToolBridgeStore`
 * — so the preview is exactly what the click creates (WYSIWYG).
 */

import * as THREE from 'three';
import type { Point2D } from '../../rendering/types/Types';
import type { MepManifoldEntity } from '../../bim/types/mep-manifold-types';
import {
  buildMepManifoldEntity,
  buildDefaultMepManifoldParams,
  type MepManifoldParamOverrides,
} from '../../hooks/drawing/mep-manifold-completion';
import { computeMepManifoldGeometry } from '../../bim/mep-manifolds/mep-manifold-geometry';
import { manifoldToMesh } from '../converters/BimToThreeConverter';
import { mepManifoldToolBridgeStore } from '../../ui/ribbon/hooks/bridge/mep-manifold-tool-bridge-store';

/** Layer id stamped on the throwaway ghost entity (never persisted). */
const GHOST_LAYER_ID = '__ghost-mep-manifold__';

export class MepManifoldPlacementGhost {
  private readonly scene: THREE.Scene;
  private readonly material: THREE.MeshStandardMaterial;
  private mesh: THREE.Mesh | null = null;
  private entity: MepManifoldEntity | null = null;
  private disposed = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.material = new THREE.MeshStandardMaterial({
      color: 0x14b8a6,
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
    const mesh = manifoldToMesh(entity, floorElevationMm, levelId);
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
    this.mesh.geometry.dispose();
    this.mesh = null;
  }

  private buildGhostEntity(scenePoint: Readonly<Point2D>): MepManifoldEntity | null {
    const handle = mepManifoldToolBridgeStore.get();
    const units = handle?.getSceneUnits() ?? 'mm';
    const overrides: MepManifoldParamOverrides = handle ? { ...handle.overrides } : {};
    const params = buildDefaultMepManifoldParams(scenePoint, overrides, units);
    const geometry = computeMepManifoldGeometry(params);
    if (this.entity) return { ...this.entity, params, geometry };
    const result = buildMepManifoldEntity(params, GHOST_LAYER_ID);
    return result.ok ? result.entity : null;
  }
}
