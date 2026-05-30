'use client';

/**
 * ADR-402 §Sub-Phase 2 — pointer-handler bodies for the BIM move gizmo.
 *
 * Extracted from `use-bim3d-edit-interaction` (the ctx-object pattern of
 * `grip-mouse-handlers.ts`) so the hook stays thin and each function focused
 * (Google N.7.1). Pure functions driven by an `EditInteractionCtx` the hook
 * builds once per effect. Behaviour is identical to in-hook closures.
 */

import * as THREE from 'three';
import { createSceneManagerAdapter } from '../../hooks/grips/grip-commit-adapters';
import type { DxfCommitDeps } from '../../hooks/grips/unified-grip-types';
import { getGlobalCommandHistory } from '../../core/commands';
import { MoveEntityCommand } from '../../core/commands/entity-commands/MoveEntityCommand';
import { worldDeltaToDxfDelta } from '../utils/bim3d-edit-math';
import { useBim3DEditStore } from '../stores/Bim3DEditStore';
import type { Bim3DEditDragController } from './bim3d-edit-drag-controller';
import type { Bim3DEditMoveHandle } from './Bim3DEditMoveHandle';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import type { LevelsHookReturn } from '../../systems/levels/useLevels';

export interface EditInteractionCtx {
  readonly manager: ThreeJsSceneManager;
  readonly canvasEl: HTMLCanvasElement;
  readonly handle: Bim3DEditMoveHandle;
  readonly controller: Bim3DEditDragController;
  /** Persistent gizmo anchor (entity world centre); advanced on commit. */
  readonly anchor: THREE.Vector3;
  /** Latest levels context (null = read-only, ADR-371). */
  readonly getLevels: () => LevelsHookReturn | null;
}

/** Re-anchor the gizmo to the element's union world-centre. Returns false when no mesh found. */
export function computeEditAnchor(ctx: EditInteractionCtx, entityId: string): boolean {
  const box = findBimEntityWorldBox(ctx.manager.bimLayer.group, entityId);
  if (!box) return false;
  box.getCenter(ctx.anchor);
  ctx.handle.setAnchor(ctx.anchor);
  return true;
}

export function onEditPointerDown(ctx: EditInteractionCtx, e: PointerEvent): void {
  if (e.button !== 0) return;
  const root = ctx.handle.getRoot();
  if (!root) return; // gizmo hidden → leave the event for camera navigation
  const pick = ctx.controller.pick(root, ctx.manager.getCamera(), ctx.canvasEl, e.clientX, e.clientY);
  if (!pick) return; // missed the gizmo → orbit/pan
  e.preventDefault();
  e.stopPropagation();
  if (pick.kind === 'axis-x' || pick.kind === 'axis-z') {
    useBim3DEditStore.getState().toggleAxisLock(pick.kind === 'axis-x' ? 'X' : 'Z');
    return;
  }
  if (!ctx.controller.startDrag(ctx.anchor.y, ctx.manager.getCamera(), ctx.canvasEl, e.clientX, e.clientY)) return;
  ctx.manager.viewport.setControlsEnabled(false);
  (e.target as Element | null)?.setPointerCapture?.(e.pointerId);
}

export function onEditPointerMove(ctx: EditInteractionCtx, e: PointerEvent): void {
  if (!ctx.controller.isDragging()) return;
  const cur = ctx.controller.updateDrag(
    ctx.manager.getCamera(), ctx.canvasEl, e.clientX, e.clientY,
    useBim3DEditStore.getState().axisLock,
  );
  if (!cur) return;
  e.preventDefault();
  e.stopPropagation();
  // Gizmo follows the cursor on the floor plane (live feedback before commit).
  ctx.handle.setAnchor(ctx.anchor.clone().add(cur.clone().sub(ctx.controller.getStart())));
  ctx.manager.markSceneDirty();
}

export function onEditPointerUp(ctx: EditInteractionCtx, e: PointerEvent): void {
  if (!ctx.controller.isDragging()) return;
  e.preventDefault();
  e.stopPropagation();
  ctx.canvasEl.releasePointerCapture?.(e.pointerId);
  const cur = ctx.controller.updateDrag(
    ctx.manager.getCamera(), ctx.canvasEl, e.clientX, e.clientY,
    useBim3DEditStore.getState().axisLock,
  );
  const end = cur ?? ctx.controller.getStart();
  // Hold the gizmo at the drop point until auto-resync re-anchors it.
  ctx.anchor.add(end.clone().sub(ctx.controller.getStart()));
  ctx.handle.setAnchor(ctx.anchor);
  commitEditMove(ctx, end);
  ctx.controller.endDrag();
  ctx.manager.viewport.setControlsEnabled(true);
  ctx.manager.markSceneDirty();
}

export function onEditPointerCancel(ctx: EditInteractionCtx): void {
  if (!ctx.controller.isDragging()) return;
  ctx.controller.cancelDrag();
  ctx.handle.setAnchor(ctx.anchor); // revert to pre-drag anchor
  ctx.manager.viewport.setControlsEnabled(true);
  ctx.manager.markSceneDirty();
}

/** Commit ONE view-agnostic MoveEntityCommand (total delta, isDragging=false → one undo step). */
function commitEditMove(ctx: EditInteractionCtx, worldEnd: THREE.Vector3): void {
  const delta = worldDeltaToDxfDelta(ctx.controller.getStart(), worldEnd);
  if (delta.x === 0 && delta.y === 0) return;
  const levels = ctx.getLevels();
  const entityId = useBim3DEditStore.getState().editEntityId;
  if (!levels || !entityId) return;
  const levelId = resolveEntityLevelId(levels, entityId) ?? levels.currentLevelId;
  if (!levelId) return;
  const sm = createSceneManagerAdapter(buildDeps(levels, levelId));
  if (!sm) return;
  const cmd = new MoveEntityCommand(entityId, delta, sm, false);
  if (cmd.validate() !== null) return;
  getGlobalCommandHistory().execute(cmd);
  useBim3DEditStore.getState().setTargetLevel(levelId);
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
