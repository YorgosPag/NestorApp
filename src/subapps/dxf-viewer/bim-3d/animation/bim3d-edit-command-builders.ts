'use client';

/**
 * bim3d-edit-command-builders.ts — drag outcome → view-agnostic command (ADR-402/404).
 *
 * Extracted from `bim3d-edit-interaction-handlers` (Google N.7.1 — the handlers file
 * crossed 500 lines when ADR-404 tilt landed). Pure mapping: a finished gizmo drag
 * `BridgeOutcome` → ONE `Update*ParamsCommand` / `Move*` / `Rotate*` (one undo step).
 * No React, no scene mutation, no dispatch — the handler owns `execute()`.
 *
 * Per outcome kind:
 *   • move      → plan move (mm→native units) / vertical (axis-Y) elevation edit.
 *   • rotate    → plan rotation about the Y ring (ADR-402).
 *   • resize    → per-type dimension patch via `bim3d-resize-bridge` (ADR-402 Phase B).
 *   • tilt      → per-type tilt patch via `bim3d-tilt-bridge` (ADR-404 Phase 2) — reuses
 *                 the SAME `Update*ParamsCommand`, NO new command.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { mmToEntityUnitFactor } from '../utils/bim3d-edit-math';
import { createSceneManagerAdapter } from '../../hooks/grips/grip-commit-adapters';
import { MoveEntityCommand, MoveMultipleEntitiesCommand } from '../../core/commands/entity-commands/MoveEntityCommand';
import { RotateEntityCommand } from '../../core/commands/entity-commands/RotateEntityCommand';
import { UpdateColumnParamsCommand } from '../../core/commands/entity-commands/UpdateColumnParamsCommand';
import { UpdateWallParamsCommand } from '../../core/commands/entity-commands/UpdateWallParamsCommand';
import { UpdateBeamParamsCommand } from '../../core/commands/entity-commands/UpdateBeamParamsCommand';
import { UpdateSlabParamsCommand } from '../../core/commands/entity-commands/UpdateSlabParamsCommand';
import { UpdateStairParamsCommand } from '../../core/commands/entity-commands/UpdateStairParamsCommand';
import { CompoundCommand } from '../../core/commands/CompoundCommand';
import { useBim3DEditStore } from '../stores/Bim3DEditStore';
import {
  computeColumnResizeParams,
  computeWallResizeParams,
  computeBeamResizeParams,
  computeSlabResizeParams,
  computeStairResizeParams,
  type ResizeDragMm,
} from '../gizmo/bim3d-resize-bridge';
import {
  computeColumnTiltParams,
  computeWallTiltParams,
  computeBeamTiltParams,
  computeSlabTiltParams,
  type TiltDragDeg,
} from '../gizmo/bim3d-tilt-bridge';
import {
  computeWallVerticalMove,
  computeColumnVerticalMove,
  computeBeamVerticalMove,
  computeSlabVerticalMove,
  computeStairVerticalMove,
} from '../gizmo/bim3d-vertical-move';
import type { BridgeOutcome } from '../gizmo/bim-gizmo-drag-bridge';
import type { LevelsHookReturn } from '../../systems/levels/useLevels';

/** Commands the gizmo can dispatch from a drag outcome (one undo step each). */
export type EditCommand =
  | MoveEntityCommand
  | MoveMultipleEntitiesCommand
  | RotateEntityCommand
  | UpdateColumnParamsCommand
  | UpdateWallParamsCommand
  | UpdateBeamParamsCommand
  | UpdateSlabParamsCommand
  | UpdateStairParamsCommand
  // ADR-402 — multi-select vertical move batches per-entity elevation edits.
  | CompoundCommand;
export type SceneManager = NonNullable<ReturnType<typeof createSceneManagerAdapter>>;
type ResizeOutcome = Extract<BridgeOutcome, { kind: 'resize' }>;
type TiltOutcome = Extract<BridgeOutcome, { kind: 'tilt' }>;

/** Inputs shared by every command builder for the active edit target. */
export interface CommandBuildCtx {
  /** All edited ids ([0] = primary). Resize/tilt use the primary; move/rotate use all. */
  readonly entityIds: string[];
  readonly entityId: string;
  readonly edit: ReturnType<typeof useBim3DEditStore.getState>;
  readonly sm: SceneManager;
  readonly levels: LevelsHookReturn;
  readonly levelId: string;
}

/** Map a drag outcome to its view-agnostic command (null = no-op / unsupported type). */
export function buildEditCommand(outcome: BridgeOutcome, c: CommandBuildCtx): EditCommand | null {
  if (outcome.kind === 'move') {
    // ADR-402 — the axis-Y arrow yields a purely vertical drag (deltaDxf ≈ 0,
    // deltaUpMm ≠ 0): route it to the per-type elevation edit. The horizontal
    // arrows / plane / free drag keep deltaUpMm 0 → fall through to the plan move.
    if (outcome.deltaUpMm !== 0) return buildVerticalMoveCommand(outcome.deltaUpMm, c);
    const masked = maskByAxisLock(outcome.deltaDxf, c.edit.axisLock);
    // ADR-402/404: convert the mm gizmo delta into the entity's native CANVAS units
    // (1 for an mm drawing, 0.001 for a meter scene, the inferred factor for stairs)
    // so the shared move SSoT relocates the entity by the right distance. Without
    // this a non-mm drawing flings the element 1000× off-screen (the "vanish" bug).
    // One delta serves the whole batch — every element in a drawing shares its units
    // (a mixed-unit multi-select stays the documented limitation).
    const primary = c.levels.getLevelScene(c.levelId)?.entities?.find((e) => e.id === c.entityId);
    const f = primary ? mmToEntityUnitFactor(primary) : 1;
    const delta = f === 1 ? masked : { x: masked.x * f, y: masked.y * f };
    if (c.entityIds.length > 1) {
      return new MoveMultipleEntitiesCommand([...c.entityIds], delta, c.sm, false);
    }
    return new MoveEntityCommand(c.entityId, delta, c.sm, false);
  }
  if (outcome.kind === 'rotate') {
    // ADR-402/404: the pivot is mm (worldToDxfPlan); scale it into the entity's
    // native CANVAS units (mm scene → 1, meter scene → 0.001, the inferred factor
    // for a stair) — otherwise it orbits around an mm-scaled point and the element
    // is flung off-screen on a non-mm drawing (the "vanish" bug). The primary's
    // factor applies to the whole batch (every element shares the drawing units).
    let pivot = outcome.pivotDxf;
    const entity = c.levels.getLevelScene(c.levelId)?.entities?.find((e) => e.id === c.entityId);
    const f = entity ? mmToEntityUnitFactor(entity) : 1;
    if (f !== 1) pivot = { x: pivot.x * f, y: pivot.y * f };
    return new RotateEntityCommand([...c.entityIds], pivot, outcome.angleDeg, c.sm, false);
  }
  // Resize is single-entity only (multi-select hides the resize handles).
  if (outcome.kind === 'resize') return c.entityIds.length === 1 ? buildResizeCommand(outcome, c) : null;
  // ADR-404 Phase 2 — tilt (X/Z rings) is single-entity only (mirror resize).
  if (outcome.kind === 'tilt') return c.entityIds.length === 1 ? buildTiltCommand(outcome, c) : null;
  return null;
}

/**
 * Tilt → per-type `Update*ParamsCommand`, bridging to the tilt SSoT
 * (`bim3d-tilt-bridge`, ADR-404 Phase 2). Reuses the SAME view-agnostic commands as
 * resize (column/wall `tilt`, beam `topElevationEnd`, slab `slope`+`geometryType`) —
 * NO new command. `null` = no-op / roll ring / unsupported type (stair has no tilt).
 */
function buildTiltCommand(outcome: TiltOutcome, c: CommandBuildCtx): EditCommand | null {
  const entity = c.levels.getLevelScene(c.levelId)?.entities?.find((e) => e.id === c.entityId);
  if (!entity) return null;
  const drag: TiltDragDeg = { axis: outcome.axis, angleDeg: outcome.angleDeg };
  if (entity.type === 'column') {
    const next = computeColumnTiltParams(entity.params, drag);
    return next ? new UpdateColumnParamsCommand(c.entityId, next, entity.params, c.sm, false) : null;
  }
  if (entity.type === 'wall') {
    const next = computeWallTiltParams(entity.params, drag);
    return next
      ? new UpdateWallParamsCommand(c.entityId, next, entity.params, c.sm, false, entity.kind ?? 'straight')
      : null;
  }
  if (entity.type === 'beam') {
    const next = computeBeamTiltParams(entity.params, drag);
    return next ? new UpdateBeamParamsCommand(c.entityId, next, entity.params, c.sm, false) : null;
  }
  if (entity.type === 'slab') {
    const next = computeSlabTiltParams(entity.params, drag);
    return next ? new UpdateSlabParamsCommand(c.entityId, next, entity.params, c.sm, false) : null;
  }
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
 * Vertical (axis-Y) move → per-type elevation edit (`bim3d-vertical-move` SSoT).
 * Single selection → one `Update*ParamsCommand`; multi-select → a `CompoundCommand`
 * batching each element's elevation edit into ONE undo step (mixed types each get
 * their own canonical field — wall/column `baseOffset`, beam `topElevation`, slab
 * `levelElevation`, stair `basePoint.z`). `null` = no-op / no eligible entity.
 */
function buildVerticalMoveCommand(deltaUpMm: number, c: CommandBuildCtx): EditCommand | null {
  const scene = c.levels.getLevelScene(c.levelId);
  if (!scene) return null;
  if (c.entityIds.length <= 1) {
    const entity = scene.entities.find((e) => e.id === c.entityId);
    return entity ? verticalCommandForEntity(entity, deltaUpMm, c.sm) : null;
  }
  const commands: EditCommand[] = [];
  for (const id of c.entityIds) {
    const entity = scene.entities.find((e) => e.id === id);
    const cmd = entity ? verticalCommandForEntity(entity, deltaUpMm, c.sm) : null;
    if (cmd) commands.push(cmd);
  }
  return commands.length > 0 ? new CompoundCommand(`Vertical Move (${commands.length})`, commands) : null;
}

/** One element → its per-type elevation `Update*ParamsCommand` (null = no-op / unsupported type). */
function verticalCommandForEntity(entity: Entity, deltaUpMm: number, sm: SceneManager): EditCommand | null {
  if (entity.type === 'wall') {
    const next = computeWallVerticalMove(entity.params, deltaUpMm);
    return next
      ? new UpdateWallParamsCommand(entity.id, next, entity.params, sm, false, entity.kind ?? 'straight')
      : null;
  }
  if (entity.type === 'column') {
    const next = computeColumnVerticalMove(entity.params, deltaUpMm);
    return next ? new UpdateColumnParamsCommand(entity.id, next, entity.params, sm, false) : null;
  }
  if (entity.type === 'beam') {
    const next = computeBeamVerticalMove(entity.params, deltaUpMm);
    return next ? new UpdateBeamParamsCommand(entity.id, next, entity.params, sm, false) : null;
  }
  if (entity.type === 'slab') {
    const next = computeSlabVerticalMove(entity.params, deltaUpMm);
    return next ? new UpdateSlabParamsCommand(entity.id, next, entity.params, sm, false) : null;
  }
  if (entity.type === 'stair') {
    const next = computeStairVerticalMove(entity, deltaUpMm);
    return next ? new UpdateStairParamsCommand(entity.id, next, entity.params, sm, false) : null;
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
