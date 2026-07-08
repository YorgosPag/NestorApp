/**
 * ADR-431 Slice 2 — electrical-WEAK (ασθενή) auto-design ribbon command-key registry.
 *
 * Centralizes the action `commandKey` strings shared between the ribbon data declaration
 * (`home-tab-draw.ts` → «Αυτόματα Ασθενή» submenu) and the bridge
 * (`useRibbonElectricalWeakAutoBridge`). Mirrors `ELECTRICAL_AUTO_RIBBON_ACTIONS`.
 *
 * Revit "Generate → review → accept": `generate` runs recognition + channel design and shows
 * the proposal ghost; `accept` commits the channels as MepSystems; `reject` discards them.
 */

import { makeKeySetGuard } from './make-key-set-guard';

export const ELECTRICAL_WEAK_AUTO_RIBBON_ACTIONS = {
  /** Recognize the storey + auto-design the data/controls channels → proposal ghost. */
  generate: 'electricalWeakAuto.actions.generate',
  /** Commit the reviewed channels as MepSystems (single undo). */
  accept: 'electricalWeakAuto.actions.accept',
  /** Discard the proposal under review (no scene/Firestore change). */
  reject: 'electricalWeakAuto.actions.reject',
} as const;

/** Type guard used by the `useRibbonCommands` composer. */
export const isElectricalWeakAutoActionKey = makeKeySetGuard(
  Object.values(ELECTRICAL_WEAK_AUTO_RIBBON_ACTIONS),
);
