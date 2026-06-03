'use client';

/**
 * FurniturePlacementGhost — translucent 3D preview of the furniture about to be
 * placed. ADR-410, mirror of `MepFixturePlacementGhost`. Scene-side leaf object:
 * added to the live scene in the constructor, follows the cursor via `update`,
 * removed on `dispose`. Pure Three.js — no React, no store subscription.
 *
 * The ghost object is built by the SAME SSoT path the commit uses
 * (`buildDefaultFurnitureParams` → `furnitureToObject3D`) and reads assetId /
 * overrides from the SAME `furnitureToolBridgeStore` — so the preview is exactly
 * what the click creates (WYSIWYG). On a cache miss it shows the bbox placeholder.
 */

import * as THREE from 'three';
import type { Point2D } from '../../rendering/types/Types';
import {
  buildDefaultFurnitureParams,
  type FurnitureParamOverrides,
} from '../../hooks/drawing/furniture-completion';
import { computeFurnitureGeometry } from '../../bim/furniture/furniture-geometry';
import { createFurniture } from '@/services/factories/furniture.factory';
import { furnitureToObject3D } from '../converters/furniture-to-three';
import { furnitureToolBridgeStore } from '../../ui/ribbon/hooks/bridge/furniture-tool-bridge-store';

/** Layer id stamped on the throwaway ghost entity (never persisted). */
const GHOST_LAYER_ID = '__ghost-furniture__';

export class FurniturePlacementGhost {
  private readonly scene: THREE.Scene;
  private readonly material: THREE.MeshStandardMaterial;
  private obj: THREE.Object3D | null = null;
  private disposed = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.material = new THREE.MeshStandardMaterial({
      color: 0xb48250,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      roughness: 0.65,
      metalness: 0.05,
    });
  }

  /** Rebuild the ghost at `scenePoint` (active scene units) on the active floor. */
  update(scenePoint: Readonly<Point2D>, floorElevationMm: number, levelId: string | undefined): void {
    if (this.disposed) return;
    this.removeObj();
    const obj = this.buildGhostObject(scenePoint, floorElevationMm, levelId);
    if (!obj) return;
    obj.traverse((child) => {
      child.userData = {};
      child.raycast = () => {};
      if (child instanceof THREE.Mesh) child.material = this.material;
    });
    this.obj = obj;
    this.scene.add(obj);
  }

  setVisible(visible: boolean): void {
    if (this.obj) this.obj.visible = visible;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.removeObj();
    this.material.dispose();
  }

  private removeObj(): void {
    if (!this.obj) return;
    this.scene.remove(this.obj);
    this.obj.traverse((child) => {
      if (child instanceof THREE.Mesh) child.geometry.dispose();
    });
    this.obj = null;
  }

  private buildGhostObject(
    scenePoint: Readonly<Point2D>,
    floorElevationMm: number,
    levelId: string | undefined,
  ): THREE.Object3D | null {
    const handle = furnitureToolBridgeStore.get();
    const units = handle?.getSceneUnits() ?? 'mm';
    const overrides: FurnitureParamOverrides = handle
      ? { ...handle.overrides, assetId: handle.assetId }
      : {};
    const params = buildDefaultFurnitureParams(scenePoint, overrides, units);
    const geometry = computeFurnitureGeometry(params);
    const entity = createFurniture({ params, geometry, layerId: GHOST_LAYER_ID });
    return furnitureToObject3D(entity, floorElevationMm, levelId);
  }
}
