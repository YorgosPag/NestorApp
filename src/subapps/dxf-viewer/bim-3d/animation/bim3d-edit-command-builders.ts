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
 *   • move      → ONE 3D `Move*` command `(dx,dy,dz)` — plan (mm→native units) +
 *                 optional vertical (axis-Y) elevation, unified (ADR-049 Φ2, Revit).
 *   • rotate    → plan rotation about the Y ring (ADR-402).
 *   • resize    → per-type dimension patch via `bim3d-resize-bridge` (ADR-402 Phase B).
 *   • tilt      → per-type tilt patch via `bim3d-tilt-bridge` (ADR-404 Phase 2) — reuses
 *                 the SAME `Update*ParamsCommand`, NO new command.
 */

import type { Point2D } from '../../rendering/types/Types';
// ADR-049 Phase 2 — the unified move delta is 3D (optional `z` = elevation in mm).
import type { Point3D } from '../../bim/types/bim-base';
import type { Entity } from '../../types/entities';
import { isMepSegmentEntity, isWallEntity } from '../../types/entities';
import type { MepSegmentParams } from '../../bim/types/mep-segment-types';
import type { OpeningEntity } from '../../bim/types/opening-types';
import type { WallEntity } from '../../bim/types/wall-types';
import { resolveOpeningAltMove, openingRehostToleranceWorld } from '../../bim/walls/opening-grips';
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';
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
  // ADR-408 Φ-C / ADR-402 — MEP resize/tilt + the rotate pipe-follow route through
  // per-type Update commands (vertical/plan MOVE now unifies into Move*, ADR-049 Φ2).
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
    // ADR-049 Phase 2 — Revit `MoveElement(dx,dy,dz)`: ONE command, ONE 3D delta.
    // Plan (x,y) is masked by the axis lock then scaled into the entity's native
    // CANVAS units (1 for an mm drawing, 0.001 for a meter scene, the inferred factor
    // for stairs — without it a non-mm drawing flings the element 1000× off-screen,
    // the "vanish" bug). `z` is the elevation delta in RAW mm — the polymorphic
    // geometry SSoT (`calculateBimMovedGeometry`) applies the right per-type elevation
    // field + unit conversion. Pure vertical (axis-Y arrow) → x=y=0; a combined plane
    // drag → all three set; a plan drag → `z` absent. The Move command self-cascades
    // connected pipes inside execute/undo/redo and announces ONE `bim:entities-moved`
    // (persist + organism in one pass), so the vertical no longer needs a separate
    // `Update*ParamsCommand` path nor a `withConnectedPipeFollow` wrap.
    const masked = maskByAxisLock(outcome.deltaDxf, c.edit.axisLock);
    const entitiesAll = c.levels.getLevelScene(c.levelId)?.entities ?? [];
    const primary = entitiesAll.find((e) => e.id === c.entityId);
    const f = primary ? mmToEntityUnitFactor(primary) : 1;
    const delta: Point3D = {
      x: f === 1 ? masked.x : masked.x * f,
      y: f === 1 ? masked.y : masked.y * f,
      ...(outcome.deltaUpMm !== 0 ? { z: outcome.deltaUpMm } : {}),
    };
    if (delta.x === 0 && delta.y === 0 && !delta.z) return null;
    // ADR-363 Φ1G.5 Slice 2 — a hosted opening cannot free-translate: in 3D it slides
    // along its wall, or RE-HOSTS to another wall (Revit «Pick New Host»), through the
    // SAME SSoT as the 2D grip path (`resolveOpeningAltMove`). The re-sync rebuilds the
    // wall meshes with the hole on the resolved host (auto rotation + thickness).
    // Single-select only (it rewrites one opening's params).
    if (c.entityIds.length === 1 && primary?.type === 'opening') {
      return buildOpeningRehostMoveCommand(primary as OpeningEntity, delta, entitiesAll, c.sm, c.pickedWall);
    }
    return c.entityIds.length > 1
      ? new MoveMultipleEntitiesCommand([...c.entityIds], delta, c.sm, false)
      : new MoveEntityCommand(c.entityId, delta, c.sm, false);
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
    // ADR-507 §8 — RotateEntityCommand self-cascades connected pipes (and a slab's
    // slab-openings) inside execute/undo/redo for EVERY gesture (2D + 3D), so the 3D gizmo
    // no longer needs a `withConnectedPipeFollow` wrap (which only ever covered 3D rotate).
    return new RotateEntityCommand([...c.entityIds], pivot, outcome.angleDeg, c.sm, false);
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
    currentPos: translatePoint(center, delta),
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
