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
import type { GizmoHandleId, GizmoEndpoint } from './gizmo-types';
import {
  AXIS_COLORS, PLANE_COLORS, RESIZE_IDLE_COLORS, GIZMO_COLOR_CENTER, GIZMO_COLOR_HOVER,
  GIZMO_SCREEN_SCALE, GIZMO_RENDER_ORDER,
  SNAP_MARKER_COLOR, SNAP_MARKER_RADIUS, SNAP_MARKER_SCREEN_SCALE, SNAP_MARKER_RENDER_ORDER,
} from './gizmo-constants';

/**
 * Move/rotate handles active for every selected entity.
 * ADR-402 — `axis-y` (green, world-up) is the VERTICAL move arrow: dragging it
 * changes the element's elevation (per-type field, see `bim3d-vertical-move`).
 * `axis-x`/`axis-z` are the horizontal (plan) move arrows; `plane-xz` the plan
 * drag; `rotate-y` the plan rotation.
 */
const BASE_HANDLES: readonly GizmoHandleId[] = [
  // 'center' (orange free-move pyramid) hidden per Giorgio — to test behaviour without it.
  'axis-x', 'axis-y', 'axis-z', 'plane-xz', 'rotate-y',
];

/**
 * ADR-402 Phase B — extra resize handles shown per entity type (world-axis
 * aligned; the per-type grip math projects onto the entity's local frame, so both
 * plan handles are offered and the perpendicular one drives the dimension). The
 * mapping per type (Revit-standard, see `bim3d-resize-bridge`):
 *   - column → X width, Z depth, Y-top height + Y-base offset (ADR-401 F.3 — same
 *              top/base octahedra as the wall)
 *   - wall   → X/Z thickness, Y-top height + Y-base offset (ADR-401 E.3 — the top
 *              octahedron edits HEIGHT, the base octahedron below it edits the base
 *              offset; length stays an endpoint-grip edit)
 *   - beam   → X/Z width,     Y depth  (length stays an endpoint-grip edit)
 *   - slab   → Y thickness only (footprint is edited per-vertex in 2D)
 */
const RESIZE_HANDLES_BY_TYPE: Readonly<Record<string, readonly GizmoHandleId[]>> = {
  // `resize-m-y` = the second (base) vertical grip below the centroid (top + base).
  column: ['resize-x', 'resize-z', 'resize-y', 'resize-m-y'],
  wall: ['resize-x', 'resize-z', 'resize-y', 'resize-m-y'],
  beam: ['resize-x', 'resize-z', 'resize-y'],
  slab: ['resize-y'],
  // ADR-402 Sub-Phase 1 — stair: plan handles (perp → width, axial → run/stepCount).
  // ADR-401 Phase G.3 — + vertical top/base octahedra: dragging re-steps to the new
  // height (Revit «Desired number of risers») and detaches the side if attached.
  stair: ['resize-x', 'resize-z', 'resize-y', 'resize-m-y'],
};

/**
 * ADR-404 Phase 2 — X/Z rotate rings shown per entity type so the user can TILT
 * (rake a column, batter a wall, ramp a beam, slope a slab). Both X and Z rings are
 * offered; the drag bridge maps each to the type's tilt DOF and treats a roll ring
 * (axis along the element) as a no-op. A stair has NO tilt (its incline is parametric
 * via run/stepCount — Revit-correct), so it is absent here. Single-select only: a
 * multi-selection reports `editBimType = null` → no tilt rings (mirror resize).
 */
const TILT_HANDLES_BY_TYPE: Readonly<Record<string, readonly GizmoHandleId[]>> = {
  column: ['rotate-x', 'rotate-z'],
  wall: ['rotate-x', 'rotate-z'],
  beam: ['rotate-x', 'rotate-z'],
  slab: ['rotate-x', 'rotate-z'],
};

/**
 * ADR-408 Φ-D — per-endpoint shape handles shown per entity type. A linear MEP
 * segment exposes a draggable square at each axis end (drag ONE end → the pipe
 * stretches from there, the other end stays). Single-select only (the hook passes
 * `editBimType = null` for a multi-selection → no endpoint handles, mirror resize).
 */
const ENDPOINT_HANDLES_BY_TYPE: Readonly<Record<string, readonly GizmoHandleId[]>> = {
  'mep-segment': ['endpoint-start', 'endpoint-end'],
};

/** Active handle id set for a selected entity: base move/rotate + any resize + tilt + endpoint. */
export function activeHandlesFor(bimType: string | null): ReadonlySet<GizmoHandleId> {
  const ids = new Set<GizmoHandleId>(BASE_HANDLES);
  const resize = (bimType && RESIZE_HANDLES_BY_TYPE[bimType]) || [];
  for (const id of resize) ids.add(id);
  const tilt = (bimType && TILT_HANDLES_BY_TYPE[bimType]) || [];
  for (const id of tilt) ids.add(id);
  const endpoints = (bimType && ENDPOINT_HANDLES_BY_TYPE[bimType]) || [];
  for (const id of endpoints) ids.add(id);
  return ids;
}

export class BimGizmoOverlay {
  private readonly scene: THREE.Scene;
  private readonly meshSet: GizmoMeshSet;
  private readonly position = new THREE.Vector3();
  private activeHitboxes: THREE.Mesh[] = [];
  private hovered: GizmoHandleId | null = null;
  private disposed = false;
  /** ADR-402 Phase B — drag snap marker (square frame, depth-test off → always visible). */
  private readonly snapMarker: THREE.LineSegments;
  /**
   * ADR-408 Φ-D — world positions of the two endpoint handles (null = not a linear
   * segment selection). The handles live in root-local space but must sit on the
   * ABSOLUTE pipe ends, so we re-derive their local offset (`(world − anchor) /
   * rootScale`) on every position/scale refresh — keeping them world-locked at a
   * screen-constant size.
   */
  private endpointWorld: { start: THREE.Vector3; end: THREE.Vector3 } | null = null;
  /** Cached visual + hitbox of each endpoint handle (repositioned together). */
  private readonly endpointParts: ReadonlyMap<GizmoEndpoint, { visual: THREE.Object3D; hitbox: THREE.Object3D }>;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.meshSet = createGizmoMeshes();
    this.meshSet.root.renderOrder = GIZMO_RENDER_ORDER;
    this.meshSet.root.visible = false;
    this.endpointParts = this.resolveEndpointParts();

    // Start with the move/rotate base; the hook reconfigures per selected type.
    this.applyActiveHandles(new Set(BASE_HANDLES));
    this.scene.add(this.meshSet.root);

    this.snapMarker = createSnapMarker();
    this.scene.add(this.snapMarker);
  }

  /** Cache the visual + hitbox object of each endpoint handle (built once). */
  private resolveEndpointParts(): Map<GizmoEndpoint, { visual: THREE.Object3D; hitbox: THREE.Object3D }> {
    const parts = new Map<GizmoEndpoint, { visual: THREE.Object3D; hitbox: THREE.Object3D }>();
    for (const endpoint of ['start', 'end'] as const) {
      const id: GizmoHandleId = `endpoint-${endpoint}`;
      const visual = this.meshSet.visuals.get(id);
      let hitbox: THREE.Mesh | undefined;
      for (const hb of this.meshSet.hitboxes) {
        if (this.meshSet.hitboxToId.get(hb) === id) { hitbox = hb; break; }
      }
      if (visual && hitbox) parts.set(endpoint, { visual, hitbox });
    }
    return parts;
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
    if (!visible) this.hideSnapMarker();
  }

  /**
   * Show the drag snap marker at a world point (ADR-402 Phase B), sized
   * screen-constant like the gizmo so it stays a fixed pixel size during zoom.
   */
  showSnapMarker(world: THREE.Vector3, camera: THREE.Camera): void {
    if (this.disposed) return;
    this.snapMarker.position.copy(world);
    let s = SNAP_MARKER_RADIUS;
    if (camera instanceof THREE.PerspectiveCamera) {
      const dist = camera.position.distanceTo(world);
      s = dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * SNAP_MARKER_SCREEN_SCALE;
    }
    this.snapMarker.scale.setScalar(Math.max(s, 1e-3));
    this.snapMarker.visible = true;
    this.snapMarker.updateMatrixWorld(true);
  }

  /** Hide the drag snap marker. */
  hideSnapMarker(): void {
    if (this.disposed) return;
    this.snapMarker.visible = false;
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
    this.refreshEndpointOffsets();
    this.meshSet.root.updateMatrixWorld(true);
  }

  /**
   * ADR-408 Φ-D — set (or clear) the world positions of the two endpoint handles
   * for a linear-segment selection. Pass `null` to clear (non-segment / multi-select).
   */
  setEndpointHandles(start: THREE.Vector3 | null, end: THREE.Vector3 | null): void {
    if (this.disposed) return;
    this.endpointWorld = start && end ? { start: start.clone(), end: end.clone() } : null;
    this.refreshEndpointOffsets();
    this.meshSet.root.updateMatrixWorld(true);
  }

  /**
   * ADR-408 Φ-D — live-follow ONE endpoint handle to a new world position during a
   * drag (the dragged end follows the cursor; the fixed end stays). No-op when the
   * endpoint set has been cleared.
   */
  setDraggedEndpoint(endpoint: GizmoEndpoint, world: THREE.Vector3): void {
    if (this.disposed || !this.endpointWorld) return;
    this.endpointWorld[endpoint].copy(world);
    this.refreshEndpointOffsets();
    this.meshSet.root.updateMatrixWorld(true);
  }

  /**
   * Reposition the endpoint handle children to `(world − anchor) / rootScale` so
   * they render on the ABSOLUTE pipe ends regardless of the screen-constant root
   * scale. Visual + hitbox move together. No-op when no endpoint set is active.
   */
  private refreshEndpointOffsets(): void {
    if (!this.endpointWorld) return;
    const s = this.meshSet.root.scale.x || 1;
    for (const endpoint of ['start', 'end'] as const) {
      const part = this.endpointParts.get(endpoint);
      if (!part) continue;
      const local = this.endpointWorld[endpoint].clone().sub(this.position).divideScalar(s);
      part.visual.position.copy(local);
      part.hitbox.position.copy(local);
    }
  }

  getPosition(): THREE.Vector3 {
    return this.position.clone();
  }

  /** ADR-408 Φ-D — world position of an endpoint handle, or null when not a segment selection. */
  getEndpointWorld(endpoint: GizmoEndpoint): THREE.Vector3 | null {
    return this.endpointWorld ? this.endpointWorld[endpoint].clone() : null;
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
    this.refreshEndpointOffsets();
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
    this.scene.remove(this.snapMarker);
    this.snapMarker.geometry.dispose();
    (this.snapMarker.material as THREE.Material).dispose();
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

/**
 * Build the drag snap marker — a small cube wireframe (reads as a square frame
 * from any orbit angle, mirroring the 2D endpoint square). Depth-test off + high
 * render order so it stays visible through geometry. Unit half-extent (box side 2)
 * so `scale.setScalar(s)` gives a half-extent of `s` metres.
 */
function createSnapMarker(): THREE.LineSegments {
  const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(2, 2, 2));
  const material = new THREE.LineBasicMaterial({
    color: SNAP_MARKER_COLOR,
    depthTest: false,
    transparent: true,
  });
  const marker = new THREE.LineSegments(edges, material);
  marker.renderOrder = SNAP_MARKER_RENDER_ORDER;
  marker.visible = false;
  return marker;
}

/** Idle colour for a handle id (restored when hover leaves). */
function defaultColorOf(id: GizmoHandleId): number {
  if (id === 'center') return GIZMO_COLOR_CENTER;
  // ADR-408 Φ-D — endpoint squares share the resize-X idle colour (Revit blue-ish grip).
  if (id.startsWith('endpoint-')) return RESIZE_IDLE_COLORS['x'] ?? GIZMO_COLOR_CENTER;
  if (id.startsWith('resize-m-')) return RESIZE_IDLE_COLORS[id.slice(9)] ?? GIZMO_COLOR_CENTER;
  if (id.startsWith('resize-')) return RESIZE_IDLE_COLORS[id.slice(7)] ?? GIZMO_COLOR_CENTER;
  if (id.startsWith('rotate-')) return AXIS_COLORS[id.slice(7)] ?? GIZMO_COLOR_CENTER;
  if (id.startsWith('axis-')) return AXIS_COLORS[id.slice(5)] ?? GIZMO_COLOR_CENTER;
  if (id.startsWith('plane-')) return PLANE_COLORS[id.slice(6)] ?? GIZMO_COLOR_CENTER;
  return GIZMO_COLOR_CENTER;
}
