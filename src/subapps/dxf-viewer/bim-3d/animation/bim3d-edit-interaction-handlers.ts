'use client';

/**
 * ADR-402 (3D Viewport BIM Element Editing) — pointer-handler bodies for the
 * GenArc-port BIM gizmo (Phase A).
 *
 * Extracted from `use-bim3d-edit-interaction` (the ctx-object pattern of
 * `grip-mouse-handlers.ts`) so the hook stays thin and each function focused
 * (Google N.7.1). Pure functions driven by an `EditInteractionCtx` the hook
 * builds once per effect.
 *
 * Drag flow (single-commit-on-release): pointerdown picks a gizmo handle and
 * starts the controller drag (OrbitControls off, pointer captured); pointermove
 * either drives the drag (gizmo follows the cursor) or updates hover + the
 * screen-constant scale; pointerup reads ONE command-ready outcome from the
 * controller and dispatches the matching view-agnostic command — `MoveEntityCommand`
 * or `RotateEntityCommand` — so the 3D scene re-syncs automatically and hosted
 * openings cascade for free (the cascade lives inside the command).
 */

import * as THREE from 'three';
import type { WallEntity } from '../../bim/types/wall-types';
import { createSceneManagerAdapter } from '../../hooks/grips/grip-commit-adapters';
import { getGlobalCommandHistory } from '../../core/commands';
import { useBim3DEditStore } from '../stores/Bim3DEditStore';
import type { BimGizmoOverlay } from '../gizmo/bim-gizmo-overlay';
// ADR-363 Φ1G.5 Slice 2h — planar move/rotate drag → collapse gizmo to move arrows.
import { isPlanarMoveType } from '../gizmo/bim-gizmo-overlay';
import type { BimGizmoController } from '../gizmo/bim-gizmo-controller';
import type { BridgeOutcome } from '../gizmo/bim-gizmo-drag-bridge';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import type { LevelsHookReturn } from '../../systems/levels/useLevels';
import { Bim3DEditLivePreview } from './bim3d-edit-live-preview';
// ADR-402 — live-preview application + scene-lookup leaves (extracted, file-size N.7.1).
import {
  applyLivePreview,
  sceneEntitiesForEdit,
  resolveEntityLevelId,
} from './bim3d-edit-live-preview-apply';
import { useBim3DEntitiesStore } from '../stores/Bim3DEntitiesStore';
// Capture helpers + buildDeps + findBimEntityWorldBox (extracted for file-size N.7.1).
import {
  captureMoveDependents,
  captureCircuitWires,
  captureConnectedPipes,
  captureIncidentFittings,
  buildDeps,
  findBimEntityWorldBox,
} from './bim3d-edit-interaction-helpers';
// ADR-408 Φ-D — endpoint shape handles: world positions of a segment's two axis ends.
import { segmentAxisEndpointsWorld } from '../converters/mep-segment-to-mesh';
// ADR-408 Φ1 — structural length handles (wall/beam): horizontal endpoint world SSoT.
import { linearEndpointHandleWorld } from '../gizmo/linear-endpoint-world';
import { resolveEntityBuilding } from '../../bim/utils/bim-floor-utils';
// ADR-404 — drag outcome → view-agnostic command (extracted for file size, N.7.1).
import { buildEditCommand } from './bim3d-edit-command-builders';
import { emitStructuralChangeAfterEdit } from './bim3d-edit-structural-emit';
// ADR-408 — Ctrl+click relocatable base point / rotation centre (snap-pick SSoT).
import { pickEntityBasePoint } from './bim3d-base-point';
// ADR-363 Φ1G.5 Slice 2h — Revit temporary dimensions while a wall is dragged.
import type { TempWallMoveDimOverlay } from '../placement/TempWallMoveDimOverlay';
// ADR-363 Φ1G.5 Slice 2i — Revit dashed alignment line + snap-type label + wall FACE offsets.
import type { TempAlignmentLineOverlay } from '../placement/TempAlignmentLineOverlay';
import type { TempSnapLabelOverlay } from '../placement/TempSnapLabelOverlay';
// ADR-363 — live move-distance readout (line base→current + distance label).
import type { TempMoveReadoutOverlay } from '../placement/TempMoveReadoutOverlay';
// ADR-535 — 3D per-vertex reshape grips (slab footprint pilot).
import type { BimGripController3D } from '../grips/bim-grip-controller-3d';
// ADR-516 — input prediction (latency compensation) for the gizmo-move drag.
import type { PointerPredictor } from '../gizmo/pointer-prediction';
import { DXF_TIMING } from '../../config/dxf-timing';
// ADR-535 Φ1/Φ2 — reshape-grip (re)seat + live preview + commit (extracted, file-size N.7.1).
import { refreshReshapeGrips, applyGripReshapePreview, commitGripReshape, resolveSlabOpeningHostSlabId } from './bim3d-grip-drag';
// ADR-535 Φ4 — per-vertex grip context menu store (right-click → delete/insert vertex).
import { useGrip3DContextMenuStore } from '../stores/Grip3DContextMenuStore';
// ADR-402 Phase B — drag-time snap callbacks (extracted, file-size N.7.1).
import { buildDragSnapFn, buildGripReshapeSnapFn } from './bim3d-edit-drag-snap';

export interface EditInteractionCtx {
  readonly manager: ThreeJsSceneManager;
  readonly canvasEl: HTMLCanvasElement;
  readonly overlay: BimGizmoOverlay;
  readonly controller: BimGizmoController;
  /** Live "entity follows the cursor" preview during a drag (ADR-402). */
  readonly preview: Bim3DEditLivePreview;
  /** ADR-363 Φ1G.5 Slice 2h — transient temp-dimensions overlay for a dragged wall. */
  readonly wallMoveDim: TempWallMoveDimOverlay;
  /** ADR-363 Φ1G.5 Slice 2i — transient dashed alignment line for face magnetism. */
  readonly alignmentLine: TempAlignmentLineOverlay;
  /** ADR-363 Φ1G.5 Slice 2i — transient snap-type label ("Παρειά τοίχου" / "Γωνία τοίχου"). */
  readonly snapLabel: TempSnapLabelOverlay;
  /** ADR-363 — transient move-distance readout (line base→current + distance label). */
  readonly moveReadout: TempMoveReadoutOverlay;
  /** ADR-363 Φ1G.5 Slice 2i — localise a snap type+description into a label (React `t` SSoT). */
  readonly resolveSnapLabel: (type?: string, description?: string) => string;
  /** ADR-535 — 3D reshape-grip interaction FSM (hover/drag, screen-space). */
  readonly gripController: BimGripController3D;
  /** ADR-516 — input prediction (latency compensation) for the gizmo-move drag. */
  readonly pointerPredictor: PointerPredictor;
  /** Latest levels context (null = read-only, ADR-371). */
  readonly getLevels: () => LevelsHookReturn | null;
}

/**
 * Re-anchor the gizmo to the union world-centre of every edited element (the
 * group centroid for multi-select). Returns false when no mesh is found.
 *
 * ADR-408 — a relocated base point (Ctrl+click, `basePointOverride`) wins over the
 * centroid: the gizmo origin (= rotation pivot + move base) sits on the picked point
 * and the ⊙ marker is shown. The box-existence guard stays, so a deleted entity still
 * hides the gizmo regardless of the override.
 */
export function computeEditAnchor(ctx: EditInteractionCtx, entityIds: readonly string[]): boolean {
  let box: THREE.Box3 | null = null;
  for (const id of entityIds) {
    const b = findBimEntityWorldBox(ctx.manager.bimLayer.group, id);
    if (!b) continue;
    if (box) box.union(b);
    else box = b;
  }
  if (!box) return false;
  const override = useBim3DEditStore.getState().basePointOverride;
  const anchor = override
    ? new THREE.Vector3(override.x, override.y, override.z)
    : box.getCenter(new THREE.Vector3());
  ctx.overlay.updatePosition(anchor);
  ctx.overlay.setBasePointMarker(override ? anchor : null);
  ctx.overlay.updateScale(ctx.manager.getCamera());
  return true;
}

/**
 * ADR-408 Φ-D/Φ1 — position the per-endpoint shape handles for a single-select
 * LINEAR element (Revit shape handles at each axis end). Cleared (null) for any
 * other selection. Two disciplines, one entry point:
 *   - `mep-segment` → free-3D pipe handles via `segmentAxisEndpointsWorld` (per-end
 *     elevation, the run may slope) — drag = κάτοψη + υψόμετρο.
 *   - `wall` / `beam` → horizontal LENGTH handles via `linearEndpointHandleWorld`
 *     (both ends share the gizmo-anchor Y; the height is a separate handle/Type).
 * Called after `computeEditAnchor` + `setActiveHandles` (and on auto-resync re-anchor),
 * so `ctx.overlay.getPosition()` already holds the world box centre.
 */
export function refreshLinearEndpointHandles(
  ctx: EditInteractionCtx,
  entityIds: readonly string[],
  bimType: string | null,
): void {
  if (entityIds.length !== 1) {
    ctx.overlay.setEndpointHandles(null, null);
    return;
  }
  if (bimType === 'mep-segment') return refreshSegmentEndpointHandles(ctx, entityIds[0]);
  if (bimType === 'wall' || bimType === 'beam') return refreshStructuralEndpointHandles(ctx, entityIds[0], bimType);
  ctx.overlay.setEndpointHandles(null, null);
}

/** MEP pipe end handles (free-3D, per-endpoint elevation — the run may slope). */
function refreshSegmentEndpointHandles(ctx: EditInteractionCtx, id: string): void {
  const s = useBim3DEntitiesStore.getState();
  const segment = s.mepSegments.find((seg) => seg.id === id);
  if (!segment) {
    ctx.overlay.setEndpointHandles(null, null);
    return;
  }
  const baseElevationM = resolveEntityBuilding(segment, s.floors, s.buildings)?.baseElevation ?? 0;
  const { startW, endW } = segmentAxisEndpointsWorld(segment.params, baseElevationM);
  ctx.overlay.setEndpointHandles(startW, endW, 'free-3d');
}

/** Wall/beam LENGTH handles (horizontal; both ends at the gizmo-anchor Y). */
function refreshStructuralEndpointHandles(ctx: EditInteractionCtx, id: string, bimType: 'wall' | 'beam'): void {
  const s = useBim3DEntitiesStore.getState();
  const worldY = ctx.overlay.getPosition().y;
  const wall = bimType === 'wall' ? s.walls.find((w) => w.id === id) : undefined;
  if (wall) {
    const { startW, endW } = linearEndpointHandleWorld(wall.params.start, wall.params.end, wall.params.sceneUnits, worldY);
    ctx.overlay.setEndpointHandles(startW, endW, 'horizontal');
    return;
  }
  const beam = bimType === 'beam' ? s.beams.find((b) => b.id === id) : undefined;
  if (beam) {
    const { startW, endW } = linearEndpointHandleWorld(beam.params.startPoint, beam.params.endPoint, beam.params.sceneUnits, worldY);
    ctx.overlay.setEndpointHandles(startW, endW, 'horizontal');
    return;
  }
  ctx.overlay.setEndpointHandles(null, null);
}

export function onEditPointerDown(ctx: EditInteractionCtx, e: PointerEvent): void {
  if (e.button !== 0 || !ctx.overlay.visible) return;
  // ADR-408 — Ctrl+click relocates the gizmo base point / rotation centre (Revit
  // «specify base point»): snap-pick a point on the selected entity, NOT a drag.
  if (e.ctrlKey && !ctx.controller.isDragging()) {
    trySetBasePoint(ctx, e);
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  // ADR-535 — try a 3D reshape grip FIRST (small, specific perimeter targets that
  // would otherwise be shadowed by the gizmo). A hit starts a grip drag (commit on
  // release) and bypasses the gizmo path entirely. Coexists with the gizmo (centre).
  if (ctx.gripController.beginDrag(ctx.manager.getCamera(), ctx.canvasEl, e.clientX, e.clientY)) {
    e.preventDefault();
    e.stopPropagation();
    ctx.manager.viewport.setControlsEnabled(false);
    // ADR-516 — a gizmo/grip drag disables OrbitControls, so the camera `isInteracting`
    // flag stays false and the scene pays the full SSAO+shadow idle-refine cost (~30-108ms)
    // EVERY frame while dragging. Signal interacting → cheap raster path (~3ms) → 1:1 follow.
    ctx.manager.setInteracting(true);
    (e.target as Element | null)?.setPointerCapture?.(e.pointerId);
    // ADR-535 Φ4 — hide the whole-entity gizmo while reshaping a vertex (Revit «Edit
    // Sketch»: the move/rotate handles step aside so they neither clutter the perimeter
    // nor catch the cursor). Restored on release / cancel.
    ctx.overlay.setVisible(false);
    // ADR-535 Φ2/Φ3 — capture the dragged entity's mesh so it reshapes LIVE per frame
    // (not just on release) + inject the snap fn so the dragged vertex magnetises to
    // scene features. Type-agnostic: slab / roof / floor-finish (ADR-535 Φ3a).
    const editState = useBim3DEditStore.getState();
    const entityId = editState.editEntityIds[0];
    if (entityId) {
      // ADR-535 Φ3b — a slab-opening is a void with only an invisible pick mesh; the
      // mesh that reshapes live is its HOST SLAB, so capture the host slab. The snap fn
      // keeps the opening id (self-exclusion). All other footprint types capture self.
      const captureId = editState.editBimType === 'slab-opening'
        ? (resolveSlabOpeningHostSlabId(entityId) ?? entityId)
        : entityId;
      ctx.preview.captureResize(ctx.manager.bimLayer.group, captureId);
      ctx.gripController.setSnapFn(buildGripReshapeSnapFn(ctx, entityId));
    }
    ctx.manager.markSceneDirty();
    return;
  }
  const started = ctx.controller.beginDrag(ctx.manager.getCamera(), ctx.canvasEl, e.clientX, e.clientY);
  if (!started) return; // missed the gizmo → leave the event for selection / orbit
  ctx.pointerPredictor.reset(); // ADR-516 — fresh velocity history for this drag.
  ctx.manager.setInteracting(true); // ADR-516 — cheap raster path while dragging (see grip branch).
  // ADR-402 Phase B — build the snap callback for this drag from the snap-engine
  // SSoT (null = OSNAP off / rotate / vertical resize → free drag).
  ctx.controller.setSnapFn(buildDragSnapFn(ctx));
  // ADR-404 Phase 2 — Shift disables the tilt angle snap (free tilt).
  ctx.controller.setShiftHeld(e.shiftKey);
  // ADR-402 — capture the edited meshes so the entity follows the cursor live.
  // Move/plan-rotate → rigid mesh transform; resize + tilt (X/Z rings, ADR-404) →
  // per-frame geometry rebuild via the converter SSoT (shear ≠ rigid transform).
  const ids = useBim3DEditStore.getState().editEntityIds;
  const constraint = ctx.controller.getActiveConstraint();
  const isTilt = constraint?.kind === 'rotate' && constraint.axis !== 'y';
  if (constraint?.kind === 'resize' || isTilt) {
    if (ids[0]) ctx.preview.captureResize(ctx.manager.bimLayer.group, ids[0]);
  } else if (constraint?.kind === 'endpoint') {
    // ADR-408 Φ-D — the dragged segment rebuilds its geometry (node move ≠ rigid
    // transform) AND its connected pipes stretch. captureResize resets then records
    // the segment; captureConnectedPipes (capturePipes) APPENDS the followers.
    if (ids[0]) ctx.preview.captureResize(ctx.manager.bimLayer.group, ids[0]);
    captureConnectedPipes(ctx, ids);
    captureIncidentFittings(ctx, ids);
  } else {
    ctx.preview.captureTransform(ctx.manager.bimLayer.group, new Set(ids));
    // ADR-401 — a MOVE of a structural host (beam/slab) must re-clip its attached
    // walls live (not plan-rotate — that follow is a documented follow-up). Capture
    // the dependents now so `applyLivePreview` can rebuild them every move frame.
    if (constraint?.kind !== 'rotate') captureMoveDependents(ctx, ids);
    // ADR-408 Φ7 P2/P2b — a wired fixture/panel re-routes its circuit conduit live on
    // BOTH move and plan-rotate (the resolver applies either gizmo transform per frame).
    captureCircuitWires(ctx, ids);
    // ADR-408 Φ-C — a fixture/manifold/pipe drags its connected pipe ends live (stretch).
    captureConnectedPipes(ctx, ids);
    // ADR-408 Φ-D/Φ-E — and the caps/elbows/tees at the moved junctions follow live.
    captureIncidentFittings(ctx, ids);
    // ADR-363 Φ1G.5 Slice 2h — Revit: a PLANAR move/rotate drag shows only the move
    // arrows (+ the temporary dimensions); hide the resize/endpoint/tilt shape handles
    // so they neither clutter nor lag while the entity follows the cursor. Restored on
    // release. Free-3D MEP keeps its handles (the active one may not be in BASE_HANDLES).
    if (isPlanarMoveType(useBim3DEditStore.getState().editBimType)) ctx.overlay.collapseToMoveHandles();
  }
  e.preventDefault();
  e.stopPropagation();
  ctx.manager.viewport.setControlsEnabled(false);
  (e.target as Element | null)?.setPointerCapture?.(e.pointerId);
}

/**
 * ADR-408 — Ctrl+click set-base-point: snap-pick a point on the selected entity and
 * relocate the gizmo origin (rotation pivot + move base) there. Misses keep the
 * current base point (no-op). Reuses the 3D snap SSoT (`pickEntityBasePoint`).
 */
function trySetBasePoint(ctx: EditInteractionCtx, e: PointerEvent): void {
  const ids = useBim3DEditStore.getState().editEntityIds;
  if (ids.length === 0) return;
  const point = pickEntityBasePoint({
    group: ctx.manager.bimLayer.group,
    camera: ctx.manager.getCamera(),
    domElement: ctx.canvasEl,
    entityIds: ids,
    clientX: e.clientX,
    clientY: e.clientY,
  });
  if (!point) return;
  useBim3DEditStore.getState().setBasePointOverride(point);
  computeEditAnchor(ctx, ids);
  ctx.manager.markSceneDirty();
}

export function onEditPointerMove(ctx: EditInteractionCtx, e: PointerEvent): void {
  // ADR-535 — a live grip drag owns the move (square follows 1:1 + snap). Φ2: rebuild the
  // slab mesh every frame so the footprint reshapes LIVE (ghost === the committed result).
  if (ctx.gripController.isDragging()) {
    const changed = ctx.gripController.updateDrag(ctx.manager.getCamera(), ctx.canvasEl, e.clientX, e.clientY);
    if (changed) {
      applyGripReshapePreview(ctx);
      e.preventDefault();
      e.stopPropagation();
      ctx.manager.markSceneDirty();
    }
    return;
  }
  if (ctx.controller.isDragging()) {
    // ADR-404 — track Shift live so the tilt snap can be toggled mid-drag.
    ctx.controller.setShiftHeld(e.shiftKey);
    // ADR-516 — input prediction (latency compensation): feed the gizmo the position the
    // cursor WILL reach in ~1 frame so the entity coincides with the 0ms OS cursor instead
    // of trailing it by the WebGL present latency. VISUAL-ONLY — pointer-up commits RAW.
    // ADR-516 — input prediction (latency compensation): feed the gizmo the position the
    // cursor WILL reach in ~1 frame so the entity coincides with the 0ms OS cursor instead
    // of trailing it by the WebGL present latency. VISUAL-ONLY — pointer-up commits RAW.
    const p = DXF_TIMING.prediction.ENABLED
      ? ctx.pointerPredictor.predict(e.clientX, e.clientY, e.timeStamp)
      : { x: e.clientX, y: e.clientY };
    const changed = ctx.controller.updateDrag(ctx.manager.getCamera(), ctx.canvasEl, p.x, p.y);
    if (changed) {
      applyLivePreview(ctx);
      e.preventDefault();
      e.stopPropagation();
      ctx.manager.markSceneDirty();
    }
    return;
  }
  // Idle hover + screen-constant scale (also keeps the gizmo sized during orbit-drag).
  if (!ctx.overlay.visible) return;
  const hoverChanged = ctx.controller.updateHover(ctx.manager.getCamera(), ctx.canvasEl, e.clientX, e.clientY);
  // ADR-535 Φ5 — grip hover highlight (screen-space). The overlay RAF redraws the grips
  // every frame from the live camera, so there is no per-grip screen-constant scale to keep.
  const gripHoverChanged = ctx.gripController.updateHover(ctx.manager.getCamera(), ctx.canvasEl, e.clientX, e.clientY);
  ctx.overlay.updateScale(ctx.manager.getCamera());
  if (hoverChanged || gripHoverChanged) ctx.manager.markSceneDirty();
}

export function onEditPointerUp(ctx: EditInteractionCtx, e: PointerEvent): void {
  // ADR-535 — finish a 3D reshape-grip drag: project the release point, commit ONE
  // UpdateSlabParamsCommand (scene re-syncs automatically), then re-seat the grips.
  if (ctx.gripController.isDragging()) {
    e.preventDefault();
    e.stopPropagation();
    ctx.canvasEl.releasePointerCapture?.(e.pointerId);
    ctx.gripController.updateDrag(ctx.manager.getCamera(), ctx.canvasEl, e.clientX, e.clientY);
    const committed = commitGripReshape(ctx, ctx.gripController.endDrag());
    // ADR-535 Φ2 — committed: the preview already shows the final footprint, so drop the
    // refs and let the command's re-sync replace the meshes (no jump). No command (no-op
    // / rejected): restore the original mesh, since no re-sync is coming.
    if (committed) ctx.preview.commit();
    else ctx.preview.reset();
    ctx.overlay.setVisible(true); // ADR-535 Φ4 — the whole-entity gizmo comes back.
    ctx.manager.viewport.setControlsEnabled(true);
    ctx.manager.setInteracting(false); // ADR-516 — drag end → one final crisp SSAO frame at rest.
    ctx.manager.markSceneDirty();
    return;
  }
  if (!ctx.controller.isDragging()) return;
  e.preventDefault();
  e.stopPropagation();
  ctx.canvasEl.releasePointerCapture?.(e.pointerId);
  ctx.controller.updateDrag(ctx.manager.getCamera(), ctx.canvasEl, e.clientX, e.clientY);
  // ADR-363 Φ1G.5 Slice 2c — the wall under the cursor at release is the reliable
  // re-host target for a dragged opening (used only by the opening move builder).
  const pickedWall = resolveWallUnderCursor(ctx, e.clientX, e.clientY);
  const committed = dispatchOutcome(ctx, ctx.controller.endDrag(), pickedWall);
  // ADR-402 — committed: the preview already shows the final pose, so just drop the
  // refs and let the command's re-sync replace the meshes (no jump). No command
  // (no-op drag): restore the originals, since no re-sync is coming.
  if (committed) ctx.preview.commit();
  else ctx.preview.reset();
  ctx.wallMoveDim.hide(); // ADR-363 Φ1G.5 Slice 2h — transient dims vanish on release.
  ctx.alignmentLine.hide(); // ADR-363 Φ1G.5 Slice 2i — dashed alignment line vanishes too.
  ctx.snapLabel.hide(); // …and the snap-type label.
  ctx.moveReadout.hide(); // ADR-363 — and the move-distance readout.
  ctx.overlay.restoreConfiguredHandles(); // …and the shape handles come back.
  ctx.manager.viewport.setControlsEnabled(true);
  ctx.manager.setInteracting(false); // ADR-516 — drag end → one final crisp SSAO frame at rest.
  ctx.manager.markSceneDirty();
}

export function onEditPointerCancel(ctx: EditInteractionCtx): void {
  // ADR-535 — abort a grip drag: snap the square back, no command. Φ2: restore the
  // original mesh (the live reshape preview is discarded). Φ4: re-show the gizmo.
  if (ctx.gripController.isDragging()) {
    ctx.gripController.cancelDrag();
    ctx.preview.reset();
    ctx.overlay.setVisible(true);
    const st = useBim3DEditStore.getState();
    refreshReshapeGrips(ctx, st.editEntityIds, st.editBimType);
    ctx.manager.viewport.setControlsEnabled(true);
    ctx.manager.setInteracting(false); // ADR-516 — drag end → one final crisp SSAO frame at rest.
    ctx.manager.markSceneDirty();
    return;
  }
  if (!ctx.controller.isDragging()) return;
  ctx.controller.cancelDrag();
  ctx.preview.reset(); // Esc / cancel → entity snaps back, no command (ADR-402).
  ctx.wallMoveDim.hide(); // ADR-363 Φ1G.5 Slice 2h — transient dims vanish on cancel.
  ctx.alignmentLine.hide(); // ADR-363 Φ1G.5 Slice 2i — dashed alignment line vanishes too.
  ctx.snapLabel.hide(); // …and the snap-type label.
  ctx.moveReadout.hide(); // ADR-363 — and the move-distance readout.
  ctx.overlay.restoreConfiguredHandles(); // …and the shape handles come back.
  ctx.manager.viewport.setControlsEnabled(true);
  ctx.manager.setInteracting(false); // ADR-516 — drag end → one final crisp SSAO frame at rest.
  ctx.manager.markSceneDirty();
}

/**
 * ADR-535 Φ4 — right-click on a 3D reshape grip opens the per-vertex context menu
 * («Διαγραφή κορυφής» on a vertex grip / «Εισαγωγή κορυφής» on an edge-midpoint grip).
 * Off any grip (or mid-drag) the native / other context menus are left untouched. The
 * grip under the cursor is resolved with the SAME raycast hit-test the hover/drag path
 * uses (`gripAt`); the React `Grip3DVertexContextMenu` leaf renders + dispatches it.
 */
export function onEditContextMenu(ctx: EditInteractionCtx, e: MouseEvent): void {
  if (ctx.gripController.isDragging()) return;
  const grip = ctx.gripController.gripAt(ctx.manager.getCamera(), ctx.canvasEl, e.clientX, e.clientY);
  if (!grip) return;
  e.preventDefault();
  e.stopPropagation();
  useGrip3DContextMenuStore.getState().show(grip, { x: e.clientX, y: e.clientY });
}

/** Wheel zoom changes camera distance → refresh the screen-constant gizmo scale. */
export function onEditWheel(ctx: EditInteractionCtx): void {
  if (!ctx.overlay.visible || ctx.controller.isDragging()) return;
  ctx.overlay.updateScale(ctx.manager.getCamera());
  // ADR-535 Φ5 — the grip overlay RAF reads the live camera each frame, so a zoom needs no
  // explicit grip rescale here (continuous zoom replaced the old event-driven stepped scale).
  ctx.manager.markSceneDirty();
}

/**
 * ADR-363 Φ1G.5 Slice 2c — the `WallEntity` under the cursor (3D raycast), or
 * undefined when the cursor is over a non-wall / empty. The reliable re-host
 * target for a dragged opening (vs the gizmo-constrained end point's proximity).
 */
function resolveWallUnderCursor(ctx: EditInteractionCtx, clientX: number, clientY: number): WallEntity | undefined {
  const hit = ctx.manager.raycastBimEntities(clientX, clientY);
  if (!hit || hit.bimType !== 'wall') return undefined;
  return useBim3DEntitiesStore.getState().walls.find((w) => w.id === hit.bimId);
}

/**
 * Dispatch ONE view-agnostic command from the drag outcome (one undo step).
 * Returns true when a command actually executed (the caller keeps the live preview
 * and lets the re-sync replace the meshes; false → it restores the originals).
 * ADR-402 Phase C — move/rotate apply to the whole multi-selection; the adapter
 * resolves the primary element's level (same-floor multi is the common case —
 * cross-floor multi falls back to the active level, see ADR-402 limitations).
 */
function dispatchOutcome(ctx: EditInteractionCtx, outcome: BridgeOutcome, pickedWall?: WallEntity): boolean {
  if (outcome.kind === 'none') return false;
  const edit = useBim3DEditStore.getState();
  const levels = ctx.getLevels();
  const entityIds = edit.editEntityIds;
  const entityId = entityIds[0];
  if (!levels || !entityId) return false;
  const levelId = resolveEntityLevelId(levels, entityId) ?? levels.currentLevelId;
  if (!levelId) return false;
  const sm = createSceneManagerAdapter(buildDeps(levels, levelId));
  if (!sm) return false;
  const cmd = buildEditCommand(outcome, { entityIds, entityId, edit, sm, levels, levelId, pickedWall });
  if (!cmd) return false;
  // `validate` is optional on ICommand (CompoundCommand has none — it validates each
  // child at execute time and rolls back on failure). Only block on a real error.
  if ('validate' in cmd && cmd.validate() !== null) return false;
  // ADR-408 — a relocated base point is CONSUMED by any non-rotate transform (Revit
  // «specify base point» is per-command); rotate keeps the invariant pivot. Clear
  // BEFORE execute so the entity-resync re-anchors the gizmo on the centroid.
  if (outcome.kind !== 'rotate') useBim3DEditStore.getState().setBasePointOverride(null);
  getGlobalCommandHistory().execute(cmd);
  // ADR-459 Φ7 — announce the edit as a structural-change event (mirror the 2D grip
  // commit layer) so the auto-foundation designer / organism / persistence react. Must
  // run AFTER execute so the edited command is the last on the stack when the coalesced
  // reactor microtask groups the derived footing update into the same atomic undo step.
  emitStructuralChangeAfterEdit(cmd, entityIds, sm);
  useBim3DEditStore.getState().setTargetLevel(levelId);
  return true;
}

