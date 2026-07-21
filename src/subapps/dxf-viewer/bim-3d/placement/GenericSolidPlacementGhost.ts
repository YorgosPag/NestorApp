'use client';

/**
 * GenericSolidPlacementGhost — translucent 3D preview of the parametric solid about
 * to be placed. ADR-684, mirror of `FurniturePlacementGhost`. Scene-side leaf
 * object: follows the cursor via `update`, removed on `dispose`. Pure Three.js —
 * no React, no store subscription.
 *
 * The ghost object is built by the SAME SSoT path the commit uses
 * (`buildDefaultGenericSolidParams` → `genericSolidToObject3D`) and reads the
 * chosen `shape` + overrides from the SAME `genericSolidToolBridgeStore` — so the
 * preview is exactly what the click creates (WYSIWYG). Translucent material +
 * post-FX overlay + non-pickable + disposal live in the shared
 * `PlacementGhostOverlay` SSoT (ADR-537).
 */

import * as THREE from 'three';
import type { Point2D } from '../../rendering/types/Types';
import {
  buildDefaultGenericSolidParams,
  type GenericSolidParamOverrides,
} from '../../hooks/drawing/generic-solid-completion';
import { computeGenericSolidGeometry } from '../../bim/entities/generic-solid/generic-solid-geometry';
import { createGenericSolid } from '@/services/factories/generic-solid.factory';
import { genericSolidToObject3D } from '../converters/generic-solid-to-three';
import { genericSolidToolBridgeStore } from '../../ui/ribbon/hooks/bridge/generic-solid-tool-bridge-store';
import { PlacementGhostOverlay } from './placement-ghost-overlay';

/** Layer id stamped on the throwaway ghost entity (never persisted). */
const GHOST_LAYER_ID = '__ghost-generic-solid__';

export class GenericSolidPlacementGhost {
  private readonly overlay: PlacementGhostOverlay;

  constructor(scene: THREE.Scene) {
    this.overlay = new PlacementGhostOverlay(scene, 0x6aa0c8, 0.45);
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
    const handle = genericSolidToolBridgeStore.get();
    const units = handle?.getSceneUnits() ?? 'mm';
    const overrides: GenericSolidParamOverrides = handle
      ? { ...handle.overrides, shape: handle.shape }
      : {};
    const params = buildDefaultGenericSolidParams(scenePoint, overrides, units);
    const geometry = computeGenericSolidGeometry(params);
    const entity = createGenericSolid({ params, geometry, layerId: GHOST_LAYER_ID });
    return genericSolidToObject3D(entity, floorElevationMm, levelId);
  }
}
