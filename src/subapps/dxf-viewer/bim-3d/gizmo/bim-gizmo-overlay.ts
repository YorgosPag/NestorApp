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
import type { GizmoHandleId, GizmoEndpoint, GizmoEndpointMode } from './gizmo-types';
import {
  GIZMO_COLOR_HOVER, GIZMO_SCREEN_SCALE, GIZMO_RENDER_ORDER,
  SNAP_MARKER_RADIUS, SNAP_MARKER_SCREEN_SCALE, SNAP_MARKER_MOVE_SCREEN_SCALE,
  BASE_POINT_MARKER_RADIUS, BASE_POINT_MARKER_SCREEN_SCALE,
} from './gizmo-constants';
import {
  createSnapMarker, createBasePointMarker, disposeBasePointMarker, defaultColorOf,
} from './bim-gizmo-overlay-markers';

/**
 * Move/rotate handles active for every selected entity.
 * ADR-402 — `axis-y` (green, world-up) is the VERTICAL move arrow: dragging it
 * changes the element's elevation (per-type field, see `bim3d-vertical-move`).
 * `axis-x`/`axis-z` are the horizontal (plan) move arrows; `plane-xz` the plan
 * drag; `rotate-y` the plan rotation.
 */
/**
 * Move/rotate handles active for EVERY selected entity (the planar baseline).
 * ADR-402/408 Φ-E — Revit DOF model: structural + non-MEP elements move in PLAN
 * only (2-axis): the two horizontal arrows (`axis-x`/`axis-z`), the horizontal plane
 * drag (`plane-xz`) and the plan rotation ring (`rotate-y`). Their vertical position
 * is a constraint/offset edited via the contextual tab — NOT a free 3D drag — so the
 * vertical move arrow (`axis-y`) and the vertical plane handles are NOT in the base.
 * (`center` orange free-move pyramid hidden per Giorgio.)
 */
const BASE_HANDLES: readonly GizmoHandleId[] = [
  'axis-x', 'axis-z', 'plane-xz', 'rotate-y',
];

/**
 * ADR-408 Φ-E — handles that turn a selection into a FULL 3D move: the vertical move
 * arrow (`axis-y`) + the two vertical plane drags (`plane-xy`, `plane-yz`). Added only
 * for the `FREE_3D_MOVE_TYPES` below.
 */
const FREE_3D_MOVE_HANDLES: readonly GizmoHandleId[] = ['axis-y', 'plane-xy', 'plane-yz'];

/**
 * ADR-408 Φ-E — entity types that move freely in ALL THREE axes (Revit: ducts/pipes +
 * mechanical equipment placed at an arbitrary elevation). Everything else is planar
 * (2-axis). Multi-select (`editBimType = null`) → planar (mirror resize/tilt).
 */
const FREE_3D_MOVE_TYPES: ReadonlySet<string> = new Set([
  'mep-segment', 'mep-fixture', 'mep-manifold', 'mep-radiator', 'mep-boiler', 'mep-water-heater',
]);

/**
 * ADR-402 Phase B / ADR-408 Φ1 — extra resize handles shown per entity type. The
 * mapping is Revit-FAITHFUL: a shape handle edits ONLY a "stretch" (length/height);
 * cross-section thickness/width/depth is NEVER a drag — it is a Type parameter
 * (contextual ribbon). So the structural plan-section handles (`resize-x`/`resize-z`
 * = wall/column thickness, beam width) and the slab thickness handle were REMOVED
 * (ADR-408 Φ1, «πιστή αντιγραφή Revit»):
 *   - column → Y-top height + Y-base offset ONLY (ADR-401 F.3 top/base octahedra).
 *              Width/depth (X/Z) → Type. Length n/a (a column is a point in plan).
 *   - wall   → Y-top height + Y-base offset ONLY (ADR-401 E.3). Thickness (X/Z) →
 *              Type. LENGTH → the endpoint shape handles (`ENDPOINT_HANDLES_BY_TYPE`).
 *   - beam   → NO resize handle. LENGTH → endpoint handles; width/depth → Type;
 *              top elevation → the vertical move arrow.
 *   - slab   → NO resize handle. Thickness → Type; footprint → 2D per-vertex sketch.
 */
const RESIZE_HANDLES_BY_TYPE: Readonly<Record<string, readonly GizmoHandleId[]>> = {
  // `resize-m-y` = the second (base) vertical grip below the centroid (top + base).
  column: ['resize-y', 'resize-m-y'],
  wall: ['resize-y', 'resize-m-y'],
  // ADR-402 Sub-Phase 1 — stair: plan handles (perp → width, axial → run/stepCount).
  // ADR-401 Phase G.3 — + vertical top/base octahedra: dragging re-steps to the new
  // height (Revit «Desired number of risers») and detaches the side if attached.
  // Unchanged by ADR-408 Φ1 (a stair's incline IS its parametric run, not a section).
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
 * ADR-408 Φ-D/Φ1 — per-endpoint shape handles shown per entity type. A linear element
 * exposes a draggable handle at each axis end (drag ONE end → it stretches from there,
 * the other end stays). Single-select only (the hook passes `editBimType = null` for a
 * multi-selection → no endpoint handles, mirror resize).
 *   - `mep-segment` → Revit pipe shape handles (free-3D drag: κάτοψη + υψόμετρο).
 *   - `wall` / `beam` → Revit LENGTH shape handles (horizontal drag: το μήκος είναι plan
 *     dimension· το ύψος είναι ξεχωριστή λαβή/Τύπος).
 */
const ENDPOINT_HANDLES_BY_TYPE: Readonly<Record<string, readonly GizmoHandleId[]>> = {
  'mep-segment': ['endpoint-start', 'endpoint-end'],
  wall: ['endpoint-start', 'endpoint-end'],
  beam: ['endpoint-start', 'endpoint-end'],
};

/** Active handle id set for a selected entity: base move/rotate + 3D move + resize + tilt + endpoint. */
export function activeHandlesFor(bimType: string | null): ReadonlySet<GizmoHandleId> {
  const ids = new Set<GizmoHandleId>(BASE_HANDLES);
  // ADR-408 Φ-E — full 3D move (vertical arrow + vertical planes) only for free-3D types.
  if (bimType && FREE_3D_MOVE_TYPES.has(bimType)) for (const id of FREE_3D_MOVE_HANDLES) ids.add(id);
  const resize = (bimType && RESIZE_HANDLES_BY_TYPE[bimType]) || [];
  for (const id of resize) ids.add(id);
  const tilt = (bimType && TILT_HANDLES_BY_TYPE[bimType]) || [];
  for (const id of tilt) ids.add(id);
  const endpoints = (bimType && ENDPOINT_HANDLES_BY_TYPE[bimType]) || [];
  for (const id of endpoints) ids.add(id);
  return ids;
}

/**
 * ADR-363 Φ1G.5 Slice 2h — a PLANAR (non-free-3D) single selection whose move handles
 * are all in `BASE_HANDLES`. Such a drag can safely collapse the gizmo to the move
 * arrows (hiding resize/endpoint/tilt clutter, Revit-style) without ever hiding the
 * handle being dragged. Free-3D MEP types keep their handles (their active handle may
 * be `axis-y`/`plane-xy`/`plane-yz`, which are NOT in the base).
 */
export function isPlanarMoveType(bimType: string | null): boolean {
  return bimType !== null && !FREE_3D_MOVE_TYPES.has(bimType);
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
   * ADR-408 — relocatable base-point / rotation-centre marker (camera-facing ⊙) +
   * its world anchor (null = hidden). Sized screen-constant in `updateScale`.
   */
  private readonly basePointMarker: THREE.Group;
  private basePointWorld: THREE.Vector3 | null = null;
  /**
   * ADR-408 Φ-D — world positions of the two endpoint handles (null = not a linear
   * segment selection). The handles live in root-local space but must sit on the
   * ABSOLUTE pipe ends, so we re-derive their local offset (`(world − anchor) /
   * rootScale`) on every position/scale refresh — keeping them world-locked at a
   * screen-constant size.
   */
  private endpointWorld: { start: THREE.Vector3; end: THREE.Vector3 } | null = null;
  /**
   * ADR-408 Φ1 — projection mode of the active endpoint handles (`'free-3d'` for the
   * MEP pipe, `'horizontal'` for wall/beam length). The controller reads it at drag
   * start to build the right endpoint constraint. Defaults to `'free-3d'` (σωλήνας).
   */
  private endpointMode: GizmoEndpointMode = 'free-3d';
  /** Cached visual + hitbox of each endpoint handle (repositioned together). */
  private readonly endpointParts: ReadonlyMap<GizmoEndpoint, { visual: THREE.Object3D; hitbox: THREE.Object3D }>;
  /**
   * ADR-363 Φ1G.5 Slice 2h — the full handle set configured for the current selection
   * (set in `setActiveHandles`). `collapseToMoveHandles` temporarily narrows to the move
   * arrows during a drag; `restoreConfiguredHandles` re-applies this on release.
   */
  private configuredHandles: ReadonlySet<GizmoHandleId> = new Set(BASE_HANDLES);
  /**
   * ADR-363 Φ1G.5 Slice 2h-fix — hide the cyan snap-marker «cube» while collapsed to
   * move handles (a planar wall/structural move drag). Giorgio: even shrunk it reads as
   * a distracting box at the gizmo origin. The έλξη still works (the wall snaps); the
   * proper Revit feedback (dashed alignment lines, Slice 2i) replaces the glyph. Reset
   * on release.
   *
   * ADR-363 Φ1G.5 Slice 2i — the marker is no longer hidden during a planar move; it is
   * shown SMALL (Revit face-snap square). `snapMarkerScaleOverride` carries the reduced
   * screen scale for the collapsed move drag (null = full size).
   */
  private snapMarkerScaleOverride: number | null = null;

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

    this.basePointMarker = createBasePointMarker();
    this.scene.add(this.basePointMarker);
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
    // ADR-363 Φ1G.5 Slice 2i — during a collapsed planar move the marker is shown SMALL
    // (Revit face-snap square), not hidden: the user must SEE where the face landed.
    const screenScale = this.snapMarkerScaleOverride ?? SNAP_MARKER_SCREEN_SCALE;
    this.snapMarker.position.copy(world);
    let s = SNAP_MARKER_RADIUS;
    if (camera instanceof THREE.PerspectiveCamera) {
      const dist = camera.position.distanceTo(world);
      s = dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * screenScale;
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
   * ADR-408 — show (or hide, with null) the relocated base-point / rotation-centre
   * marker at a world point. Only records the anchor + visibility; the screen-constant
   * size + camera billboard are applied in `updateScale` (called right after).
   */
  setBasePointMarker(world: THREE.Vector3 | null): void {
    if (this.disposed) return;
    this.basePointWorld = world ? world.clone() : null;
    this.basePointMarker.visible = world !== null;
    if (world) {
      this.basePointMarker.position.copy(world);
      this.basePointMarker.updateMatrixWorld(true);
    }
  }

  /**
   * Reconfigure which handles are visible + hittable for the selected entity
   * (ADR-402 Phase B — resize handles per entity type). Clears any stale hover.
   */
  setActiveHandles(ids: ReadonlySet<GizmoHandleId>): void {
    if (this.disposed) return;
    if (this.hovered && !ids.has(this.hovered)) this.setHoverHandle(null);
    this.configuredHandles = ids;
    this.applyActiveHandles(ids);
  }

  /**
   * ADR-363 Φ1G.5 Slice 2h — during a PLANAR move/rotate drag show ONLY the move arrows
   * + plan-rotate ring (Revit): hide the resize/endpoint/tilt shape handles so they do
   * not clutter or lag while the wall follows the cursor. The active handle is always in
   * `BASE_HANDLES` for a planar type, so it never disappears. Restore with
   * `restoreConfiguredHandles` on release.
   */
  collapseToMoveHandles(): void {
    if (this.disposed) return;
    this.applyActiveHandles(new Set(BASE_HANDLES));
    // ADR-363 Φ1G.5 Slice 2i — small Revit face-snap glyph for the move drag (was: full hide).
    this.snapMarkerScaleOverride = SNAP_MARKER_MOVE_SCREEN_SCALE;
    this.hideSnapMarker(); // clear any stale marker; the next snap re-shows it small.
  }

  /** ADR-363 Φ1G.5 Slice 2h — re-apply the selection's full handle set after a drag. */
  restoreConfiguredHandles(): void {
    if (this.disposed) return;
    this.snapMarkerScaleOverride = null;
    this.applyActiveHandles(this.configuredHandles);
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
   * ADR-408 Φ-D/Φ1 — set (or clear) the world positions of the two endpoint handles
   * for a linear selection, plus their drag projection `mode` (`'free-3d'` σωλήνας vs
   * `'horizontal'` τοίχος/δοκός). Pass `null` to clear (non-linear / multi-select).
   */
  setEndpointHandles(
    start: THREE.Vector3 | null,
    end: THREE.Vector3 | null,
    mode: GizmoEndpointMode = 'free-3d',
  ): void {
    if (this.disposed) return;
    this.endpointWorld = start && end ? { start: start.clone(), end: end.clone() } : null;
    this.endpointMode = mode;
    this.refreshEndpointOffsets();
    this.meshSet.root.updateMatrixWorld(true);
  }

  /** ADR-408 Φ1 — projection mode of the active endpoint handles (controller reads at drag start). */
  getEndpointMode(): GizmoEndpointMode {
    return this.endpointMode;
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
    this.billboardEndpointRings(camera);
    this.meshSet.root.updateMatrixWorld(true);
    this.refreshBasePointMarker(camera);
  }

  /**
   * ADR-408 — keep the base-point marker screen-constant + camera-facing (the circle
   * stays a circle from any orbit). No-op when the marker is hidden.
   */
  private refreshBasePointMarker(camera: THREE.Camera): void {
    if (this.disposed || !this.basePointWorld) return;
    let s = BASE_POINT_MARKER_RADIUS;
    if (camera instanceof THREE.PerspectiveCamera) {
      const dist = camera.position.distanceTo(this.basePointWorld);
      s = dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * BASE_POINT_MARKER_SCREEN_SCALE;
    }
    this.basePointMarker.scale.setScalar(Math.max(s, 1e-3));
    this.basePointMarker.quaternion.copy(camera.quaternion);
    this.basePointMarker.position.copy(this.basePointWorld);
    this.basePointMarker.updateMatrixWorld(true);
  }

  /**
   * ADR-408 Φ-D — orient the endpoint ring(s) to face the camera so they stay a full
   * circle from any orbit angle (a fixed-plane ring would vanish edge-on). The root
   * carries no rotation (only position + uniform scale), so copying the camera's world
   * quaternion onto each ring child aligns the torus normal (+Z) with the view direction.
   */
  private billboardEndpointRings(camera: THREE.Camera): void {
    for (const part of this.endpointParts.values()) part.visual.quaternion.copy(camera.quaternion);
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
    this.scene.remove(this.basePointMarker);
    disposeBasePointMarker(this.basePointMarker);
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
