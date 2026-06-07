/**
 * ADR-408 Φ12 — SSoT builder for a MEP manifold param-update command.
 *
 * Extracted (N.0.2 boy-scout) from the ribbon bridge's `dispatchParams` so the
 * contextual tab «Έξοδοι» AND the on-canvas outlet add/remove grips share ONE
 * command-building path — zero copy-paste. Two responsibilities, both pure:
 *
 *   1. Re-seed the embedded connectors from the next params via
 *      `buildMepManifoldConnectors` (idempotent SSoT) — `UpdateMepManifoldParamsCommand`
 *      does NOT re-seed, so outlet-count / width / diameter changes must rebuild the
 *      connector set here before the command captures it.
 *   2. Revit "host moves, connectors follow" (ADR-408 Φ-B2a host side): any pipe
 *      whose endpoint is snapped to an outlet is bundled into ONE undo via a
 *      `CompoundCommand`.
 *
 * Returns the (possibly compound) command + the segment ids whose
 * `bim:mep-segment-params-updated` event the caller must emit (the segment command
 * does not emit on its own). The caller owns execution + EventBus side-effects so
 * this stays a pure builder (testable without a command history / event bus).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { Entity } from '../../types/entities';
import type { ICommand, ISceneManager } from '../../core/commands/interfaces';
import { CompoundCommand } from '../../core/commands';
import { UpdateMepManifoldParamsCommand } from '../../core/commands/entity-commands/UpdateMepManifoldParamsCommand';
import { UpdateMepSegmentParamsCommand } from '../../core/commands/entity-commands/UpdateMepSegmentParamsCommand';
import type {
  MepManifoldEntity,
  MepManifoldParams,
} from '../types/mep-manifold-types';
import { buildMepManifoldConnectors } from './mep-manifold-geometry';
import { resolveManifoldConnectedPipePatches } from '../mep-segments/mep-elevation-propagation';

/** The undoable command for a manifold param change + the pipes it dragged along. */
export interface ManifoldParamUpdate {
  /** A bare `UpdateMepManifoldParamsCommand`, or a `CompoundCommand` when pipes follow. */
  readonly command: ICommand;
  /**
   * Pipe ids needing a `bim:mep-segment-params-updated` emit (the segment command
   * is silent in the compound path). Empty when no connected pipe moved.
   */
  readonly segmentIds: readonly string[];
}

/**
 * Build the undoable command for applying `nextParams` to `manifold`. Re-seeds
 * connectors and, when pipe endpoints are snapped to its outlets, wraps the
 * manifold + pipe updates in a single `CompoundCommand`. Caller executes the
 * command and emits the returned segment events.
 */
export function buildManifoldParamUpdate(
  entities: readonly Entity[],
  manifold: MepManifoldEntity,
  nextParams: MepManifoldParams,
  sceneManager: ISceneManager,
): ManifoldParamUpdate {
  const withConnectors: MepManifoldParams = {
    ...nextParams,
    connectors: buildMepManifoldConnectors(nextParams),
  };
  const manifoldCmd = new UpdateMepManifoldParamsCommand(
    manifold.id,
    withConnectors,
    manifold.params,
    sceneManager,
    false,
  );

  const pipePatches = resolveManifoldConnectedPipePatches(entities, manifold.id, withConnectors);
  if (pipePatches.length === 0) {
    return { command: manifoldCmd, segmentIds: [] };
  }

  const pipeCmds = pipePatches.map(
    (p) =>
      new UpdateMepSegmentParamsCommand(p.segment.id, p.nextParams, p.segment.params, sceneManager, false),
  );
  return {
    command: new CompoundCommand('Update manifold + connected pipes', [manifoldCmd, ...pipeCmds]),
    segmentIds: pipePatches.map((p) => p.segment.id),
  };
}
