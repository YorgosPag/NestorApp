/**
 * ADR-408 Φ-C — SSoT builder + executor for a connectivity-preserving host MOVE.
 *
 * When an MEP host is dragged/rotated/raised, the pipe ends snapped to its
 * connectors must follow (Revit "host moves, connectors move with it"). This wraps
 * the host's own `Update*ParamsCommand` and the connected-pipe
 * `UpdateMepSegmentParamsCommand`s in ONE `CompoundCommand` so the whole move is a
 * single undo. 1:1 sibling of `buildManifoldParamUpdate` (which covers only the
 * manifold + Z follow); this is generic across every connector host and covers
 * XY + Z + rotation via {@link resolveHostMoveConnectedPipePatches}.
 *
 * Two exports, both thin:
 *   - `buildConnectivityHostUpdate` — pure-ish builder (testable, no event bus).
 *   - `executeHostMoveWithConnectedPipes` — grip-commit glue (execute + EventBus),
 *     so each `commitMep*GripDrag` stays small (N.7.1) and uniform.
 *
 * Pipe sub-commands keep `isDragging = true` so a continuous drag merges with the
 * host command into a single undo entry (`CompoundCommand.canMergeWith` needs a
 * stable child shape — guaranteed by the resolver's coincidence-based patching).
 *
 * @see ./mep-move-propagation.ts — the pure resolver
 * @see ../mep-manifolds/mep-manifold-param-update.ts — the Z-only manifold sibling
 */

import type { Entity } from '../../types/entities';
import type { ICommand, ISceneManager } from '../../core/commands/interfaces';
import { CompoundCommand } from '../../core/commands';
import { UpdateMepSegmentParamsCommand } from '../../core/commands/entity-commands/UpdateMepSegmentParamsCommand';
import { EventBus } from '../../systems/events/EventBus';
import type { MepSegmentEntity, MepSegmentParams } from '../types/mep-segment-types';
import {
  resolveHostMoveConnectedPipePatches,
  resolveSegmentMoveConnectedPipePatches,
  type SegmentEndpointMovePatch,
} from './mep-move-propagation';

/** Read the scene entities (optional on `ISceneManager`; absent ⇒ no follow). */
function readSceneEntities(sceneManager: ISceneManager): readonly Entity[] {
  return (sceneManager.getEntities?.() ?? []) as unknown as readonly Entity[];
}

/**
 * Wrap a base command + the connected-pipe patches in one `CompoundCommand` (single
 * undo), or return the base bare when nothing follows. Pipe sub-commands keep
 * `isDragging = true` for drag-merge. Shared SSoT for the host + segment paths.
 */
function wrapWithPipeFollow(
  baseCommand: ICommand,
  patches: readonly SegmentEndpointMovePatch[],
  sceneManager: ISceneManager,
  name: string,
): ICommand {
  if (patches.length === 0) return baseCommand;
  const pipeCmds = patches.map(
    (p) =>
      new UpdateMepSegmentParamsCommand(p.segment.id, p.nextParams, p.segment.params, sceneManager, true),
  );
  return new CompoundCommand(name, [baseCommand, ...pipeCmds]);
}

/** The undoable command for a host move + the pipe ids whose events the caller emits. */
export interface ConnectivityHostUpdate {
  /** A bare `hostCommand`, or a `CompoundCommand` when connected pipes follow. */
  readonly command: ICommand;
  /** Pipe ids that moved — each needs a `bim:mep-segment-params-updated` emit. */
  readonly segmentIds: readonly string[];
}

/**
 * Build the undoable command for a host move. When pipe ends are snapped to the
 * host's connectors, wraps `hostCommand` + the connected-pipe updates in a single
 * `CompoundCommand`; otherwise returns `hostCommand` bare. `prevHost`/`nextHost` are
 * the same entity before vs after the move.
 */
export function buildConnectivityHostUpdate(
  entities: readonly Entity[],
  prevHost: Entity,
  nextHost: Entity,
  hostCommand: ICommand,
  sceneManager: ISceneManager,
): ConnectivityHostUpdate {
  const patches = resolveHostMoveConnectedPipePatches(entities, prevHost, nextHost);
  return {
    command: wrapWithPipeFollow(hostCommand, patches, sceneManager, 'Move host + connected pipes'),
    segmentIds: patches.map((p) => p.segment.id),
  };
}

/** Args for {@link executeHostMoveWithConnectedPipes}. */
export interface HostMoveExecution {
  readonly prevHost: Entity;
  readonly nextHost: Entity;
  readonly hostCommand: ICommand;
  readonly sceneManager: ISceneManager;
  readonly execute: (command: ICommand) => void;
  /** Emit the host-specific `bim:mep-*-params-updated` event (payload differs per kind). */
  readonly emitHost: () => void;
}

/**
 * Execute a host move with its connected-pipe follow as one undo, then fire the
 * EventBus notifications (host + each moved pipe). Used by every `commitMep*GripDrag`
 * so the wiring is one call. `getEntities` is optional on `ISceneManager`; absent ⇒
 * no follow (safe fallback: just the host command).
 */
export function executeHostMoveWithConnectedPipes(args: HostMoveExecution): void {
  const entities = readSceneEntities(args.sceneManager);
  const { command, segmentIds } = buildConnectivityHostUpdate(
    entities,
    args.prevHost,
    args.nextHost,
    args.hostCommand,
    args.sceneManager,
  );
  args.execute(command);
  args.emitHost();
  for (const segmentId of segmentIds) {
    EventBus.emit('bim:mep-segment-params-updated', { segmentId });
  }
}

/** Args for {@link executeSegmentMoveWithConnectedPipes}. */
export interface SegmentMoveExecution {
  readonly prevSegment: MepSegmentEntity;
  readonly nextParams: MepSegmentParams;
  readonly segmentCommand: ICommand;
  readonly sceneManager: ISceneManager;
  readonly execute: (command: ICommand) => void;
}

/**
 * ADR-408 Φ-C (pipe side) — execute a pipe (segment) move with its connected-pipe
 * follow as one undo, then fire the moved-segment events. Coincident endpoints of
 * neighbouring pipes follow the dragged run (Revit: dragging a pipe drags the joins
 * with it). Mirrors {@link executeHostMoveWithConnectedPipes} for the segment case.
 */
export function executeSegmentMoveWithConnectedPipes(args: SegmentMoveExecution): void {
  const entities = readSceneEntities(args.sceneManager);
  const patches = resolveSegmentMoveConnectedPipePatches(entities, args.prevSegment, args.nextParams);
  const command = wrapWithPipeFollow(
    args.segmentCommand,
    patches,
    args.sceneManager,
    'Move pipe + connected pipes',
  );
  args.execute(command);
  EventBus.emit('bim:mep-segment-params-updated', { segmentId: args.prevSegment.id });
  for (const p of patches) {
    EventBus.emit('bim:mep-segment-params-updated', { segmentId: p.segment.id });
  }
}
