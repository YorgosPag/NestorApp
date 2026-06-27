'use client';

/**
 * MepBoilerPlacementGhost — translucent 3D preview of the heating boiler (λέβητας)
 * about to be placed. ADR-408 Εύρος Β #2, mirror of `MepRadiatorPlacementGhost`.
 * Scene-side leaf object: follows the cursor via `update`, removed on `dispose`.
 * Pure Three.js — no React, no store subscription.
 *
 * The ghost mesh is built by the SAME SSoT path the commit uses
 * (`buildDefaultMepBoilerParams` → `computeMepBoilerGeometry` → `boilerToMesh`) and
 * reads overrides from the SAME `mepBoilerToolBridgeStore` — so the preview is
 * exactly what the click creates (WYSIWYG). A boiler keeps a fixed warm-red
 * heating-equipment colour. Translucent material + post-FX overlay + non-pickable +
 * disposal live in the shared `PlacementGhostOverlay` SSoT (ADR-537).
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
import { PlacementGhostOverlay } from './placement-ghost-overlay';

/** Warm-red heating-equipment ghost tint (matches the committed boiler material family). */
const GHOST_COLOR = 0xdc2626;

/** Layer id stamped on the throwaway ghost entity (never persisted). */
const GHOST_LAYER_ID = '__ghost-mep-boiler__';

export class MepBoilerPlacementGhost {
  private readonly overlay: PlacementGhostOverlay;
  private entity: MepBoilerEntity | null = null;

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
    this.overlay.setObject(boilerToMesh(entity, floorElevationMm, levelId));
  }

  setVisible(visible: boolean): void {
    this.overlay.setVisible(visible);
  }

  dispose(): void {
    this.overlay.dispose();
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
