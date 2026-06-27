'use client';

/**
 * MepWaterHeaterPlacementGhost — translucent 3D preview of the domestic hot water
 * heater (θερμοσίφωνας) about to be placed. ADR-408 DHW, mirror of
 * `MepBoilerPlacementGhost`. Scene-side leaf object: follows the cursor via
 * `update`, removed on `dispose`. Pure Three.js — no React, no store subscription.
 *
 * The ghost mesh is built by the SAME SSoT path the commit uses
 * (`buildDefaultMepWaterHeaterParams` → `computeMepWaterHeaterGeometry` →
 * `waterHeaterToMesh`) and reads overrides from the SAME
 * `mepWaterHeaterToolBridgeStore` — so the preview is exactly what the click creates
 * (WYSIWYG). A water heater keeps a fixed blue DHW-equipment colour. Translucent
 * material + post-FX overlay + non-pickable + disposal live in the shared
 * `PlacementGhostOverlay` SSoT (ADR-537).
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
import { PlacementGhostOverlay } from './placement-ghost-overlay';

/** Blue DHW-equipment ghost tint (matches the committed water heater material family). */
const GHOST_COLOR = 0x2563eb;

/** Layer id stamped on the throwaway ghost entity (never persisted). */
const GHOST_LAYER_ID = '__ghost-mep-water-heater__';

export class MepWaterHeaterPlacementGhost {
  private readonly overlay: PlacementGhostOverlay;
  private entity: MepWaterHeaterEntity | null = null;

  constructor(scene: THREE.Scene) {
    this.overlay = new PlacementGhostOverlay(scene, GHOST_COLOR, 0.45);
  }

  /** Rebuild the ghost at `scenePoint` (active scene units) on the active floor. */
  update(scenePoint: Readonly<Point2D>, floorElevationMm: number, levelId: string | undefined): void {
    if (this.overlay.isDisposed) return;
    const entity = this.buildGhostEntity(scenePoint);
    if (!entity) {
      this.overlay.setVisible(false);
      return;
    }
    this.entity = entity;
    this.overlay.setObject(waterHeaterToMesh(entity, floorElevationMm, levelId));
  }

  setVisible(visible: boolean): void {
    this.overlay.setVisible(visible);
  }

  dispose(): void {
    this.overlay.dispose();
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
