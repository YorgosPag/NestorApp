/**
 * bim3d-edit-structural-emit.ts — announce a finished 3D gizmo edit as a
 * structural-change event (ADR-459 Φ7).
 *
 * Split out of `bim3d-edit-command-builders` (which transitively pulls every
 * `Update*ParamsCommand` → the Firestore-backed structural-settings store) so this
 * tiny, side-effect-free announcement logic stays unit-testable in isolation: it
 * imports only the move/compound command classes (for the `instanceof` guard), the
 * kind→event SSoT, and TYPE-ONLY references to the command union + scene manager.
 *
 * @see ./bim3d-edit-command-builders.ts — builds the commands this announces
 * @see ../../systems/events/emit-bim-entity-params-updated.ts — the kind→event SSoT
 */

import { MoveEntityCommand, MoveMultipleEntitiesCommand } from '../../core/commands/entity-commands/MoveEntityCommand';
import { CompoundCommand } from '../../core/commands/CompoundCommand';
import { emitBimEntityParamsUpdated } from '../../systems/events/emit-bim-entity-params-updated';
import type { EditCommand, SceneManager } from './bim3d-edit-command-builders';

/**
 * ADR-459 Φ7 — true when `cmd` already announces itself via `bim:entities-moved`
 * (the move commands self-emit in execute/undo/redo). A pure horizontal plan move
 * builds `MoveEntityCommand`/`MoveMultipleEntitiesCommand` → it has already told the
 * reactors, so the params-updated emit must be SKIPPED (no double announce). Every
 * other edit — rotate, resize, tilt, VERTICAL move, opening re-host — builds a
 * `Rotate`/`Update*ParamsCommand` that self-emits NOTHING → it needs the explicit
 * emit. A `CompoundCommand` whose first child is a move (MEP move + pipe-follow)
 * counts as self-emitting (the move base announces the edited host).
 */
function commandSelfEmitsMove(cmd: EditCommand): boolean {
  if (cmd instanceof MoveEntityCommand || cmd instanceof MoveMultipleEntitiesCommand) return true;
  if (cmd instanceof CompoundCommand) {
    const first = cmd.commands[0];
    return first instanceof MoveEntityCommand || first instanceof MoveMultipleEntitiesCommand;
  }
  return false;
}

/**
 * ADR-459 Φ7 — announce a finished 3D gizmo edit as a structural-change event, the
 * SAME way the 2D grip commit layer does (`grip-parametric-commits` →
 * `emitBimEntityParamsUpdated`). WITHOUT this, the 3D commit ran `execute(cmd)` and
 * emitted nothing, so a column rotate/resize never re-triggered the auto-foundation
 * designer (the footing stayed put). One emit per edited entity via the kind→event
 * SSoT; skipped when the command already self-emits `bim:entities-moved` (horizontal
 * move). MUST be called AFTER `execute(cmd)` so the edited command is the last on the
 * history stack when the coalesced reactor microtask runs (Φ7 atomic-undo grouping).
 */
export function emitStructuralChangeAfterEdit(
  cmd: EditCommand,
  entityIds: readonly string[],
  sm: SceneManager,
): void {
  if (commandSelfEmitsMove(cmd)) return;
  for (const id of entityIds) {
    const type = sm.getEntity(id)?.type;
    if (type) emitBimEntityParamsUpdated(type, id);
  }
}
