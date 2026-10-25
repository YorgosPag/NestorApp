/**
 * Accept of an electrical auto-design review (ADR-430 strong · ADR-431 weak) — the one commit
 * path both electrical ribbon bridges share.
 *
 * The proposal store is SHARED by the strong- and weak-current bridges, so each Accept acts only
 * on its OWN origin — never on the sibling's proposal. The circuits/channels are geometry-less
 * `MepSystem`s: one `CreateMepSystemCommand` each, bundled into ONE `CompoundCommand` (a single
 * atomic undo). No segments — the wiring is derived at render from each system's members.
 *
 * @returns the number of committed systems, or `null` when nothing of `origin` was committed.
 */

import { CompoundCommand, type ICommand } from '../../../../core/commands';
import { CreateMepSystemCommand } from '../../../../core/commands/entity-commands/CreateMepSystemCommand';
import {
  electricalProposalStore,
  type ElectricalProposalOrigin,
} from '../../../../systems/mep-design/electrical/electrical-proposal-store';

export function commitElectricalReview(
  origin: ElectricalProposalOrigin,
  commandLabel: string,
  executeCommand: (command: ICommand) => void,
): number | null {
  const review = electricalProposalStore.get();
  if (review?.origin !== origin) return null;
  if (review.systemEntities.length === 0) {
    electricalProposalStore.reset();
    return null;
  }
  const commands: ICommand[] = review.systemEntities.map(
    (entity) => new CreateMepSystemCommand(entity),
  );
  executeCommand(new CompoundCommand(commandLabel, commands));
  electricalProposalStore.reset();
  return commands.length;
}
