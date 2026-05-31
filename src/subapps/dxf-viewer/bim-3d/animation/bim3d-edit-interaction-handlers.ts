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
import type { Point2D } from '../../rendering/types/Types';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { Entity } from '../../types/entities';
import { computeDxfEntityGrips } from '../../hooks/grip-computation';
import { getGlobalSnapEngine } from '../../snapping/global-snap-engine';
import { worldToDxfPlan } from '../viewport/coordinate-transforms';
import { mmToEntityUnitFactor } from '../utils/bim3d-edit-math';
import { makeMoveSnapFn, makeResizeSnapFn, type SnapFn } from '../gizmo/bim3d-snap-bridge';
import { createSceneManagerAdapter } from '../../hooks/grips/grip-commit-adapters';
import type { DxfCommitDeps } from '../../hooks/grips/unified-grip-types';
import { getGlobalCommandHistory } from '../../core/commands';
import { MoveEntityCommand, MoveMultipleEntitiesCommand } from '../../core/commands/entity-commands/MoveEntityCommand';
import { RotateEntityCommand } from '../../core/commands/entity-commands/RotateEntityCommand';
import { UpdateColumnParamsCommand } from '../../core/commands/entity-commands/UpdateColumnParamsCommand';
import { UpdateWallParamsCommand } from '../../core/commands/entity-commands/UpdateWallParamsCommand';
import { UpdateBeamParamsCommand } from '../../core/commands/entity-commands/UpdateBeamParamsCommand';
import { UpdateSlabParamsCommand } from '../../core/commands/entity-commands/UpdateSlabParamsCommand';
import { UpdateStairParamsCommand } from '../../core/commands/entity-commands/UpdateStairParamsCommand';
import { useBim3DEditStore } from '../stores/Bim3DEditStore';
import {
  computeColumnResizeParams,
  computeWallResizeParams,
  computeBeamResizeParams,
  computeSlabResizeParams,
  computeStairResizeParams,
  type ResizeDragMm,
} from '../gizmo/bim3d-resize-bridge';
import type { BimGizmoOverlay } from '../gizmo/bim-gizmo-overlay';
import type { BimGizmoController } from '../gizmo/bim-gizmo-controller';
import type { BridgeOutcome } from '../gizmo/bim-gizmo-drag-bridge';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import type { LevelsHookReturn } from '../../systems/levels/useLevels';

/** Commands the gizmo can dispatch from a drag outcome (one undo step each). */
type EditCommand =
  | MoveEntityCommand
  | MoveMultipleEntitiesCommand
  | RotateEntityCommand
  | UpdateColumnParamsCommand
  | UpdateWallParamsCommand
  | UpdateBeamParamsCommand
  | UpdateSlabParamsCommand
  | UpdateStairParamsCommand;
type SceneManager = NonNullable<ReturnType<typeof createSceneManagerAdapter>>;
type ResizeOutcome = Extract<BridgeOutcome, { kind: 'resize' }>;

export interface EditInteractionCtx {
  readonly manager: ThreeJsSceneManager;
  readonly canvasEl: HTMLCanvasElement;
  readonly overlay: BimGizmoOverlay;
  readonly controller: BimGizmoController;
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
    const changed = ctx.controller.updateDrag(ctx.manager.getCamera(), ctx.canvasEl, e.clientX, e.clientY);
    if (changed) {
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
  dispatchOutcome(ctx, ctx.controller.endDrag());
  ctx.manager.viewport.setControlsEnabled(true);
  ctx.manager.markSceneDirty();
}

export function onEditPointerCancel(ctx: EditInteractionCtx): void {
  if (!ctx.controller.isDragging()) return;
  ctx.controller.cancelDrag();
  ctx.manager.viewport.setControlsEnabled(true);
  ctx.manager.markSceneDirty();
}

/** Wheel zoom changes camera distance → refresh the screen-constant gizmo scale. */
export function onEditWheel(ctx: EditInteractionCtx): void {
  if (!ctx.overlay.visible || ctx.controller.isDragging()) return;
  ctx.overlay.updateScale(ctx.manager.getCamera());
  ctx.manager.markSceneDirty();
}

/** Inputs shared by every command builder for the active edit target. */
interface CommandBuildCtx {
  /** All edited ids ([0] = primary). Resize uses the primary; move/rotate use all. */
  readonly entityIds: string[];
  readonly entityId: string;
  readonly edit: ReturnType<typeof useBim3DEditStore.getState>;
  readonly sm: SceneManager;
  readonly levels: LevelsHookReturn;
  readonly levelId: string;
}

/**
 * Dispatch ONE view-agnostic command from the drag outcome (one undo step).
 * ADR-402 Phase C — move/rotate apply to the whole multi-selection; the adapter
 * resolves the primary element's level (same-floor multi is the common case —
 * cross-floor multi falls back to the active level, see ADR-402 limitations).
 */
function dispatchOutcome(ctx: EditInteractionCtx, outcome: BridgeOutcome): void {
  if (outcome.kind === 'none') return;
  const edit = useBim3DEditStore.getState();
  const levels = ctx.getLevels();
  const entityIds = edit.editEntityIds;
  const entityId = entityIds[0];
  if (!levels || !entityId) return;
  const levelId = resolveEntityLevelId(levels, entityId) ?? levels.currentLevelId;
  if (!levelId) return;
  const sm = createSceneManagerAdapter(buildDeps(levels, levelId));
  if (!sm) return;
  const cmd = buildEditCommand(outcome, { entityIds, entityId, edit, sm, levels, levelId });
  if (!cmd || cmd.validate() !== null) return;
  getGlobalCommandHistory().execute(cmd);
  useBim3DEditStore.getState().setTargetLevel(levelId);
}

/** Map a drag outcome to its view-agnostic command (null = no-op / unsupported type). */
function buildEditCommand(outcome: BridgeOutcome, c: CommandBuildCtx): EditCommand | null {
  if (outcome.kind === 'move') {
    const masked = maskByAxisLock(outcome.deltaDxf, c.edit.axisLock);
    if (c.entityIds.length > 1) {
      // Multi-select move keeps the mm delta (wall/column/beam/slab are raw mm). A
      // stair in a non-mm drawing inside a mixed selection is a known limitation —
      // one batch delta cannot honour two unit systems (ADR-402).
      return new MoveMultipleEntitiesCommand([...c.entityIds], masked, c.sm, false);
    }
    // ADR-402: convert the mm gizmo delta into the entity's native units (1 for the
    // mm-based types, the stair drawing-unit factor for stairs) so the shared
    // `moveStair` SSoT relocates the stair by the right distance.
    const entity = c.levels.getLevelScene(c.levelId)?.entities?.find((e) => e.id === c.entityId);
    const f = entity ? mmToEntityUnitFactor(entity) : 1;
    const delta = f === 1 ? masked : { x: masked.x * f, y: masked.y * f };
    return new MoveEntityCommand(c.entityId, delta, c.sm, false);
  }
  if (outcome.kind === 'rotate') {
    // ADR-402: the pivot is mm (worldToDxfPlan); a single stair stores its
    // geometry in drawing units, so scale the pivot into the stair's units
    // (same factor as move) — otherwise it orbits around an mm-scaled point.
    // Multi-select keeps the mm pivot (mm-types are the common case; a stair in a
    // mixed batch is the documented unit limitation).
    let pivot = outcome.pivotDxf;
    if (c.entityIds.length === 1) {
      const entity = c.levels.getLevelScene(c.levelId)?.entities?.find((e) => e.id === c.entityId);
      const f = entity ? mmToEntityUnitFactor(entity) : 1;
      if (f !== 1) pivot = { x: pivot.x * f, y: pivot.y * f };
    }
    return new RotateEntityCommand([...c.entityIds], pivot, outcome.angleDeg, c.sm, false);
  }
  // Resize is single-entity only (multi-select hides the resize handles).
  if (outcome.kind === 'resize') return c.entityIds.length === 1 ? buildResizeCommand(outcome, c) : null;
  return null;
}

/**
 * Resize → per-type `Update*ParamsCommand`, bridging to the resize SSoT
 * (`bim3d-resize-bridge`, ADR-402 Phase B). Plan axes (X/Z) delegate to the 2D
 * grip-drag SSoT; axis-Y patches the element's vertical field. column/wall/beam/
 * slab ship in Phase B; stair (plan width / run, ADR-402 Sub-Phase 1) reuses the
 * 2D stair grip SSoT. `null` = no-op drag / unsupported axis for the type.
 */
function buildResizeCommand(outcome: ResizeOutcome, c: CommandBuildCtx): EditCommand | null {
  const entity = c.levels.getLevelScene(c.levelId)?.entities?.find((e) => e.id === c.entityId);
  if (!entity) return null;
  const drag: ResizeDragMm = {
    axis: outcome.axis,
    mode: outcome.mode,
    deltaMm: outcome.deltaMm,
    deltaUpMm: outcome.deltaUpMm,
    cursorMm: outcome.cursorMm,
  };
  if (entity.type === 'column') {
    const next = computeColumnResizeParams(entity.params, drag);
    return next ? new UpdateColumnParamsCommand(c.entityId, next, entity.params, c.sm, false) : null;
  }
  if (entity.type === 'wall') {
    const next = computeWallResizeParams(entity.params, drag);
    return next
      ? new UpdateWallParamsCommand(c.entityId, next, entity.params, c.sm, false, entity.kind ?? 'straight')
      : null;
  }
  if (entity.type === 'beam') {
    const next = computeBeamResizeParams(entity.params, drag);
    return next ? new UpdateBeamParamsCommand(c.entityId, next, entity.params, c.sm, false) : null;
  }
  if (entity.type === 'slab') {
    const next = computeSlabResizeParams(entity.params, drag);
    return next ? new UpdateSlabParamsCommand(c.entityId, next, entity.params, c.sm, false) : null;
  }
  if (entity.type === 'stair') {
    // ADR-402 Sub-Phase 1 — stair needs the full entity (geometry is the anchor SSoT).
    const next = computeStairResizeParams(entity, drag);
    return next ? new UpdateStairParamsCommand(c.entityId, next, entity.params, c.sm, false) : null;
  }
  return null;
}

/**
 * Apply the keyboard axis lock (X/Z) to a move delta: 'X' keeps the world-X
 * component (DXF x), 'Z' keeps the world-Z / north component (DXF y). The gizmo
 * axis arrows already constrain by projection; this makes the X/Z keys meaningful
 * for a free / plane drag too.
 */
function maskByAxisLock(delta: Point2D, lock: 'X' | 'Z' | null): Point2D {
  if (lock === 'X') return { x: delta.x, y: 0 };
  if (lock === 'Z') return { x: 0, y: delta.y };
  return delta;
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
