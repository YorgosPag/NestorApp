/**
 * Shared IFC Pset action key (ADR-369 §9 Q8.2).
 *
 * Single SSoT for the `bim.pset.open` ribbon action — imported by every
 * BIM entity bridge that needs to handle the "open Pset editor" action.
 * Mirrors the per-entity `WALL_RIBBON_KEYS_ACTIONS` / `COLUMN_RIBBON_KEYS_ACTIONS`
 * pattern but is shared across all entity types since the behaviour is identical.
 */

export const PSET_RIBBON_ACTION = 'bim.pset.open' as const;
export type PsetRibbonAction = typeof PSET_RIBBON_ACTION;
