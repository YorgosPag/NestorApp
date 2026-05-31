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
import { createSceneManagerAdapter } from '../../hooks/grips/grip-commit-adapters';
import type { DxfCommitDeps } from '../../hooks/grips/unified-grip-types';
import { getGlobalCommandHistory } from '../../core/commands';
import { MoveEntityCommand } from '../../core/commands/entity-commands/MoveEntityCommand';
import { RotateEntityCommand } from '../../core/commands/entity-commands/RotateEntityCommand';
import { UpdateColumnParamsCommand } from '../../core/commands/entity-commands/UpdateColumnParamsCommand';
import { useBim3DEditStore } from '../stores/Bim3DEditStore';
import { computeColumnResizeParams } from '../gizmo/bim3d-resize-bridge';
import type { BimGizmoOverlay } from '../gizmo/bim-gizmo-overlay';
import type { BimGizmoController } from '../gizmo/bim-gizmo-controller';
import type { BridgeOutcome } from '../gizmo/bim-gizmo-drag-bridge';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import type { LevelsHookReturn } from '../../systems/levels/useLevels';

/** Commands the gizmo can dispatch from a drag outcome (one undo step each). */
type EditCommand = MoveEntityCommand | RotateEntityCommand | UpdateColumnParamsCommand;
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

/** Re-anchor the gizmo to the element's union world-centre. Returns false when no mesh found. */
export function computeEditAnchor(ctx: EditInteractionCtx, entityId: string): boolean {
  const box = findBimEntityWorldBox(ctx.manager.bimLayer.group, entityId);
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
  e.preventDefault();
  e.stopPropagation();
  ctx.manager.viewport.setControlsEnabled(false);
  (e.target as Element | null)?.setPointerCapture?.(e.pointerId);
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
  readonly entityId: string;
  readonly edit: ReturnType<typeof useBim3DEditStore.getState>;
  readonly sm: SceneManager;
  readonly levels: LevelsHookReturn;
  readonly levelId: string;
}

/** Dispatch ONE view-agnostic command from the drag outcome (one undo step). */
function dispatchOutcome(ctx: EditInteractionCtx, outcome: BridgeOutcome): void {
  if (outcome.kind === 'none') return;
  const edit = useBim3DEditStore.getState();
  const levels = ctx.getLevels();
  const entityId = edit.editEntityId;
  if (!levels || !entityId) return;
  const levelId = resolveEntityLevelId(levels, entityId) ?? levels.currentLevelId;
  if (!levelId) return;
  const sm = createSceneManagerAdapter(buildDeps(levels, levelId));
  if (!sm) return;
  const cmd = buildEditCommand(outcome, { entityId, edit, sm, levels, levelId });
  if (!cmd || cmd.validate() !== null) return;
  getGlobalCommandHistory().execute(cmd);
  useBim3DEditStore.getState().setTargetLevel(levelId);
}

/** Map a drag outcome to its view-agnostic command (null = no-op / unsupported type). */
function buildEditCommand(outcome: BridgeOutcome, c: CommandBuildCtx): EditCommand | null {
  if (outcome.kind === 'move') {
    return new MoveEntityCommand(c.entityId, maskByAxisLock(outcome.deltaDxf, c.edit.axisLock), c.sm, false);
  }
  if (outcome.kind === 'rotate') {
    return new RotateEntityCommand([c.entityId], outcome.pivotDxf, outcome.angleDeg, c.sm, false);
  }
  if (outcome.kind === 'resize') return buildResizeCommand(outcome, c);
  return null;
}

/**
 * Resize → per-type `Update*ParamsCommand`, bridging to the existing 2D grip-drag
 * SSoT (ADR-402 Phase B). Columns ship in this slice; wall/beam/slab return null
 * (no handle is shown for them yet — see `RESIZE_HANDLES_BY_TYPE`).
 */
function buildResizeCommand(outcome: ResizeOutcome, c: CommandBuildCtx): EditCommand | null {
  if (c.edit.editBimType !== 'column') return null;
  const entity = c.levels.getLevelScene(c.levelId)?.entities?.find((e) => e.id === c.entityId);
  if (!entity || entity.type !== 'column') return null;
  const next = computeColumnResizeParams(entity.params, {
    axis: outcome.axis, mode: outcome.mode, deltaMm: outcome.deltaMm, cursorMm: outcome.cursorMm,
  });
  if (!next) return null;
  return new UpdateColumnParamsCommand(c.entityId, next, entity.params, c.sm, false);
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
