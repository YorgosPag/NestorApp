/**
 * ADR-430 Slice 2 — electrical-strong auto-design ribbon command-key registry.
 *
 * Centralizes the action `commandKey` strings shared between the ribbon data declaration
 * (`home-tab-draw.ts` → «Αυτόματος Ηλεκτρολογικός» submenu) and the bridge
 * (`useRibbonElectricalAutoBridge`). Mirrors `HEATING_AUTO_RIBBON_ACTIONS`.
 *
 * Revit "Generate → review → accept": `generate` runs recognition + circuit design and shows
 * the proposal ghost; `accept` commits the circuits as MepSystems; `reject` discards them.
 */

export const ELECTRICAL_AUTO_RIBBON_ACTIONS = {
  /** Recognize the storey + auto-design the lighting/socket circuits → proposal ghost. */
  generate: 'electricalAuto.actions.generate',
  /** Commit the reviewed circuits as MepSystems (single undo). */
  accept: 'electricalAuto.actions.accept',
  /** Discard the proposal under review (no scene/Firestore change). */
  reject: 'electricalAuto.actions.reject',
} as const;

const ELECTRICAL_AUTO_ACTION_KEY_SET: ReadonlySet<string> = new Set<string>(
  Object.values(ELECTRICAL_AUTO_RIBBON_ACTIONS),
);

/** Type guard used by the `useRibbonCommands` composer. */
export function isElectricalAutoActionKey(action: string): boolean {
  return ELECTRICAL_AUTO_ACTION_KEY_SET.has(action);
}
