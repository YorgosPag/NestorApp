/**
 * ADR-427 Slice 2 — sanitary-drainage auto-design ribbon command-key registry.
 *
 * Centralizes the action `commandKey` strings shared between the ribbon data
 * declaration (`home-tab-draw.ts` → «Αυτόματη Αποχέτευση» submenu) and the bridge
 * (`useRibbonDrainageAutoBridge`). Mirrors `WATER_SUPPLY_RIBBON_ACTIONS`.
 *
 * Revit "Generate → review → accept": `generate` runs recognition + design and
 * shows the proposal ghost; `accept` commits it to real entities; `reject`
 * discards it.
 */

import { makeKeySetGuard } from './make-key-set-guard';

export const DRAINAGE_AUTO_RIBBON_ACTIONS = {
  /** Recognize the storey + auto-design the gravity drainage network → proposal ghost. */
  generate: 'drainageAuto.actions.generate',
  /** Commit the reviewed proposal to real sloped segments + a MepSystem (single undo). */
  accept: 'drainageAuto.actions.accept',
  /** Discard the proposal under review (no scene/Firestore change). */
  reject: 'drainageAuto.actions.reject',
} as const;

/** Type guard used by the `useRibbonCommands` composer. */
export const isDrainageAutoActionKey = makeKeySetGuard(
  Object.values(DRAINAGE_AUTO_RIBBON_ACTIONS),
);
