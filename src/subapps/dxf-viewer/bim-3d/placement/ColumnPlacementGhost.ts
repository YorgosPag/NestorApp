'use client';

/**
 * ColumnPlacementGhost — translucent 3D preview of the column about to be placed.
 *
 * ADR-403 (3D BIM Element Placement). Scene-side leaf object (the BimGizmoOverlay
 * pattern, ADR-402): follows the cursor via `update`, removed on `dispose`. Pure
 * Three.js — no React, no store subscription (the hook drives it).
 *
 * The ghost mesh is built by the SAME SSoT builders the commit path uses
 * (`buildDefaultColumnParams` → `computeColumnGeometry` → `columnToMesh`) and
 * reads kind/anchor/overrides from the SAME `columnToolBridgeStore` the ribbon
 * drives — so the preview is exactly what the click will create (WYSIWYG). The
 * translucent material + post-FX overlay registration + non-pickable + disposal
 * live in the shared `PlacementGhostOverlay` SSoT (ADR-537) — no mustard, no dup.
 */

import * as THREE from 'three';
import type { Point2D } from '../../rendering/types/Types';
import type { ColumnEntity } from '../../bim/types/column-types';
import {
  buildColumnEntity,
  buildDefaultColumnParams,
  type ColumnParamOverrides,
} from '../../hooks/drawing/column-completion';
import { computeColumnGeometry } from '../../bim/geometry/column-geometry';
import { columnToMesh } from '../converters/BimToThreeConverter';
import { columnToolBridgeStore } from '../../ui/ribbon/hooks/bridge/column-tool-bridge-store';
import { PlacementGhostOverlay } from './placement-ghost-overlay';

/** Layer id stamped on the throwaway ghost entity (never persisted). */
const GHOST_LAYER_ID = '__ghost-column__';

export class ColumnPlacementGhost {
  private readonly overlay: PlacementGhostOverlay;
  /** Retained so its enterprise id/IFC fields stay stable across cursor moves. */
  private entity: ColumnEntity | null = null;

  constructor(scene: THREE.Scene) {
    this.overlay = new PlacementGhostOverlay(scene, 0x3b82f6, 0.45);
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
    // ADR-449 — columnToMesh επιστρέφει Group όταν υπάρχει σοβάς· το ghost δεν
    // περνά walls/finish → πάντα απλό Mesh. Guard για το union type.
    const mesh = columnToMesh(entity, floorElevationMm, levelId, 0);
    this.overlay.setObject(mesh instanceof THREE.Mesh ? mesh : null);
  }

  setVisible(visible: boolean): void {
    this.overlay.setVisible(visible);
  }

  dispose(): void {
    this.overlay.dispose();
  }

  // ── internals ──────────────────────────────────────────────────────────────

  /**
   * Build the throwaway ghost entity from the bridge store's kind/anchor/
   * overrides. First call validates + assigns an id (one createColumn); later
   * calls reuse that id and only swap params + geometry (no id churn).
   */
  private buildGhostEntity(scenePoint: Readonly<Point2D>): ColumnEntity | null {
    const handle = columnToolBridgeStore.get();
    const units = handle?.getSceneUnits() ?? 'mm';
    const overrides: ColumnParamOverrides = handle
      ? { ...handle.overrides, kind: handle.kind, anchor: handle.anchor }
      : {};
    const params = buildDefaultColumnParams(scenePoint, handle?.kind, overrides, units);
    const geometry = computeColumnGeometry(params);
    if (this.entity) return { ...this.entity, params, geometry };
    const result = buildColumnEntity(params, GHOST_LAYER_ID, units);
    return result.ok ? result.entity : null;
  }
}
