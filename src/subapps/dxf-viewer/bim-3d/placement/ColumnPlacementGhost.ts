'use client';

/**
 * ColumnPlacementGhost — translucent 3D preview of the column about to be placed.
 *
 * ADR-403 (3D BIM Element Placement). Scene-side leaf object (the BimGizmoOverlay
 * pattern, ADR-402): added to the live scene in the constructor, follows the
 * cursor via `update`, removed on `dispose`. Pure Three.js — no React, no store
 * subscription (the hook drives it).
 *
 * The ghost mesh is built by the SAME SSoT builders the commit path uses
 * (`buildDefaultColumnParams` → `computeColumnGeometry` → `columnToMesh`) and
 * reads kind/anchor/overrides from the SAME `columnToolBridgeStore` the ribbon
 * drives — so the preview is exactly what the click will create (WYSIWYG). Only
 * the material is swapped for a translucent one; the mesh is made non-pickable so
 * it never intercepts hover/selection raycasts.
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

/** Layer id stamped on the throwaway ghost entity (never persisted). */
const GHOST_LAYER_ID = '__ghost-column__';

export class ColumnPlacementGhost {
  private readonly scene: THREE.Scene;
  private readonly material: THREE.MeshStandardMaterial;
  private mesh: THREE.Mesh | null = null;
  /** Retained so its enterprise id/IFC fields stay stable across cursor moves. */
  private entity: ColumnEntity | null = null;
  private disposed = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.material = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      roughness: 0.6,
      metalness: 0.0,
    });
  }

  /** Rebuild the ghost at `scenePoint` (active scene units) on the active floor. */
  update(scenePoint: Readonly<Point2D>, floorElevationMm: number, levelId: string | undefined): void {
    if (this.disposed) return;
    const entity = this.buildGhostEntity(scenePoint);
    if (!entity) {
      this.setVisible(false);
      return;
    }
    this.entity = entity;
    this.removeMesh();
    // ADR-449 — columnToMesh επιστρέφει Group όταν υπάρχει σοβάς· το ghost δεν
    // περνά walls/finish → πάντα απλό Mesh. Guard για το union type.
    const mesh = columnToMesh(entity, floorElevationMm, levelId, 0);
    if (!mesh || !(mesh instanceof THREE.Mesh)) return;
    mesh.material = this.material;
    // Non-pickable: the ghost must not intercept hover/selection object raycasts.
    mesh.userData = {};
    mesh.raycast = () => {};
    this.mesh = mesh;
    this.scene.add(mesh);
  }

  setVisible(visible: boolean): void {
    if (this.mesh) this.mesh.visible = visible;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.removeMesh();
    this.material.dispose();
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private removeMesh(): void {
    if (!this.mesh) return;
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh = null;
  }

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
