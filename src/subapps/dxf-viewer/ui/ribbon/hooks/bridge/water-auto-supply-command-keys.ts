/**
 * ADR-426 Slice 2 — water-supply auto-design ribbon command-key registry.
 *
 * Centralizes the action `commandKey` strings shared between the ribbon data
 * declaration (`home-tab-draw.ts` → «Αυτόματη Ύδρευση» submenu) and the bridge
 * (`useRibbonWaterAutoSupplyBridge`). Mirrors `MEP_CIRCUIT_RIBBON_ACTIONS`.
 *
 * Revit "Generate → review → accept": `generate` runs recognition + design and
 * shows the proposal ghost; `accept` commits it to real entities; `reject`
 * discards it.
 */

import { makeKeySetGuard } from './make-key-set-guard';

export const WATER_SUPPLY_RIBBON_ACTIONS = {
  /** Recognize the storey + auto-design the cold/hot networks → proposal ghost. */
  generate: 'waterSupply.actions.generate',
  /** Commit the reviewed proposal to real segments + MepSystems (single undo). */
  accept: 'waterSupply.actions.accept',
  /** Discard the proposal under review (no scene/Firestore change). */
  reject: 'waterSupply.actions.reject',
} as const;

/** Type guard used by the `useRibbonCommands` composer. */
export const isWaterSupplyActionKey = makeKeySetGuard(Object.values(WATER_SUPPLY_RIBBON_ACTIONS));
