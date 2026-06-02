/**
 * ADR-408 Φ5 — MEP circuit contextual ribbon command-key registry.
 *
 * Centralizes the action `commandKey` strings shared between the ribbon data
 * declaration (`contextual-mep-circuit-tab.ts`) and the bridge
 * (`useRibbonMepCircuitBridge`). Mirrors `BEAM_RIBBON_KEYS_ACTIONS` — this tab
 * is action-only (no per-field comboboxes in the opening slice).
 */

export const MEP_CIRCUIT_RIBBON_ACTIONS = {
  /** Build an electrical circuit from the current panel + fixture selection. */
  create: 'mepCircuit.actions.create',
  /** Clear the selection (dismiss the contextual tab). */
  close: 'mepCircuit.actions.close',
} as const;

const MEP_CIRCUIT_ACTION_KEY_SET: ReadonlySet<string> = new Set<string>(
  Object.values(MEP_CIRCUIT_RIBBON_ACTIONS),
);

/** Type guard used by the `useRibbonCommands` composer. */
export function isMepCircuitActionKey(action: string): boolean {
  return MEP_CIRCUIT_ACTION_KEY_SET.has(action);
}
