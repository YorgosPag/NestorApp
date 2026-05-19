/**
 * ADR-363 Phase 3 — Slab contextual ribbon command-key registry.
 *
 * Centralizes τα `commandKey` strings που μοιράζονται μεταξύ ribbon data
 * declaration (`contextual-slab-tab.ts`) και bridge mappings
 * (`useRibbonSlabBridge`). Mirrors `WALL_RIBBON_KEYS` / `OPENING_RIBBON_KEYS`
 * pattern.
 */

export const SLAB_RIBBON_KEYS = {
  stringParams: {
    /** Slab kind selector (5 options: floor/ceiling/roof/ground/foundation). */
    kind: 'slab.params.kind',
    /** Reinforcement hint (one-way / two-way / waffle / flat). */
    reinforcement: 'slab.params.reinforcement',
    /** Material key (rc / composite / wood). */
    material: 'slab.params.material',
  },
  params: {
    /** mm — slab thickness. */
    thickness: 'slab.params.thickness',
    /** mm — elevation από project origin. */
    elevation: 'slab.params.elevation',
  },
} as const;

export type SlabRibbonNumberCommandKey =
  | typeof SLAB_RIBBON_KEYS.params.thickness
  | typeof SLAB_RIBBON_KEYS.params.elevation;

export type SlabRibbonStringCommandKey =
  | typeof SLAB_RIBBON_KEYS.stringParams.kind
  | typeof SLAB_RIBBON_KEYS.stringParams.reinforcement
  | typeof SLAB_RIBBON_KEYS.stringParams.material;

export const SLAB_RIBBON_NUMBER_KEYS: readonly SlabRibbonNumberCommandKey[] = [
  SLAB_RIBBON_KEYS.params.thickness,
  SLAB_RIBBON_KEYS.params.elevation,
];

export const SLAB_RIBBON_STRING_KEYS: readonly SlabRibbonStringCommandKey[] = [
  SLAB_RIBBON_KEYS.stringParams.kind,
  SLAB_RIBBON_KEYS.stringParams.reinforcement,
  SLAB_RIBBON_KEYS.stringParams.material,
];

export const SLAB_RIBBON_KEYS_ACTIONS = {
  close: 'slab.actions.close',
  delete: 'slab.actions.delete',
} as const;

const SLAB_ACTION_KEY_SET: ReadonlySet<string> = new Set<string>(
  Object.values(SLAB_RIBBON_KEYS_ACTIONS),
);

export function isSlabActionKey(action: string): boolean {
  return SLAB_ACTION_KEY_SET.has(action);
}

/** Visibility key (red badge when `validation.hasCodeViolations === true`). */
export const SLAB_RIBBON_BADGE_KEYS = {
  violations: 'slab.badge.violations',
} as const;

// ─── Type guards (used by useRibbonCommands composer) ────────────────────────

const SLAB_NUMBER_KEY_SET: ReadonlySet<string> = new Set<string>(SLAB_RIBBON_NUMBER_KEYS);
const SLAB_STRING_KEY_SET: ReadonlySet<string> = new Set<string>(SLAB_RIBBON_STRING_KEYS);

export function isSlabRibbonKey(commandKey: string): boolean {
  return SLAB_NUMBER_KEY_SET.has(commandKey);
}

export function isSlabRibbonStringKey(commandKey: string): boolean {
  return SLAB_STRING_KEY_SET.has(commandKey);
}
