/**
 * ADR-408 Φ13 — MEP pipe-network contextual ribbon command-key registry.
 *
 * Centralizes the action `commandKey` strings shared between the ribbon data
 * declaration (`contextual-mep-pipe-network-tab.ts`) and the bridge
 * (`useRibbonMepPipeNetworkBridge`). The plumbing analogue of
 * `mep-circuit-command-keys.ts`: the συλλέκτης + pipes selection creates a
 * plumbing `MepSystem` (systemType `'pipe-network'`), and the same management
 * actions (add/remove member) edit the active network. The picker / name / colour
 * rows reuse the domain-agnostic `mep-circuit-*` widgets, so only these
 * action keys are pipe-specific.
 */

import { makeKeySetGuard } from './make-key-set-guard';

export const MEP_PIPE_NETWORK_RIBBON_ACTIONS = {
  /** Build a plumbing network from the selected manifold (source) + pipes (members). */
  create: 'mepPipeNetwork.actions.create',
  /** Clear the selection (dismiss the contextual tab). */
  close: 'mepPipeNetwork.actions.close',
  /** Add the selected pipe segments to the active network. */
  addMembers: 'mepPipeNetwork.actions.addMembers',
  /** Remove the selected member pipes from the active network. */
  removeMembers: 'mepPipeNetwork.actions.removeMembers',
} as const;

/** Type guard used by the `useRibbonCommands` composer. */
export const isMepPipeNetworkActionKey = makeKeySetGuard(
  Object.values(MEP_PIPE_NETWORK_RIBBON_ACTIONS),
);
