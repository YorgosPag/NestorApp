/**
 * ADR-408 Φ5 — MEP circuit contextual ribbon command-key registry.
 *
 * Centralizes the action `commandKey` strings shared between the ribbon data
 * declaration (`contextual-mep-circuit-tab.ts`) and the bridge
 * (`useRibbonMepCircuitBridge`). Mirrors `BEAM_RIBBON_KEYS_ACTIONS` — this tab
 * is action-only (no per-field comboboxes in the opening slice).
 */

import { makeKeySetGuard } from './make-key-set-guard';

export const MEP_CIRCUIT_RIBBON_ACTIONS = {
  /** Build an electrical circuit from the current panel + fixture selection. */
  create: 'mepCircuit.actions.create',
  /** Clear the selection (dismiss the contextual tab). */
  close: 'mepCircuit.actions.close',
  /** ADR-408 Φ6 — add the selected fixtures to the active circuit. */
  addMembers: 'mepCircuit.actions.addMembers',
  /** ADR-408 Φ6 — remove the selected member fixtures from the active circuit. */
  removeMembers: 'mepCircuit.actions.removeMembers',
  /** ADR-408 Φ10 — auto-derive pipe networks from physical connectivity (whole scene). */
  deriveNetworks: 'mepCircuit.actions.deriveNetworks',
} as const;

/** Type guard used by the `useRibbonCommands` composer. */
export const isMepCircuitActionKey = makeKeySetGuard(
  Object.values(MEP_CIRCUIT_RIBBON_ACTIONS),
);
