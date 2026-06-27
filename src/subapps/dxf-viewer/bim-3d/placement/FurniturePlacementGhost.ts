'use client';

/**
 * FurniturePlacementGhost — translucent 3D preview of the furniture about to be
 * placed. ADR-410, mirror of `MepFixturePlacementGhost`. Scene-side leaf object:
 * follows the cursor via `update`, removed on `dispose`. Pure Three.js — no React,
 * no store subscription.
 *
 * The ghost object is built by the SAME SSoT path the commit uses
 * (`buildDefaultFurnitureParams` → `furnitureToObject3D`) and reads assetId /
 * overrides from the SAME `furnitureToolBridgeStore` — so the preview is exactly
 * what the click creates (WYSIWYG). On a cache miss it shows the bbox placeholder.
 * Translucent material + post-FX overlay + non-pickable + disposal live in the
 * shared `PlacementGhostOverlay` SSoT (ADR-537).
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
import { PlacementGhostOverlay } from './placement-ghost-overlay';

/** Layer id stamped on the throwaway ghost entity (never persisted). */
const GHOST_LAYER_ID = '__ghost-furniture__';

export class FurniturePlacementGhost {
  private readonly overlay: PlacementGhostOverlay;

  constructor(scene: THREE.Scene) {
    this.overlay = new PlacementGhostOverlay(scene, 0xb48250, 0.45);
  }

  /** Rebuild the ghost at `scenePoint` (active scene units) on the active floor. */
  update(scenePoint: Readonly<Point2D>, floorElevationMm: number, levelId: string | undefined): void {
    if (this.overlay.isDisposed) return;
    this.overlay.setObject(this.buildGhostObject(scenePoint, floorElevationMm, levelId));
  }

  setVisible(visible: boolean): void {
    this.overlay.setVisible(visible);
  }

  dispose(): void {
    this.overlay.dispose();
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
