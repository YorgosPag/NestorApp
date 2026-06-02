'use client';

/**
 * ElectricalPanelPlacementGhost — translucent 3D preview of the panel about to
 * be placed. ADR-408 Φ3, mirror of `MepFixturePlacementGhost`. Scene-side leaf
 * object: added to the live scene in the constructor, follows the cursor via
 * `update`, removed on `dispose`. Pure Three.js — no React, no store subscription.
 *
 * The ghost mesh is built by the SAME SSoT path the commit uses
 * (`buildDefaultElectricalPanelParams` → `computeElectricalPanelGeometry` →
 * `panelToMesh`) and reads overrides from the SAME `electricalPanelToolBridgeStore`
 * — so the preview is exactly what the click creates (WYSIWYG).
 */

import * as THREE from 'three';
import type { Point2D } from '../../rendering/types/Types';
import type { ElectricalPanelEntity } from '../../bim/types/electrical-panel-types';
import {
  buildElectricalPanelEntity,
  buildDefaultElectricalPanelParams,
  type ElectricalPanelParamOverrides,
} from '../../hooks/drawing/electrical-panel-completion';
import { computeElectricalPanelGeometry } from '../../bim/electrical-panels/electrical-panel-geometry';
import { panelToMesh } from '../converters/BimToThreeConverter';
import { electricalPanelToolBridgeStore } from '../../ui/ribbon/hooks/bridge/electrical-panel-tool-bridge-store';

/** Layer id stamped on the throwaway ghost entity (never persisted). */
const GHOST_LAYER_ID = '__ghost-electrical-panel__';

export class ElectricalPanelPlacementGhost {
  private readonly scene: THREE.Scene;
  private readonly material: THREE.MeshStandardMaterial;
  private mesh: THREE.Mesh | null = null;
  private entity: ElectricalPanelEntity | null = null;
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
    const mesh = panelToMesh(entity, floorElevationMm, levelId);
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

  private buildGhostEntity(scenePoint: Readonly<Point2D>): ElectricalPanelEntity | null {
    const handle = electricalPanelToolBridgeStore.get();
    const units = handle?.getSceneUnits() ?? 'mm';
    const overrides: ElectricalPanelParamOverrides = handle ? { ...handle.overrides } : {};
    const params = buildDefaultElectricalPanelParams(scenePoint, overrides, units);
    const geometry = computeElectricalPanelGeometry(params);
    if (this.entity) return { ...this.entity, params, geometry };
    const result = buildElectricalPanelEntity(params, GHOST_LAYER_ID);
    return result.ok ? result.entity : null;
  }
}
