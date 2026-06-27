'use client';

/**
 * MepManifoldPlacementGhost — translucent 3D preview of the manifold about to
 * be placed. ADR-408 Φ12, mirror of `ElectricalPanelPlacementGhost`. Scene-side
 * leaf object: follows the cursor via `update`, removed on `dispose`. Pure
 * Three.js — no React, no store subscription.
 *
 * The ghost mesh is built by the SAME SSoT path the commit uses
 * (`buildDefaultMepManifoldParams` → `computeMepManifoldGeometry` →
 * `manifoldToMesh`) and reads overrides from the SAME `mepManifoldToolBridgeStore`
 * — so the preview is exactly what the click creates (WYSIWYG). Translucent
 * material + post-FX overlay + non-pickable + disposal live in the shared
 * `PlacementGhostOverlay` SSoT (ADR-537).
 */

import * as THREE from 'three';
import type { Point2D } from '../../rendering/types/Types';
import type { MepManifoldEntity } from '../../bim/types/mep-manifold-types';
import {
  buildMepManifoldEntity,
  buildDefaultMepManifoldParams,
  type MepManifoldParamOverrides,
} from '../../hooks/drawing/mep-manifold-completion';
import { computeMepManifoldGeometry } from '../../bim/mep-manifolds/mep-manifold-geometry';
import { resolveManifoldPalette } from '../../bim/mep-manifolds/mep-manifold-symbol';
import { manifoldToMesh } from '../converters/BimToThreeConverter';
import { mepManifoldToolBridgeStore } from '../../ui/ribbon/hooks/bridge/mep-manifold-tool-bridge-store';
import { PlacementGhostOverlay } from './placement-ghost-overlay';

/** Layer id stamped on the throwaway ghost entity (never persisted). */
const GHOST_LAYER_ID = '__ghost-mep-manifold__';

export class MepManifoldPlacementGhost {
  private readonly overlay: PlacementGhostOverlay;
  private entity: MepManifoldEntity | null = null;

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
    // ADR-408 Φ14 — recolour the ghost to match the committed equipment (water =
    // cyan-teal, drainage collector = brown) via the shared palette SSoT.
    this.overlay.setColor(resolveManifoldPalette(entity.params.kind).strokeHex);
    this.overlay.setObject(manifoldToMesh(entity, floorElevationMm, levelId));
  }

  setVisible(visible: boolean): void {
    this.overlay.setVisible(visible);
  }

  dispose(): void {
    this.overlay.dispose();
  }

  private buildGhostEntity(scenePoint: Readonly<Point2D>): MepManifoldEntity | null {
    const handle = mepManifoldToolBridgeStore.get();
    const units = handle?.getSceneUnits() ?? 'mm';
    const overrides: MepManifoldParamOverrides = handle ? { ...handle.overrides } : {};
    const params = buildDefaultMepManifoldParams(scenePoint, overrides, units);
    const geometry = computeMepManifoldGeometry(params);
    if (this.entity) return { ...this.entity, params, geometry };
    const result = buildMepManifoldEntity(params, GHOST_LAYER_ID);
    return result.ok ? result.entity : null;
  }
}
