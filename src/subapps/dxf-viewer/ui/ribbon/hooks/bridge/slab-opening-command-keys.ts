/**
 * ADR-363 Phase 3.7 — Slab-opening contextual ribbon command-key registry.
 *
 * Centralizes τα `commandKey` strings που μοιράζονται μεταξύ ribbon data
 * declaration (`contextual-slab-opening-tab.ts`) και bridge mappings
 * (`useRibbonSlabOpeningBridge`). Mirrors `SLAB_RIBBON_KEYS` pattern.
 */

export const SLAB_OPENING_RIBBON_KEYS = {
  stringParams: {
    /** Slab-opening kind (shaft / well / duct / chimney). */
    kind: 'slabOpening.params.kind',
  },
} as const;

export type SlabOpeningRibbonStringCommandKey =
  typeof SLAB_OPENING_RIBBON_KEYS.stringParams.kind;

export const SLAB_OPENING_RIBBON_STRING_KEYS: readonly SlabOpeningRibbonStringCommandKey[] = [
  SLAB_OPENING_RIBBON_KEYS.stringParams.kind,
];

export const SLAB_OPENING_RIBBON_KEYS_ACTIONS = {
  close: 'slabOpening.actions.close',
  delete: 'slabOpening.actions.delete',
} as const;

const SLAB_OPENING_ACTION_KEY_SET: ReadonlySet<string> = new Set<string>(
  Object.values(SLAB_OPENING_RIBBON_KEYS_ACTIONS),
);

export function isSlabOpeningActionKey(action: string): boolean {
  return SLAB_OPENING_ACTION_KEY_SET.has(action);
}

/** Visibility key (red badge when `validation.hasCodeViolations === true`). */
export const SLAB_OPENING_RIBBON_BADGE_KEYS = {
  violations: 'slabOpening.badge.violations',
} as const;

// ─── Type guards (used by useRibbonCommands composer) ────────────────────────

const SLAB_OPENING_STRING_KEY_SET: ReadonlySet<string> = new Set<string>(
  SLAB_OPENING_RIBBON_STRING_KEYS,
);

export function isSlabOpeningRibbonStringKey(commandKey: string): boolean {
  return SLAB_OPENING_STRING_KEY_SET.has(commandKey);
}
