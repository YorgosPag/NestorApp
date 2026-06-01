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
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { Entity } from '../../types/entities';
import { computeDxfEntityGrips } from '../../hooks/grip-computation';
import { getGlobalSnapEngine } from '../../snapping/global-snap-engine';
import { worldToDxfPlan } from '../viewport/coordinate-transforms';
import { makeMoveSnapFn, makeResizeSnapFn, type SnapFn } from '../gizmo/bim3d-snap-bridge';
import { createSceneManagerAdapter } from '../../hooks/grips/grip-commit-adapters';
import type { DxfCommitDeps } from '../../hooks/grips/unified-grip-types';
import { getGlobalCommandHistory } from '../../core/commands';
import { useBim3DEditStore } from '../stores/Bim3DEditStore';
import type { BimGizmoOverlay } from '../gizmo/bim-gizmo-overlay';
import type { BimGizmoController } from '../gizmo/bim-gizmo-controller';
import type { BridgeOutcome } from '../gizmo/bim-gizmo-drag-bridge';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import type { LevelsHookReturn } from '../../systems/levels/useLevels';
import { Bim3DEditLivePreview } from './bim3d-edit-live-preview';
import { buildResizePreviewObject, buildTiltPreviewObject } from './bim3d-preview-rebuild';
// ADR-404 — drag outcome → view-agnostic command (extracted for file size, N.7.1).
import { buildEditCommand } from './bim3d-edit-command-builders';

export interface EditInteractionCtx {
  readonly manager: ThreeJsSceneManager;
  readonly canvasEl: HTMLCanvasElement;
  readonly overlay: BimGizmoOverlay;
  readonly controller: BimGizmoController;
  /** Live "entity follows the cursor" preview during a drag (ADR-402). */
  readonly preview: Bim3DEditLivePreview;
  /** Latest levels context (null = read-only, ADR-371). */
  readonly getLevels: () => LevelsHookReturn | null;
}

/**
 * Re-anchor the gizmo to the union world-centre of every edited element (the
 * group centroid for multi-select). Returns false when no mesh is found.
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
  const centre = new THREE.Vector3();
  box.getCenter(centre);
  ctx.overlay.updatePosition(centre);
  ctx.overlay.updateScale(ctx.manager.getCamera());
  return true;
}

export function onEditPointerDown(ctx: EditInteractionCtx, e: PointerEvent): void {
  if (e.button !== 0 || !ctx.overlay.visible) return;
  const started = ctx.controller.beginDrag(ctx.manager.getCamera(), ctx.canvasEl, e.clientX, e.clientY);
  if (!started) return; // missed the gizmo → leave the event for selection / orbit
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
  } else {
    ctx.preview.captureTransform(ctx.manager.bimLayer.group, new Set(ids));
  }
  e.preventDefault();
  e.stopPropagation();
  ctx.manager.viewport.setControlsEnabled(false);
  (e.target as Element | null)?.setPointerCapture?.(e.pointerId);
}

/**
 * Build the drag snap callback (ADR-402 Phase B). Reuses the ONE snap engine
 * (`getGlobalSnapEngine`) — no new snap logic. Move reuses the element's
 * characteristic points (grips, the 2D SSoT) as plan-mm offsets from the gizmo
 * anchor so ANY corner/endpoint may grab a target (AutoCAD-style); horizontal
 * resize snaps the dragged handle. Returns null (free drag) for rotate, vertical
 * resize, OSNAP-off, or an unresolved target.
 */
function buildDragSnapFn(ctx: EditInteractionCtx): SnapFn | null {
  const constraint = ctx.controller.getActiveConstraint();
  if (!constraint || constraint.kind === 'rotate') return null;
  if (constraint.kind === 'resize' && constraint.axis === 'y') return null;
  // ADR-402 — vertical (axis-Y) move is a pure elevation drag; plan snapping is moot.
  if (constraint.kind === 'axis' && constraint.axis === 'y') return null;
  const engine = getGlobalSnapEngine();
  if (!engine.getSettings().enabled) return null;
  const targets = resolveEditEntities(ctx);
  if (targets.length === 0) return null;
  // Resize is single-entity only (multi-select hides resize handles).
  if (constraint.kind === 'resize') return makeResizeSnapFn(engine, targets[0].entityId);
  // move (axis / plane / free): characteristic points of EVERY selected element as
  // plan-mm offsets from the group anchor (ADR-402 Phase C — snap from all, nearest-wins).
  const anchorPlan = worldToDxfPlan(ctx.overlay.getPosition());
  const offsets = targets.flatMap((t) =>
    computeDxfEntityGrips(t.entity as unknown as DxfEntityUnion).map((g) => ({
      x: g.position.x - anchorPlan.x,
      y: g.position.y - anchorPlan.y,
    })),
  );
  return makeMoveSnapFn(engine, offsets, targets[0].entityId);
}

/**
 * Resolve every active edit entity + id (snap-source grips / self-exclusion).
 * Single-element selection returns one; multi-select returns all. [0] = primary.
 */
function resolveEditEntities(ctx: EditInteractionCtx): { entity: Entity; entityId: string }[] {
  const levels = ctx.getLevels();
  const ids = useBim3DEditStore.getState().editEntityIds;
  if (!levels || ids.length === 0) return [];
  const out: { entity: Entity; entityId: string }[] = [];
  for (const entityId of ids) {
    const levelId = resolveEntityLevelId(levels, entityId) ?? levels.currentLevelId;
    if (!levelId) continue;
    const entity = levels.getLevelScene(levelId)?.entities?.find((en) => en.id === entityId);
    if (entity) out.push({ entity, entityId });
  }
  return out;
}

export function onEditPointerMove(ctx: EditInteractionCtx, e: PointerEvent): void {
  if (ctx.controller.isDragging()) {
    // ADR-404 — track Shift live so the tilt snap can be toggled mid-drag.
    ctx.controller.setShiftHeld(e.shiftKey);
    const changed = ctx.controller.updateDrag(ctx.manager.getCamera(), ctx.canvasEl, e.clientX, e.clientY);
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
  ctx.overlay.updateScale(ctx.manager.getCamera());
  if (hoverChanged) ctx.manager.markSceneDirty();
}

export function onEditPointerUp(ctx: EditInteractionCtx, e: PointerEvent): void {
  if (!ctx.controller.isDragging()) return;
  e.preventDefault();
  e.stopPropagation();
  ctx.canvasEl.releasePointerCapture?.(e.pointerId);
  ctx.controller.updateDrag(ctx.manager.getCamera(), ctx.canvasEl, e.clientX, e.clientY);
  const committed = dispatchOutcome(ctx, ctx.controller.endDrag());
  // ADR-402 — committed: the preview already shows the final pose, so just drop the
  // refs and let the command's re-sync replace the meshes (no jump). No command
  // (no-op drag): restore the originals, since no re-sync is coming.
  if (committed) ctx.preview.commit();
  else ctx.preview.reset();
  ctx.manager.viewport.setControlsEnabled(true);
  ctx.manager.markSceneDirty();
}

export function onEditPointerCancel(ctx: EditInteractionCtx): void {
  if (!ctx.controller.isDragging()) return;
  ctx.controller.cancelDrag();
  ctx.preview.reset(); // Esc / cancel → entity snaps back, no command (ADR-402).
  ctx.manager.viewport.setControlsEnabled(true);
  ctx.manager.markSceneDirty();
}

/**
 * Drive the live "entity follows the cursor" preview from the controller's live
 * drag snapshot (ADR-402): rigid mesh transform for move/rotate, per-frame geometry
 * rebuild (converter SSoT) for resize. Runs every changed pointermove frame.
 */
function applyLivePreview(ctx: EditInteractionCtx): void {
  const live = ctx.controller.getLivePreview();
  if (!live) return;
  if (live.kind === 'move') {
    // Mirror the command's keyboard axis lock so the preview matches the commit:
    // 'X' keeps world-X (DXF x) → drop world-Z; 'Z' keeps world-Z (DXF y) → drop
    // world-X. The vertical (world-Y) component is untouched (axis-Y elevation move).
    const lock = useBim3DEditStore.getState().axisLock;
    const t = live.translation.clone();
    if (lock === 'X') t.z = 0;
    else if (lock === 'Z') t.x = 0;
    ctx.preview.applyMove(t);
    return;
  }
  if (live.kind === 'rotate') {
    ctx.preview.applyRotate(live.pivot, live.angleRad);
    return;
  }
  if (live.kind === 'tilt') {
    // ADR-404 — tilt rebuilds the single entity via the converter SSoT (shear),
    // swapped in through the same hide-and-replace path as resize. Skip a roll ring
    // (X/Z axis = no-op for the type) → `buildTiltPreviewObject` returns null.
    if (live.axis === 'y') return; // defensive: Y ring is plan rotate, not tilt
    const tiltId = useBim3DEditStore.getState().editEntityIds[0];
    if (!tiltId) return;
    ctx.preview.applyResize(buildTiltPreviewObject(tiltId, { axis: live.axis, angleDeg: live.angleDeg }));
    return;
  }
  // resize — rebuild the single dragged entity's geometry via the converter SSoT.
  const id = useBim3DEditStore.getState().editEntityIds[0];
  if (!id) return;
  ctx.preview.applyResize(
    buildResizePreviewObject(id, {
      axis: live.outcome.axis,
      mode: live.outcome.mode,
      deltaMm: live.outcome.deltaMm,
      deltaUpMm: live.outcome.deltaUpMm,
      cursorMm: live.outcome.cursorMm,
    }),
  );
}

/** Wheel zoom changes camera distance → refresh the screen-constant gizmo scale. */
export function onEditWheel(ctx: EditInteractionCtx): void {
  if (!ctx.overlay.visible || ctx.controller.isDragging()) return;
  ctx.overlay.updateScale(ctx.manager.getCamera());
  ctx.manager.markSceneDirty();
}

/**
 * Dispatch ONE view-agnostic command from the drag outcome (one undo step).
 * Returns true when a command actually executed (the caller keeps the live preview
 * and lets the re-sync replace the meshes; false → it restores the originals).
 * ADR-402 Phase C — move/rotate apply to the whole multi-selection; the adapter
 * resolves the primary element's level (same-floor multi is the common case —
 * cross-floor multi falls back to the active level, see ADR-402 limitations).
 */
function dispatchOutcome(ctx: EditInteractionCtx, outcome: BridgeOutcome): boolean {
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
  const cmd = buildEditCommand(outcome, { entityIds, entityId, edit, sm, levels, levelId });
  if (!cmd) return false;
  // `validate` is optional on ICommand (CompoundCommand has none — it validates each
  // child at execute time and rolls back on failure). Only block on a real error.
  if ('validate' in cmd && cmd.validate() !== null) return false;
  getGlobalCommandHistory().execute(cmd);
  useBim3DEditStore.getState().setTargetLevel(levelId);
  return true;
}

/** Adapter deps for the target level — the adapter only reads currentLevelId/get/set. */
function buildDeps(levels: LevelsHookReturn, levelId: string): DxfCommitDeps {
  return {
    currentLevelId: levelId,
    getLevelScene: levels.getLevelScene,
    setLevelScene: levels.setLevelScene,
    execute: () => {},
    moveEntities: () => {},
    onToolChange: () => {},
  };
}

/** Union world-space bounding box over every mesh tagged with `bimId`. */
function findBimEntityWorldBox(group: THREE.Object3D, bimId: string): THREE.Box3 | null {
  let box: THREE.Box3 | null = null;
  group.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    if ((obj.userData['bimId'] as string | undefined) !== bimId) return;
    const b = new THREE.Box3().setFromObject(obj);
    if (b.isEmpty()) return;
    if (box) box.union(b);
    else box = b;
  });
  return box;
}

/** Which level's scene contains `entityId` (multi-floor edge case). */
function resolveEntityLevelId(levels: LevelsHookReturn, entityId: string): string | null {
  for (const lvl of levels.levels) {
    const scene = levels.getLevelScene(lvl.id);
    if (scene?.entities?.some((e) => e.id === entityId)) return lvl.id;
  }
  return null;
}
