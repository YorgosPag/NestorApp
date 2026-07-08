/**
 * ADR-435 Slice 1 — clash-detection ribbon command-key registry.
 *
 * Centralizes the action `commandKey` strings shared between the ribbon data
 * declaration (`home-tab-draw.ts` → «Έλεγχος Συγκρούσεων» submenu) and the bridge
 * (`useRibbonClashDetectionBridge`). Mirror of `WATER_SUPPLY_RIBBON_ACTIONS`, but
 * read-only — `detect` runs the engine and shows the overlay; `clear` discards it.
 * There is NO `accept` (coordination output is never committed to entities in v1).
 */

import { makeKeySetGuard } from './make-key-set-guard';

export const CLASH_DETECTION_RIBBON_ACTIONS = {
  /** Run broad+narrow phase over the storey → clash report overlay. */
  detect: 'clashDetection.actions.detect',
  /** Discard the report under review (no scene change). */
  clear: 'clashDetection.actions.clear',
} as const;

/** Type guard used by the `useRibbonCommands` composer. */
export const isClashDetectionActionKey = makeKeySetGuard(
  Object.values(CLASH_DETECTION_RIBBON_ACTIONS),
);
