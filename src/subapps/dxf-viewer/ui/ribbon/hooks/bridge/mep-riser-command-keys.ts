/**
 * ADR-408 Φ15 Phase-2 — MEP riser (κατακόρυφη στήλη) TOOL-ACTIVE command-key
 * registry.
 *
 * Drives the «Κατακόρυφη Στήλη» contextual tab that lets the user set the Revit
 * base/top constraint (here: «Έως όροφο» — the base is the current floor) and
 * the pipe diameter before the single placement click. Mirrors
 * `MEP_FIXTURE_LIBRARY_KEYS` (the tool-active library pattern).
 *
 * `toFloor` carries a FLOOR id (string); `diameter` is a numeric DN (mm).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { makeKeySetGuard } from './make-key-set-guard';

export const MEP_RISER_RIBBON_KEYS = {
  stringParams: {
    /** Target floor id — the stack top («Έως όροφο»). */
    toFloor: 'mepRiser.params.toFloor',
  },
  params: {
    /** mm — pipe diameter (DN). */
    diameter: 'mepRiser.params.diameter',
  },
} as const;

export type MepRiserNumberCommandKey = typeof MEP_RISER_RIBBON_KEYS.params.diameter;
export type MepRiserStringCommandKey = typeof MEP_RISER_RIBBON_KEYS.stringParams.toFloor;

export const MEP_RISER_NUMBER_KEYS: readonly MepRiserNumberCommandKey[] = [
  MEP_RISER_RIBBON_KEYS.params.diameter,
];

export const MEP_RISER_STRING_KEYS: readonly MepRiserStringCommandKey[] = [
  MEP_RISER_RIBBON_KEYS.stringParams.toFloor,
];

// ─── Type guards (used by useRibbonCommands composer) ────────────────────────

export const isMepRiserKey = makeKeySetGuard(MEP_RISER_NUMBER_KEYS);
export const isMepRiserStringKey = makeKeySetGuard(MEP_RISER_STRING_KEYS);
