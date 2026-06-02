'use client';

/**
 * MepFixturePlacementGhost — translucent 3D preview of the fixture about to be
 * placed. ADR-406, mirror of `ColumnPlacementGhost` (ADR-403). Scene-side leaf
 * object: added to the live scene in the constructor, follows the cursor via
 * `update`, removed on `dispose`. Pure Three.js — no React, no store subscription.
 *
 * The ghost mesh is built by the SAME SSoT path the commit uses
 * (`buildDefaultMepFixtureParams` → `computeMepFixtureGeometry` → `fixtureToMesh`)
 * and reads shape/overrides from the SAME `mepFixtureToolBridgeStore` — so the
 * preview is exactly what the click creates (WYSIWYG).
 */

import * as THREE from 'three';
import type { Point2D } from '../../rendering/types/Types';
import type { MepFixtureEntity } from '../../bim/types/mep-fixture-types';
import {
  buildMepFixtureEntity,
  buildDefaultMepFixtureParams,
  type MepFixtureParamOverrides,
} from '../../hooks/drawing/mep-fixture-completion';
import { computeMepFixtureGeometry } from '../../bim/mep-fixtures/mep-fixture-geometry';
import { fixtureToMesh } from '../converters/BimToThreeConverter';
import { mepFixtureToolBridgeStore } from '../../ui/ribbon/hooks/bridge/mep-fixture-tool-bridge-store';

/** Layer id stamped on the throwaway ghost entity (never persisted). */
const GHOST_LAYER_ID = '__ghost-mep-fixture__';

export class MepFixturePlacementGhost {
  private readonly scene: THREE.Scene;
  private readonly material: THREE.MeshStandardMaterial;
  private mesh: THREE.Mesh | null = null;
  private entity: MepFixtureEntity | null = null;
  private disposed = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.material = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
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
    const mesh = fixtureToMesh(entity, floorElevationMm, levelId);
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

  private buildGhostEntity(scenePoint: Readonly<Point2D>): MepFixtureEntity | null {
    const handle = mepFixtureToolBridgeStore.get();
    const units = handle?.getSceneUnits() ?? 'mm';
    const overrides: MepFixtureParamOverrides = handle
      ? { ...handle.overrides, shape: handle.shape }
      : {};
    const params = buildDefaultMepFixtureParams(scenePoint, overrides, units);
    const geometry = computeMepFixtureGeometry(params);
    if (this.entity) return { ...this.entity, params, geometry };
    const result = buildMepFixtureEntity(params, GHOST_LAYER_ID);
    return result.ok ? result.entity : null;
  }
}
