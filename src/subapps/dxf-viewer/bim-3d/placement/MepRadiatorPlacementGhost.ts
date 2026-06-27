'use client';

/**
 * MepRadiatorPlacementGhost — translucent 3D preview of the heating radiator
 * about to be placed. ADR-408 Εύρος Β #1, mirror of `MepManifoldPlacementGhost`.
 * Scene-side leaf object: follows the cursor via `update`, removed on `dispose`.
 * Pure Three.js — no React, no store subscription.
 *
 * The ghost mesh is built by the SAME SSoT path the commit uses
 * (`buildDefaultMepRadiatorParams` → `computeMepRadiatorGeometry` →
 * `radiatorToMesh`) and reads overrides from the SAME `mepRadiatorToolBridgeStore`
 * — so the preview is exactly what the click creates (WYSIWYG). A radiator keeps a
 * fixed warm-red heating-equipment colour. Translucent material + post-FX overlay +
 * non-pickable + disposal live in the shared `PlacementGhostOverlay` SSoT (ADR-537).
 */

import * as THREE from 'three';
import type { Point2D } from '../../rendering/types/Types';
import type { MepRadiatorEntity } from '../../bim/types/mep-radiator-types';
import {
  buildMepRadiatorEntity,
  buildDefaultMepRadiatorParams,
  type MepRadiatorParamOverrides,
} from '../../hooks/drawing/mep-radiator-completion';
import { computeMepRadiatorGeometry } from '../../bim/mep-radiators/mep-radiator-geometry';
import { radiatorToMesh } from '../converters/BimToThreeConverter';
import { mepRadiatorToolBridgeStore } from '../../ui/ribbon/hooks/bridge/mep-radiator-tool-bridge-store';
import { PlacementGhostOverlay } from './placement-ghost-overlay';

/** Warm-red heating-equipment ghost tint (matches the committed radiator material family). */
const GHOST_COLOR = 0xdc2626;

/** Layer id stamped on the throwaway ghost entity (never persisted). */
const GHOST_LAYER_ID = '__ghost-mep-radiator__';

export class MepRadiatorPlacementGhost {
  private readonly overlay: PlacementGhostOverlay;
  private entity: MepRadiatorEntity | null = null;

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
    this.overlay.setObject(radiatorToMesh(entity, floorElevationMm, levelId));
  }

  setVisible(visible: boolean): void {
    this.overlay.setVisible(visible);
  }

  dispose(): void {
    this.overlay.dispose();
  }

  private buildGhostEntity(scenePoint: Readonly<Point2D>): MepRadiatorEntity | null {
    const handle = mepRadiatorToolBridgeStore.get();
    const units = handle?.getSceneUnits() ?? 'mm';
    const overrides: MepRadiatorParamOverrides = handle ? { ...handle.overrides } : {};
    const params = buildDefaultMepRadiatorParams(scenePoint, overrides, units);
    const geometry = computeMepRadiatorGeometry(params);
    if (this.entity) return { ...this.entity, params, geometry };
    const result = buildMepRadiatorEntity(params, GHOST_LAYER_ID);
    return result.ok ? result.entity : null;
  }
}
