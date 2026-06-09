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
import type { SceneEntity } from '../../core/commands/interfaces';
import { isMepSegmentEntity, isWallEntity } from '../../types/entities';
import type { MepSegmentParams } from '../../bim/types/mep-segment-types';
import type { OpeningEntity } from '../../bim/types/opening-types';
import type { WallEntity } from '../../bim/types/wall-types';
import { resolveOpeningAltMove, openingRehostToleranceWorld } from '../../bim/walls/opening-grips';
import { UpdateOpeningParamsCommand } from '../../core/commands/entity-commands/UpdateOpeningParamsCommand';
import { mmToEntityUnitFactor } from '../utils/bim3d-edit-math';
import { createSceneManagerAdapter } from '../../hooks/grips/grip-commit-adapters';
import { MoveEntityCommand, MoveMultipleEntitiesCommand } from '../../core/commands/entity-commands/MoveEntityCommand';
import { RotateEntityCommand } from '../../core/commands/entity-commands/RotateEntityCommand';
import { UpdateMepSegmentParamsCommand } from '../../core/commands/entity-commands/UpdateMepSegmentParamsCommand';
import { UpdateMepFixtureParamsCommand } from '../../core/commands/entity-commands/UpdateMepFixtureParamsCommand';
import { UpdateMepManifoldParamsCommand } from '../../core/commands/entity-commands/UpdateMepManifoldParamsCommand';
import { UpdateMepRadiatorParamsCommand } from '../../core/commands/entity-commands/UpdateMepRadiatorParamsCommand';
import { UpdateMepBoilerParamsCommand } from '../../core/commands/entity-commands/UpdateMepBoilerParamsCommand';
import { UpdateMepWaterHeaterParamsCommand } from '../../core/commands/entity-commands/UpdateMepWaterHeaterParamsCommand';
import { calculateBimRotatedGeometry } from '../../bim/transforms/bim-rotate-geometry';
import { calculateBimMovedGeometry } from '../../bim/utils/bim-move-geometry';
import { isMepConnectorHost } from '../../bim/mep-systems/connector-access';
import {
  resolveHostMoveConnectedPipePatches,
  resolveSegmentMoveConnectedPipePatches,
  type SegmentEndpointMovePatch,
} from '../../bim/mep-segments/mep-move-propagation';
import { UpdateColumnParamsCommand } from '../../core/commands/entity-commands/UpdateColumnParamsCommand';
import { UpdateWallParamsCommand } from '../../core/commands/entity-commands/UpdateWallParamsCommand';
import { UpdateBeamParamsCommand } from '../../core/commands/entity-commands/UpdateBeamParamsCommand';
import { UpdateSlabParamsCommand } from '../../core/commands/entity-commands/UpdateSlabParamsCommand';
import { UpdateStairParamsCommand } from '../../core/commands/entity-commands/UpdateStairParamsCommand';
import { CompoundCommand } from '../../core/commands/CompoundCommand';
import { useBim3DEditStore } from '../stores/Bim3DEditStore';
import { buildResizeCommand, buildTiltCommand } from './bim3d-edit-shape-commands';
import {
  computeWallVerticalMove,
  computeColumnVerticalMove,
  computeBeamVerticalMove,
  computeSlabVerticalMove,
  computeStairVerticalMove,
} from '../gizmo/bim3d-vertical-move';
import {
  mepVerticalCommand,
  mepUpdateCommandFromNext,
  mepVerticalNextParams,
} from './bim3d-edit-mep-commands';
import {
  computeMepSegmentEndpointMove,
  computeWallEndpointMove,
  computeBeamEndpointMove,
} from '../gizmo/bim3d-endpoint-move';
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
  // ADR-408 Φ-C — MEP rotate / vertical-move route through per-type Update commands.
  | UpdateMepSegmentParamsCommand
  | UpdateMepFixtureParamsCommand
  | UpdateMepManifoldParamsCommand
  | UpdateMepRadiatorParamsCommand
  | UpdateMepBoilerParamsCommand
  | UpdateMepWaterHeaterParamsCommand
  // ADR-363 Φ1G.5 Slice 2 — a hosted opening move re-hosts/slides (Update, not Move).
  | UpdateOpeningParamsCommand
  // ADR-402 — multi-select vertical move batches per-entity elevation edits.
  | CompoundCommand;
export type SceneManager = NonNullable<ReturnType<typeof createSceneManagerAdapter>>;
type EndpointMoveOutcome = Extract<BridgeOutcome, { kind: 'endpoint-move' }>;

/** Inputs shared by every command builder for the active edit target. */
export interface CommandBuildCtx {
  /** All edited ids ([0] = primary). Resize/tilt use the primary; move/rotate use all. */
  readonly entityIds: string[];
  readonly entityId: string;
  readonly edit: ReturnType<typeof useBim3DEditStore.getState>;
  readonly sm: SceneManager;
  readonly levels: LevelsHookReturn;
  readonly levelId: string;
  /**
   * ADR-363 Φ1G.5 Slice 2c — the wall UNDER THE CURSOR at release (3D raycast),
   * the reliable re-host target for a dragged opening (the gizmo-constrained end
   * point's proximity is unreliable across perpendicular walls). Undefined → the
   * resolver falls back to its nearest-wall proximity scan.
   */
  readonly pickedWall?: WallEntity;
}

// ─── ADR-408 Φ-C — connectivity-preserving follow for 3D move/rotate ──────────

/** Pipe-follow patches for one edited MEP entity (host drags its connectors' pipes; a pipe drags its coincident neighbours). Non-MEP → none. */
function pipeFollowPatchesForEntity(
  entity: Entity,
  nextParams: unknown,
  entities: readonly Entity[],
): readonly SegmentEndpointMovePatch[] {
  if (isMepSegmentEntity(entity)) {
    return resolveSegmentMoveConnectedPipePatches(entities, entity, nextParams as MepSegmentParams);
  }
  return resolveHostMoveConnectedPipePatches(entities, entity, { ...entity, params: nextParams } as Entity);
}

/** Extract `params` from a rotate/move geometry patch, or null. */
function nextParamsFromPatch(patch: Partial<SceneEntity> | null): unknown | null {
  if (patch && typeof patch === 'object' && 'params' in patch) {
    return (patch as { params?: unknown }).params ?? null;
  }
  return null;
}

/**
 * Wrap a base move/rotate command so every pipe snapped to an edited MEP entity
 * FOLLOWS it in the SAME undo (Revit "connected ends move with the element").
 * `computeNextParams` re-derives the edited entity's next params (the rotate/move
 * SSoT) so the resolver maps OLD→NEW connector/endpoint world poses. Pipes that are
 * themselves edited are skipped (no double patch). Returns the base bare when none follow.
 */
function withConnectedPipeFollow(
  base: EditCommand,
  editedIds: readonly string[],
  entities: readonly Entity[],
  sm: SceneManager,
  computeNextParams: (entity: Entity) => unknown | null,
): EditCommand {
  const edited = new Set(editedIds);
  const seen = new Set<string>();
  const pipeCmds: UpdateMepSegmentParamsCommand[] = [];
  for (const id of editedIds) {
    const entity = entities.find((e) => e.id === id);
    if (!entity || !isMepConnectorHost(entity)) continue;
    const nextParams = computeNextParams(entity);
    if (!nextParams) continue;
    for (const p of pipeFollowPatchesForEntity(entity, nextParams, entities)) {
      if (edited.has(p.segment.id) || seen.has(p.segment.id)) continue;
      seen.add(p.segment.id);
      pipeCmds.push(new UpdateMepSegmentParamsCommand(p.segment.id, p.nextParams, p.segment.params, sm, false));
    }
  }
  if (pipeCmds.length === 0) return base;
  return new CompoundCommand('Edit + connected pipes', [base, ...pipeCmds]);
}

/** Map a drag outcome to its view-agnostic command (null = no-op / unsupported type). */
export function buildEditCommand(outcome: BridgeOutcome, c: CommandBuildCtx): EditCommand | null {
  if (outcome.kind === 'move') {
    const masked0 = maskByAxisLock(outcome.deltaDxf, c.edit.axisLock);
    const hasHoriz = masked0.x !== 0 || masked0.y !== 0;
    const hasVert = outcome.deltaUpMm !== 0;
    // ADR-402 — the axis-Y arrow yields a PURELY vertical drag (deltaDxf ≈ 0): route
    // it to the per-type elevation edit (handles multi-select too).
    if (hasVert && !hasHoriz) return buildVerticalMoveCommand(outcome.deltaUpMm, c);
    // ADR-408 Φ-E — a vertical plane handle (plane-xy / plane-yz) on a free-3D MEP
    // entity yields a COMBINED horizontal + vertical drag. The XY translate and the
    // Z shift BOTH rewrite the same entity's params, so they CANNOT be two commands
    // (the second would clobber the first). Build ONE Update*ParamsCommand with the
    // combined next params instead (single-select only — multi has no vertical planes).
    if (hasVert && hasHoriz && c.entityIds.length === 1) {
      const combined = buildMepCombinedMoveCommand(masked0, outcome.deltaUpMm, c);
      if (combined) return combined;
      // Not an MEP host (shouldn't happen for a free-3D type) → fall through to plan-only.
    }
    const masked = masked0; // plan-only (deltaUpMm 0, or a non-MEP combined drag fallback)
    // ADR-402/404: convert the mm gizmo delta into the entity's native CANVAS units
    // (1 for an mm drawing, 0.001 for a meter scene, the inferred factor for stairs)
    // so the shared move SSoT relocates the entity by the right distance. Without
    // this a non-mm drawing flings the element 1000× off-screen (the "vanish" bug).
    // One delta serves the whole batch — every element in a drawing shares its units
    // (a mixed-unit multi-select stays the documented limitation).
    const entitiesAll = c.levels.getLevelScene(c.levelId)?.entities ?? [];
    const primary = entitiesAll.find((e) => e.id === c.entityId);
    const f = primary ? mmToEntityUnitFactor(primary) : 1;
    const delta = f === 1 ? masked : { x: masked.x * f, y: masked.y * f };
    // ADR-363 Φ1G.5 Slice 2 — a hosted opening cannot free-translate: in 3D it
    // slides along its wall, or RE-HOSTS to another wall (Revit «Pick New Host»),
    // through the SAME SSoT as the 2D grip path (`resolveOpeningAltMove`). The
    // re-sync rebuilds the wall meshes with the hole on the resolved host (auto
    // rotation + thickness). Single-select only (it rewrites one opening's params).
    if (c.entityIds.length === 1 && primary?.type === 'opening') {
      return buildOpeningRehostMoveCommand(primary as OpeningEntity, delta, entitiesAll, c.sm, c.pickedWall);
    }
    const moveBase: EditCommand =
      c.entityIds.length > 1
        ? new MoveMultipleEntitiesCommand([...c.entityIds], delta, c.sm, false)
        : new MoveEntityCommand(c.entityId, delta, c.sm, false);
    // ADR-408 Φ-C — pipes snapped to an edited MEP entity follow it in one undo.
    return withConnectedPipeFollow(moveBase, c.entityIds, entitiesAll, c.sm, (e) =>
      nextParamsFromPatch(calculateBimMovedGeometry(e, delta)),
    );
  }
  if (outcome.kind === 'rotate') {
    // ADR-402/404: the pivot is mm (worldToDxfPlan); scale it into the entity's
    // native CANVAS units (mm scene → 1, meter scene → 0.001, the inferred factor
    // for a stair) — otherwise it orbits around an mm-scaled point and the element
    // is flung off-screen on a non-mm drawing (the "vanish" bug). The primary's
    // factor applies to the whole batch (every element shares the drawing units).
    let pivot = outcome.pivotDxf;
    const entitiesAll = c.levels.getLevelScene(c.levelId)?.entities ?? [];
    const entity = entitiesAll.find((e) => e.id === c.entityId);
    const f = entity ? mmToEntityUnitFactor(entity) : 1;
    if (f !== 1) pivot = { x: pivot.x * f, y: pivot.y * f };
    const rotateBase = new RotateEntityCommand([...c.entityIds], pivot, outcome.angleDeg, c.sm, false);
    // ADR-408 Φ-C — pipes snapped to an edited MEP entity follow the rotation in one undo.
    return withConnectedPipeFollow(rotateBase, c.entityIds, entitiesAll, c.sm, (e) =>
      nextParamsFromPatch(calculateBimRotatedGeometry(e, pivot, outcome.angleDeg)),
    );
  }
  // Resize is single-entity only (multi-select hides the resize handles).
  if (outcome.kind === 'resize') return c.entityIds.length === 1 ? buildResizeCommand(outcome, c) : null;
  // ADR-404 Phase 2 — tilt (X/Z rings) is single-entity only (mirror resize).
  if (outcome.kind === 'tilt') return c.entityIds.length === 1 ? buildTiltCommand(outcome, c) : null;
  // ADR-408 Φ-D — endpoint move (linear MEP segment) is single-entity only.
  if (outcome.kind === 'endpoint-move') return c.entityIds.length === 1 ? buildEndpointMoveCommand(outcome, c) : null;
  return null;
}

/**
 * ADR-363 Φ1G.5 Slice 2 — 3D move of a hosted opening → slide along its wall or
 * RE-HOST onto another wall, via the SSoT shared with the 2D grip path
 * (`resolveOpeningAltMove`). The opening's current world centre is the base point;
 * `delta` (already in native canvas units) translates it. The resolved params land
 * through `UpdateOpeningParamsCommand`, which recomputes geometry against the
 * resolved host (auto rotation + thickness). `null` = no-op / missing host.
 */
function buildOpeningRehostMoveCommand(
  opening: OpeningEntity,
  delta: Point2D,
  entities: readonly Entity[],
  sm: SceneManager,
  pickedWall?: WallEntity,
): EditCommand | null {
  const currentHost = entities.find(
    (e): e is WallEntity => e.id === opening.params.wallId && e.type === 'wall',
  );
  if (!currentHost) return null;
  const center: Point2D = { x: opening.geometry.position.x, y: opening.geometry.position.y };
  const resolved = resolveOpeningAltMove({
    originalParams: opening.params,
    basePoint: center,
    currentPos: { x: center.x + delta.x, y: center.y + delta.y },
    currentHost,
    candidateWalls: entities.filter(isWallEntity),
    rehostToleranceWorld: openingRehostToleranceWorld(currentHost),
    // 3D: the wall under the cursor at release is the reliable re-host target.
    ...(pickedWall ? { forcedHost: pickedWall } : {}),
  });
  if (!resolved) return null;
  return new UpdateOpeningParamsCommand(opening.id, resolved.params, opening.params, sm, false);
}

/**
 * ADR-408 Φ-D/Φ1 — endpoint move → per-type `Update*ParamsCommand` via the endpoint-move
 * SSoT (`bim3d-endpoint-move`). Three disciplines, one builder:
 *   - `mep-segment` → free-3D pipe end (plan + elevation), wrapped in
 *     `withConnectedPipeFollow` so snapped pipes FOLLOW in the same undo.
 *   - `wall` / `beam` → horizontal LENGTH edit (plan only; `deltaUpMm` is ≈0 by the
 *     ground-plane projection and the height is a separate handle/Type).
 * The DXF-mm plan delta is scaled into the entity's native canvas units
 * (`mmToEntityUnitFactor`, mirror move/rotate). `null` = no-op / unsupported type.
 */
function buildEndpointMoveCommand(outcome: EndpointMoveOutcome, c: CommandBuildCtx): EditCommand | null {
  const entitiesAll = c.levels.getLevelScene(c.levelId)?.entities ?? [];
  const entity = entitiesAll.find((e) => e.id === c.entityId);
  if (!entity) return null;
  const f = mmToEntityUnitFactor(entity);
  const deltaCanvas = f === 1 ? outcome.deltaMm : { x: outcome.deltaMm.x * f, y: outcome.deltaMm.y * f };
  if (entity.type === 'mep-segment') {
    const next = computeMepSegmentEndpointMove(entity.params, outcome.endpoint, deltaCanvas, outcome.deltaUpMm);
    if (!next) return null;
    const base = new UpdateMepSegmentParamsCommand(c.entityId, next, entity.params, c.sm, false);
    // The dragged segment is the only edited host; its connected pipes follow the moved end.
    return withConnectedPipeFollow(base, [c.entityId], entitiesAll, c.sm, (e) =>
      e.id === c.entityId ? next : null,
    );
  }
  if (entity.type === 'wall') {
    const next = computeWallEndpointMove(entity.params, outcome.endpoint, deltaCanvas);
    return next
      ? new UpdateWallParamsCommand(c.entityId, next, entity.params, c.sm, false, entity.kind ?? 'straight')
      : null;
  }
  if (entity.type === 'beam') {
    const next = computeBeamEndpointMove(entity.params, outcome.endpoint, deltaCanvas);
    return next ? new UpdateBeamParamsCommand(c.entityId, next, entity.params, c.sm, false) : null;
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
  const entities = scene.entities;
  let base: EditCommand | null;
  if (c.entityIds.length <= 1) {
    const entity = entities.find((e) => e.id === c.entityId);
    base = entity ? verticalCommandForEntity(entity, deltaUpMm, c.sm) : null;
  } else {
    const commands: EditCommand[] = [];
    for (const id of c.entityIds) {
      const entity = entities.find((e) => e.id === id);
      const cmd = entity ? verticalCommandForEntity(entity, deltaUpMm, c.sm) : null;
      if (cmd) commands.push(cmd);
    }
    base = commands.length > 0 ? new CompoundCommand(`Vertical Move (${commands.length})`, commands) : null;
  }
  if (!base) return null;
  // ADR-408 Φ-C — pipes snapped to a vertically-moved MEP entity follow its Z in one undo.
  return withConnectedPipeFollow(base, c.entityIds, entities, c.sm, (e) =>
    mepVerticalNextParams(e, deltaUpMm),
  );
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
  // ADR-408 Φ-C (3D gizmo) — MEP entities (point hosts + pipe) shift their elevation.
  return mepVerticalCommand(entity, deltaUpMm, sm);
}

/**
 * ADR-408 Φ-E — combined horizontal + vertical move of a SINGLE free-3D MEP entity
 * (vertical plane handle drag). Builds ONE `Update*ParamsCommand` carrying the entity
 * translated in plan AND shifted in elevation (the two cannot be separate commands —
 * they rewrite the same params), wrapped in `withConnectedPipeFollow` so the snapped
 * pipes follow the combined final pose in one undo. `null` = not an MEP host.
 */
function buildMepCombinedMoveCommand(maskedDxf: Point2D, deltaUpMm: number, c: CommandBuildCtx): EditCommand | null {
  const entitiesAll = c.levels.getLevelScene(c.levelId)?.entities ?? [];
  const entity = entitiesAll.find((e) => e.id === c.entityId);
  if (!entity) return null;
  const f = mmToEntityUnitFactor(entity);
  const deltaCanvas = f === 1 ? maskedDxf : { x: maskedDxf.x * f, y: maskedDxf.y * f };
  const next = mepCombinedNextParams(entity, deltaCanvas, deltaUpMm);
  if (!next) return null;
  const base = mepUpdateCommandFromNext(entity, next, c.sm);
  if (!base) return null;
  return withConnectedPipeFollow(base, [c.entityId], entitiesAll, c.sm, () => next);
}

/** Final params of an MEP entity after a plan translate (`deltaCanvas`) THEN an elevation shift. */
function mepCombinedNextParams(entity: Entity, deltaCanvas: Point2D, deltaUpMm: number): unknown | null {
  const moved = nextParamsFromPatch(calculateBimMovedGeometry(entity, deltaCanvas));
  if (!moved) return null;
  return mepVerticalNextParams({ ...entity, params: moved } as Entity, deltaUpMm) ?? moved;
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
