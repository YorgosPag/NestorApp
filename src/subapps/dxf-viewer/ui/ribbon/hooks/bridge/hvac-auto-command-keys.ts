/**
 * ADR-432 Slice 2 — HVAC (ventilation) auto-design ribbon command-key registry.
 *
 * Centralizes the action `commandKey` strings shared between the ribbon data
 * declaration (`home-tab-draw.ts` → «Αυτόματος Αερισμός» submenu) and the bridge
 * (`useRibbonHvacAutoBridge`). Mirrors `HEATING_AUTO_RIBBON_ACTIONS`.
 *
 * Revit "Generate → review → accept": `generate` runs recognition + design and
 * shows the proposal ghost; `accept` commits it to real entities; `reject`
 * discards it.
 */

import { makeKeySetGuard } from './make-key-set-guard';

export const HVAC_AUTO_RIBBON_ACTIONS = {
  /** Recognize the storey + auto-design the supply-air duct network → proposal ghost. */
  generate: 'hvacAuto.actions.generate',
  /** Commit the reviewed proposal to real duct segments + a duct-network MepSystem (single undo). */
  accept: 'hvacAuto.actions.accept',
  /** Discard the proposal under review (no scene/Firestore change). */
  reject: 'hvacAuto.actions.reject',
} as const;

/** Type guard used by the `useRibbonCommands` composer. */
export const isHvacAutoActionKey = makeKeySetGuard(Object.values(HVAC_AUTO_RIBBON_ACTIONS));
