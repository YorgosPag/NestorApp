/**
 * ADR-434 Slice 2 — Gas (φυσικό αέριο) auto-design ribbon command-key registry.
 *
 * Centralizes the action `commandKey` strings shared between the ribbon data declaration
 * (`home-tab-draw.ts` → «Αυτόματο Αέριο» submenu) and the bridge (`useRibbonGasAutoBridge`).
 * Mirrors `HVAC_AUTO_RIBBON_ACTIONS`.
 *
 * Revit "Generate → review → accept": `generate` runs recognition + design and shows the
 * proposal ghost; `accept` commits it to real entities; `reject` discards it.
 */

export const GAS_AUTO_RIBBON_ACTIONS = {
  /** Recognize the storey + auto-design the fuel-gas supply network → proposal ghost. */
  generate: 'gasAuto.actions.generate',
  /** Commit the reviewed proposal to real fuel segments + a fuel-network MepSystem (single undo). */
  accept: 'gasAuto.actions.accept',
  /** Discard the proposal under review (no scene/Firestore change). */
  reject: 'gasAuto.actions.reject',
} as const;

const GAS_AUTO_ACTION_KEY_SET: ReadonlySet<string> = new Set<string>(
  Object.values(GAS_AUTO_RIBBON_ACTIONS),
);

/** Type guard used by the `useRibbonCommands` composer. */
export function isGasAutoActionKey(action: string): boolean {
  return GAS_AUTO_ACTION_KEY_SET.has(action);
}
