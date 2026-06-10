/**
 * ADR-408 Φ-C (whole-entity / Alt move-from-point side) — connectivity-preserving
 * WHOLE-ENTITY move for a plumbing connector host.
 *
 * The parametric grip path (center translate / corner resize / rotate) already keeps
 * connected pipe ends attached when an MEP host moves: each `commitMep*GripDrag`
 * routes through {@link executeHostMoveWithConnectedPipes}. The OTHER move path —
 * the AutoCAD "move from characteristic point" (ADR-363 Φ1G.5: Alt+drag from any
 * grip, and the `mode === 'move'` grip menu) — historically committed via a bare
 * `MoveEntityCommand`, which is connectivity-blind: it shifts the host's `position`
 * but leaves the pipe ends snapped to its OLD connector poses, tearing the run off
 * the network. In Revit the connected end always tracks the element.
 *
 * This closes that gap WITHOUT a second mechanism: it reuses the SAME pure resolver
 * (`resolveHostMoveConnectedPipePatches`, via `executeHostMoveWithConnectedPipes`)
 * the parametric path uses, wrapping the host `MoveEntityCommand` + the connected
 * pipe `UpdateMepSegmentParamsCommand`s in one `CompoundCommand` (single undo).
 *
 * Gated by `pointHostMountingElevationMm(host) !== null` — the SSoT "is this a
 * pipe-connectable host?" predicate. A non-plumbing entity (wall / furniture /
 * electrical panel) returns `false` so the caller falls back to its normal move,
 * keeping every other entity byte-identical (zero regression).
 *
 * @see ./build-connectivity-host-update.ts — executeHostMoveWithConnectedPipes (shared executor)
 * @see ./mep-move-propagation.ts — resolveHostMoveConnectedPipePatches (the pure resolver)
 * @see ../../hooks/grips/grip-commit-adapters.ts — commitWholeEntityMove (the caller)
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ-C
 */

import type { Entity } from '../../types/entities';
import type { Point2D } from '../../rendering/types/Types';
import type { ICommand, ISceneManager } from '../../core/commands/interfaces';
import { MoveEntityCommand } from '../../core/commands/entity-commands/MoveEntityCommand';
import { calculateBimMovedGeometry } from '../utils/bim-move-geometry';
import { pointHostMountingElevationMm } from './mep-connector-elevation';
import { executeHostMoveWithConnectedPipes } from './build-connectivity-host-update';

/** Args for {@link executeWholeEntityConnectivityMove}. */
export interface WholeEntityConnectivityMoveArgs {
  readonly entityId: string;
  readonly delta: Point2D;
  readonly sceneManager: ISceneManager;
  readonly execute: (command: ICommand) => void;
}

/**
 * If `entityId` is a plumbing connector host, translate it by `delta` while its
 * connected pipe ends follow (single `CompoundCommand` undo), and return `true`.
 * Returns `false` — without touching the scene — when the entity is absent, not a
 * plumbing host, or its move yields no geometry patch, so the caller can fall back
 * to its normal (non-connectivity) move command.
 */
export function executeWholeEntityConnectivityMove(args: WholeEntityConnectivityMoveArgs): boolean {
  const prevHost = args.sceneManager.getEntity(args.entityId) as unknown as Entity | undefined;
  if (!prevHost) return false;
  // SSoT gate: only pipe-connectable hosts have connectors a run can follow.
  if (pointHostMountingElevationMm(prevHost) === null) return false;

  const patch = calculateBimMovedGeometry(prevHost, args.delta);
  if (!patch || Object.keys(patch).length === 0) return false;
  const nextHost = { ...prevHost, ...patch } as Entity;

  // The host command shifts `position`; the executor wraps it with the connected
  // pipe patches. `MoveEntityCommand` emits `bim:entities-moved` itself (fixture
  // persistence), so `emitHost` is a no-op — the executor still fires the
  // `bim:mep-segment-params-updated` events for the followed pipes.
  const hostCommand = new MoveEntityCommand(args.entityId, args.delta, args.sceneManager, false);
  executeHostMoveWithConnectedPipes({
    prevHost,
    nextHost,
    hostCommand,
    sceneManager: args.sceneManager,
    execute: args.execute,
    emitHost: () => {},
  });
  return true;
}
