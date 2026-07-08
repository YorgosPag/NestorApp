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

import { makeKeySetGuard } from './make-key-set-guard';

export const FIRE_AUTO_RIBBON_ACTIONS = {
  /** Recognize the storey + auto-design the wet-pipe sprinkler network → proposal ghost. */
  generate: 'fireAuto.actions.generate',
  /** Commit the reviewed proposal to real pipe segments + a pipe-network MepSystem (single undo). */
  accept: 'fireAuto.actions.accept',
  /** Discard the proposal under review (no scene/Firestore change). */
  reject: 'fireAuto.actions.reject',
} as const;

/** Type guard used by the `useRibbonCommands` composer. */
export const isFireAutoActionKey = makeKeySetGuard(
  Object.values(FIRE_AUTO_RIBBON_ACTIONS),
);
