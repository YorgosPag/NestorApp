/**
 * ADR-433 Slice 2 — Fire-protection (sprinkler) auto-design ribbon command-key registry.
 *
 * Centralizes the action `commandKey` strings shared between the ribbon data declaration
 * (`home-tab-draw.ts` → «Αυτόματη Πυρόσβεση» submenu) and the bridge
 * (`useRibbonFireAutoBridge`). Mirrors `HVAC_AUTO_RIBBON_ACTIONS`.
 *
 * Revit "Generate → review → accept": `generate` runs recognition + design and shows the
 * proposal ghost; `accept` commits it to real entities; `reject` discards it.
 */

export const FIRE_AUTO_RIBBON_ACTIONS = {
  /** Recognize the storey + auto-design the wet-pipe sprinkler network → proposal ghost. */
  generate: 'fireAuto.actions.generate',
  /** Commit the reviewed proposal to real pipe segments + a pipe-network MepSystem (single undo). */
  accept: 'fireAuto.actions.accept',
  /** Discard the proposal under review (no scene/Firestore change). */
  reject: 'fireAuto.actions.reject',
} as const;

const FIRE_AUTO_ACTION_KEY_SET: ReadonlySet<string> = new Set<string>(
  Object.values(FIRE_AUTO_RIBBON_ACTIONS),
);

/** Type guard used by the `useRibbonCommands` composer. */
export function isFireAutoActionKey(action: string): boolean {
  return FIRE_AUTO_ACTION_KEY_SET.has(action);
}
