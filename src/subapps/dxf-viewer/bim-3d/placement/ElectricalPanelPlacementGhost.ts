'use client';

/**
 * ElectricalPanelPlacementGhost — translucent 3D preview of the panel about to
 * be placed. ADR-408 Φ3, mirror of `MepFixturePlacementGhost`. Scene-side leaf
 * object: follows the cursor via `update`, removed on `dispose`. Pure Three.js —
 * no React, no store subscription.
 *
 * The ghost mesh is built by the SAME SSoT path the commit uses
 * (`buildDefaultElectricalPanelParams` → `computeElectricalPanelGeometry` →
 * `panelToMesh`) and reads overrides from the SAME `electricalPanelToolBridgeStore`
 * — so the preview is exactly what the click creates (WYSIWYG). Translucent
 * material + post-FX overlay + non-pickable + disposal live in the shared
 * `PlacementGhostOverlay` SSoT (ADR-537).
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
import { PlacementGhostOverlay } from './placement-ghost-overlay';

/** Layer id stamped on the throwaway ghost entity (never persisted). */
const GHOST_LAYER_ID = '__ghost-electrical-panel__';

export class ElectricalPanelPlacementGhost {
  private readonly overlay: PlacementGhostOverlay;
  private entity: ElectricalPanelEntity | null = null;

  constructor(scene: THREE.Scene) {
    this.overlay = new PlacementGhostOverlay(scene, 0x14b8a6, 0.45);
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
    this.overlay.setObject(panelToMesh(entity, floorElevationMm, levelId));
  }

  setVisible(visible: boolean): void {
    this.overlay.setVisible(visible);
  }

  dispose(): void {
    this.overlay.dispose();
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
