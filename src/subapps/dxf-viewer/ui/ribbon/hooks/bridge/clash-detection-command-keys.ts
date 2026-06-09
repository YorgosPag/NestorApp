/**
 * ADR-435 Slice 1 — clash-detection ribbon command-key registry.
 *
 * Centralizes the action `commandKey` strings shared between the ribbon data
 * declaration (`home-tab-draw.ts` → «Έλεγχος Συγκρούσεων» submenu) and the bridge
 * (`useRibbonClashDetectionBridge`). Mirror of `WATER_SUPPLY_RIBBON_ACTIONS`, but
 * read-only — `detect` runs the engine and shows the overlay; `clear` discards it.
 * There is NO `accept` (coordination output is never committed to entities in v1).
 */

export const CLASH_DETECTION_RIBBON_ACTIONS = {
  /** Run broad+narrow phase over the storey → clash report overlay. */
  detect: 'clashDetection.actions.detect',
  /** Discard the report under review (no scene change). */
  clear: 'clashDetection.actions.clear',
} as const;

const CLASH_DETECTION_ACTION_KEY_SET: ReadonlySet<string> = new Set<string>(
  Object.values(CLASH_DETECTION_RIBBON_ACTIONS),
);

/** Type guard used by the `useRibbonCommands` composer. */
export function isClashDetectionActionKey(action: string): boolean {
  return CLASH_DETECTION_ACTION_KEY_SET.has(action);
}
