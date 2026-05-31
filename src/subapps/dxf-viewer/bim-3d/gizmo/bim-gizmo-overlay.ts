'use client';

/**
 * bim-gizmo-overlay.ts — scene-side wrapper around the ported gizmo mesh set.
 *
 * ADR-402 (3D Viewport BIM Element Editing) — GenArc gizmo port (Phase A).
 *
 * Owns the `GizmoMeshSet` (added to the live 3D scene), the auto-on-selection
 * anchor (entity world centre), the screen-constant scale (`dist·tan(fov/2)·0.45`,
 * so the gizmo keeps a fixed pixel size during zoom/orbit), and hover highlight.
 *
 * Phase A visibility: only the handles that map cleanly onto our 2D commands are
 * shown — move axis X/Z + plane XZ + center/free + rotate-Y. Vertical-axis move,
 * planes involving world Y, resize handles and the X/Z rotation rings are hidden
 * (resize → Phase B; X/Z rings have no 2D plan-rotation equivalent).
 *
 * Pure Three.js — no React, no store subscription (ADR-040: orchestrators never
 * subscribe; this is a leaf renderer driven by the interaction hook).
 */

import * as THREE from 'three';
import { createGizmoMeshes, type GizmoMeshSet } from './gizmo-geometry';
import type { GizmoHitTestSet } from './gizmo-hit-test';
import type { GizmoHandleId } from './gizmo-types';
import {
  AXIS_COLORS, PLANE_COLORS, RESIZE_IDLE_COLORS, GIZMO_COLOR_CENTER, GIZMO_COLOR_HOVER,
  GIZMO_SCREEN_SCALE, GIZMO_RENDER_ORDER,
} from './gizmo-constants';

/** Move/rotate handles wired in Phase A — active for every selected entity. */
const BASE_HANDLES: readonly GizmoHandleId[] = [
  'axis-x', 'axis-z', 'plane-xz', 'center', 'rotate-y',
];

/**
 * ADR-402 Phase B — extra resize handles shown per entity type (world-axis
 * aligned; the per-type grip math projects onto the entity's local frame). Columns
 * resize width (X) + depth (Z); wall/beam/slab land in a later Phase B slice.
 */
const RESIZE_HANDLES_BY_TYPE: Readonly<Record<string, readonly GizmoHandleId[]>> = {
  column: ['resize-x', 'resize-z'],
};

/** Active handle id set for a selected entity: base move/rotate + any resize handles. */
export function activeHandlesFor(bimType: string | null): ReadonlySet<GizmoHandleId> {
  const ids = new Set<GizmoHandleId>(BASE_HANDLES);
  const resize = (bimType && RESIZE_HANDLES_BY_TYPE[bimType]) || [];
  for (const id of resize) ids.add(id);
  return ids;
}

export class BimGizmoOverlay {
  private readonly scene: THREE.Scene;
  private readonly meshSet: GizmoMeshSet;
  private readonly position = new THREE.Vector3();
  private activeHitboxes: THREE.Mesh[] = [];
  private hovered: GizmoHandleId | null = null;
  private disposed = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.meshSet = createGizmoMeshes();
    this.meshSet.root.renderOrder = GIZMO_RENDER_ORDER;
    this.meshSet.root.visible = false;

    // Start with the move/rotate base; the hook reconfigures per selected type.
    this.applyActiveHandles(new Set(BASE_HANDLES));
    this.scene.add(this.meshSet.root);
  }

  get visible(): boolean {
    return !this.disposed && this.meshSet.root.visible;
  }

  /** View passed to `testGizmoHit` — only active (Phase A) hitboxes. */
  get hitTestView(): GizmoHitTestSet {
    return { hitboxes: this.activeHitboxes, hitboxToId: this.meshSet.hitboxToId };
  }

  setVisible(visible: boolean): void {
    if (this.disposed) return;
    this.meshSet.root.visible = visible;
  }

  /**
   * Reconfigure which handles are visible + hittable for the selected entity
   * (ADR-402 Phase B — resize handles per entity type). Clears any stale hover.
   */
  setActiveHandles(ids: ReadonlySet<GizmoHandleId>): void {
    if (this.disposed) return;
    if (this.hovered && !ids.has(this.hovered)) this.setHoverHandle(null);
    this.applyActiveHandles(ids);
  }

  /** Move the gizmo to a world-space anchor (entity bbox centre). */
  updatePosition(world: THREE.Vector3): void {
    if (this.disposed) return;
    this.position.copy(world);
    this.meshSet.root.position.copy(world);
    this.meshSet.root.updateMatrixWorld(true);
  }

  getPosition(): THREE.Vector3 {
    return this.position.clone();
  }

  /** Screen-constant scale so the gizmo keeps a fixed pixel size during zoom/orbit. */
  updateScale(camera: THREE.Camera): void {
    if (this.disposed) return;
    let s = 1;
    if (camera instanceof THREE.PerspectiveCamera) {
      const dist = camera.position.distanceTo(this.position);
      s = dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * GIZMO_SCREEN_SCALE;
    }
    this.meshSet.root.scale.setScalar(Math.max(s, 1e-3));
    this.meshSet.root.updateMatrixWorld(true);
  }

  /**
   * Highlight the hovered handle (gold); restore the previously hovered one.
   * Returns true when the hovered handle actually changed (caller redraws).
   */
  setHoverHandle(id: GizmoHandleId | null): boolean {
    if (this.disposed || id === this.hovered) return false;
    if (this.hovered) this.paintHandle(this.hovered, defaultColorOf(this.hovered));
    if (id) this.paintHandle(id, GIZMO_COLOR_HOVER);
    this.hovered = id;
    return true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.remove(this.meshSet.root);
    this.meshSet.dispose();
  }

  // ── internals ──────────────────────────────────────────────────────────────

  /** Apply a handle-id set: toggle visual visibility + rebuild the active hitboxes. */
  private applyActiveHandles(ids: ReadonlySet<GizmoHandleId>): void {
    // A visual can be shared by several handle ids — e.g. `resize-x` and its mirror
    // `resize-m-x` map to the SAME octahedron. It must stay visible when ANY of its
    // ids is active. A per-id `visible = ids.has(id)` assignment lets a later
    // inactive id overwrite an earlier active one to false (Map insertion order),
    // which hid every resize handle in Phase B. So: hide all, then reveal each
    // visual referenced by an active id.
    for (const visual of this.meshSet.visuals.values()) visual.visible = false;
    for (const id of ids) {
      const visual = this.meshSet.visuals.get(id);
      if (visual) visual.visible = true;
    }
    this.activeHitboxes = this.meshSet.hitboxes.filter((hb) => {
      const id = this.meshSet.hitboxToId.get(hb);
      return id !== undefined && ids.has(id);
    });
  }

  private paintHandle(id: GizmoHandleId, color: number): void {
    const visual = this.meshSet.visuals.get(id);
    if (!visual) return;
    visual.traverse((obj) => {
      const mat = (obj as THREE.Mesh).material;
      if (mat instanceof THREE.MeshBasicMaterial || mat instanceof THREE.LineBasicMaterial) {
        mat.color.setHex(color);
      }
    });
  }
}

/** Idle colour for a handle id (restored when hover leaves). */
function defaultColorOf(id: GizmoHandleId): number {
  if (id === 'center') return GIZMO_COLOR_CENTER;
  if (id.startsWith('resize-m-')) return RESIZE_IDLE_COLORS[id.slice(9)] ?? GIZMO_COLOR_CENTER;
  if (id.startsWith('resize-')) return RESIZE_IDLE_COLORS[id.slice(7)] ?? GIZMO_COLOR_CENTER;
  if (id.startsWith('rotate-')) return AXIS_COLORS[id.slice(7)] ?? GIZMO_COLOR_CENTER;
  if (id.startsWith('axis-')) return AXIS_COLORS[id.slice(5)] ?? GIZMO_COLOR_CENTER;
  if (id.startsWith('plane-')) return PLANE_COLORS[id.slice(6)] ?? GIZMO_COLOR_CENTER;
  return GIZMO_COLOR_CENTER;
}
