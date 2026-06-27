'use client';

/**
 * MepFixturePlacementGhost — translucent 3D preview of the fixture about to be
 * placed. ADR-406, mirror of `ColumnPlacementGhost` (ADR-403). Scene-side leaf
 * object: follows the cursor via `update`, removed on `dispose`. Pure Three.js —
 * no React, no store subscription.
 *
 * The ghost mesh is built by the SAME SSoT path the commit uses
 * (`buildDefaultMepFixtureParams` → `computeMepFixtureGeometry` → `fixtureToMesh`)
 * and reads shape/overrides from the SAME `mepFixtureToolBridgeStore` — so the
 * preview is exactly what the click creates (WYSIWYG). The translucent material +
 * post-FX overlay registration + non-pickable + disposal live in the shared
 * `PlacementGhostOverlay` SSoT (ADR-537) — no mustard, no duplicate.
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
import { PlacementGhostOverlay } from './placement-ghost-overlay';

/** Layer id stamped on the throwaway ghost entity (never persisted). */
const GHOST_LAYER_ID = '__ghost-mep-fixture__';

export class MepFixturePlacementGhost {
  private readonly overlay: PlacementGhostOverlay;
  private entity: MepFixtureEntity | null = null;

  constructor(scene: THREE.Scene) {
    this.overlay = new PlacementGhostOverlay(scene, 0xf59e0b, 0.45);
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
    this.overlay.setObject(fixtureToMesh(entity, floorElevationMm, levelId));
  }

  setVisible(visible: boolean): void {
    this.overlay.setVisible(visible);
  }

  dispose(): void {
    this.overlay.dispose();
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
