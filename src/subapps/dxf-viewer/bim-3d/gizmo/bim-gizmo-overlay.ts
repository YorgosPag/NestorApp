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
  SNAP_MARKER_SCREEN_SCALE, SNAP_MARKER_MOVE_SCREEN_SCALE,
  BASE_POINT_MARKER_RADIUS, BASE_POINT_MARKER_SCREEN_SCALE,
} from './gizmo-constants';
// ADR-378 §Step 5 — screen-constant marker scaling is the shared SSoT (reused by placement).
import { snapMarkerScreenScale } from '../shared/snap-marker-core';
import {
  createSnapMarker, createBasePointMarker, disposeBasePointMarker, defaultColorOf,
} from './bim-gizmo-overlay-markers';
import { registerPostFxOverlay } from '../scene/post-fx-overlay-pass';
// ADR-402/408 — per-type handle-set tables + resolvers (split out for the 500-line budget, N.7.1).
import { BASE_HANDLES, activeHandlesFor, isPlanarMoveType } from './bim-gizmo-overlay-handles';

// Re-export the pure handle resolvers so existing importers keep their `bim-gizmo-overlay` path.
export { activeHandlesFor, isPlanarMoveType };

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
  /**
   * ADR-537 post-FX overlay — the gizmo is a translucent UI manipulator: rendered inside the lit
   * scene it gets AO/tone-shaded at idle (axes turn "mustard"). It is instead drawn by the dedicated
   * post-FX overlay pass (`post-fx-overlay-pass.ts`). Its scene objects are kept `visible=false` so
   * the MAIN render skips them; these flags carry the real SHOWN state and the registered provider
   * returns the currently-shown roots for the pass to draw (always-on-top, AO-immune).
   */
  private active = false;
  private snapShown = false;
  private basePointShown = false;
  private readonly unregisterOverlay: () => void;

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
    this.snapMarker.visible = false; // ADR-537 — shown via the post-FX pass, not the main render.
    this.scene.add(this.snapMarker);

    this.basePointMarker = createBasePointMarker();
    this.basePointMarker.visible = false; // ADR-537 — shown via the post-FX pass.
    this.scene.add(this.basePointMarker);

    // ADR-537 — register the SHOWN gizmo roots with the post-FX overlay pass (drawn after SSAO).
    this.unregisterOverlay = registerPostFxOverlay(scene, () => this.collectOverlayRoots());
  }

  /** ADR-537 — the gizmo roots currently shown (provider for the post-FX overlay pass). */
  private collectOverlayRoots(): THREE.Object3D[] {
    if (this.disposed) return [];
    const roots: THREE.Object3D[] = [];
    if (this.active) roots.push(this.meshSet.root);
    if (this.snapShown) roots.push(this.snapMarker);
    if (this.basePointShown) roots.push(this.basePointMarker);
    return roots;
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
    // ADR-537 — `active` is the real shown-state (root.visible is kept false so the main render
    // skips it; the post-FX overlay pass flips it on only for its own draw).
    return !this.disposed && this.active;
  }

  /** View passed to `testGizmoHit` — only active (Phase A) hitboxes. */
  get hitTestView(): GizmoHitTestSet {
    return { hitboxes: this.activeHitboxes, hitboxToId: this.meshSet.hitboxToId };
  }

  setVisible(visible: boolean): void {
    if (this.disposed) return;
    // ADR-537 — toggle the SHOWN flag, NOT root.visible (kept false so the main render skips it;
    // the post-FX overlay pass draws it). hide the snap marker when the gizmo goes away.
    this.active = visible;
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
    this.snapMarker.scale.setScalar(snapMarkerScreenScale(world, camera, screenScale));
    this.snapShown = true; // ADR-537 — shown via the post-FX overlay pass (root.visible stays false).
    this.snapMarker.updateMatrixWorld(true);
  }

  /** Hide the drag snap marker. */
  hideSnapMarker(): void {
    if (this.disposed) return;
    this.snapShown = false; // ADR-537 — post-FX overlay shown-flag.
  }

  /**
   * ADR-408 — show (or hide, with null) the relocated base-point / rotation-centre
   * marker at a world point. Only records the anchor + visibility; the screen-constant
   * size + camera billboard are applied in `updateScale` (called right after).
   */
  setBasePointMarker(world: THREE.Vector3 | null): void {
    if (this.disposed) return;
    this.basePointWorld = world ? world.clone() : null;
    this.basePointShown = world !== null; // ADR-537 — post-FX overlay shown-flag (root.visible stays false).
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
    this.unregisterOverlay(); // ADR-537 — stop the post-FX overlay pass from drawing this gizmo.
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
