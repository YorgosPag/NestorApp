/**
 * ADR-428 Slice 2 — heating (hydronic) auto-design ribbon command-key registry.
 *
 * Centralizes the action `commandKey` strings shared between the ribbon data
 * declaration (`home-tab-draw.ts` → «Αυτόματη Θέρμανση» submenu) and the bridge
 * (`useRibbonHeatingAutoBridge`). Mirrors `DRAINAGE_AUTO_RIBBON_ACTIONS`.
 *
 * Revit "Generate → review → accept": `generate` runs recognition + design and
 * shows the proposal ghost; `accept` commits it to real entities; `reject`
 * discards it.
 */

export const HEATING_AUTO_RIBBON_ACTIONS = {
  /** Recognize the storey + auto-design the two-pipe heating loop → proposal ghost. */
  generate: 'heatingAuto.actions.generate',
  /** Commit the reviewed proposal to real flat segments + two MepSystems (single undo). */
  accept: 'heatingAuto.actions.accept',
  /** Discard the proposal under review (no scene/Firestore change). */
  reject: 'heatingAuto.actions.reject',
} as const;

const HEATING_AUTO_ACTION_KEY_SET: ReadonlySet<string> = new Set<string>(
  Object.values(HEATING_AUTO_RIBBON_ACTIONS),
);

/** Type guard used by the `useRibbonCommands` composer. */
export function isHeatingAutoActionKey(action: string): boolean {
  return HEATING_AUTO_ACTION_KEY_SET.has(action);
}
