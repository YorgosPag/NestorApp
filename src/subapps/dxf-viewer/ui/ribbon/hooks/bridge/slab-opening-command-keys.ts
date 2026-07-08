/**
 * ADR-363 Phase 3.7 — Slab-opening contextual ribbon command-key registry.
 *
 * Centralizes τα `commandKey` strings που μοιράζονται μεταξύ ribbon data
 * declaration (`contextual-slab-opening-tab.ts`) και bridge mappings
 * (`useRibbonSlabOpeningBridge`). Mirrors `SLAB_RIBBON_KEYS` pattern.
 */

import { makeKeySetGuard } from './make-key-set-guard';

export const SLAB_OPENING_RIBBON_KEYS = {
  stringParams: {
    /** Slab-opening kind (shaft / well / duct / chimney). */
    kind: 'slabOpening.params.kind',
    /** ADR-363 Phase 3.7b — Fire rating (60 / 90 / 120 min). Stored as number in params. */
    fireRating: 'slabOpening.params.fireRating',
  },
} as const;

export type SlabOpeningRibbonStringCommandKey =
  | typeof SLAB_OPENING_RIBBON_KEYS.stringParams.kind
  | typeof SLAB_OPENING_RIBBON_KEYS.stringParams.fireRating;

export const SLAB_OPENING_RIBBON_STRING_KEYS: readonly SlabOpeningRibbonStringCommandKey[] = [
  SLAB_OPENING_RIBBON_KEYS.stringParams.kind,
  SLAB_OPENING_RIBBON_KEYS.stringParams.fireRating,
];

export const SLAB_OPENING_RIBBON_KEYS_ACTIONS = {
  close: 'slabOpening.actions.close',
  delete: 'slabOpening.actions.delete',
  copyToFloors: 'slabOpening.actions.copyToFloors',
} as const;

export const isSlabOpeningActionKey = makeKeySetGuard(Object.values(SLAB_OPENING_RIBBON_KEYS_ACTIONS));

/** Visibility key (red badge when `validation.hasCodeViolations === true`). */
export const SLAB_OPENING_RIBBON_BADGE_KEYS = {
  violations: 'slabOpening.badge.violations',
} as const;

// ─── Type guards (used by useRibbonCommands composer) ────────────────────────

export const isSlabOpeningRibbonStringKey = makeKeySetGuard(SLAB_OPENING_RIBBON_STRING_KEYS);
