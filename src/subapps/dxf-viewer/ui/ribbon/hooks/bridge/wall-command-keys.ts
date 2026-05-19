/**
 * ADR-363 Phase 1 — Wall contextual ribbon command-key registry.
 *
 * Centralizes the `commandKey` strings shared between the ribbon data
 * declaration (`contextual-wall-tab.ts`) and the bridge mappings (Phase 1.5
 * `useRibbonWallBridge`). Mirrors `STAIR_RIBBON_KEYS` pattern.
 *
 * Phase 1 wires only the keys needed by the contextual tab. Bridge listener
 * implementation lands Phase 1.5 when wall update operations exist; until
 * then the events are emitted but no-op.
 */

export const WALL_RIBBON_KEYS = {
  stringParams: {
    /** Wall category selector (5 options: exterior/interior/partition/parapet/fence). */
    category: 'wall.params.category',
    /** Material key (rc/masonry/aerated-concrete/gypsum). DNA walls ignore this. */
    material: 'wall.params.material',
  },
  params: {
    /** mm — wall height. */
    height: 'wall.params.height',
    /** mm — wall thickness (read-only display when dna present; SSoT = dna.totalThickness). */
    thickness: 'wall.params.thickness',
  },
  toggles: {
    /** Exterior-face flip selector. */
    flip: 'wall.params.flip',
  },
} as const;

export type WallRibbonNumberCommandKey =
  | typeof WALL_RIBBON_KEYS.params.height
  | typeof WALL_RIBBON_KEYS.params.thickness;

export type WallRibbonStringCommandKey =
  | typeof WALL_RIBBON_KEYS.stringParams.category
  | typeof WALL_RIBBON_KEYS.stringParams.material;

export type WallRibbonToggleCommandKey =
  | typeof WALL_RIBBON_KEYS.toggles.flip;

export const WALL_RIBBON_NUMBER_KEYS: readonly WallRibbonNumberCommandKey[] = [
  WALL_RIBBON_KEYS.params.height,
  WALL_RIBBON_KEYS.params.thickness,
];

export const WALL_RIBBON_STRING_KEYS: readonly WallRibbonStringCommandKey[] = [
  WALL_RIBBON_KEYS.stringParams.category,
  WALL_RIBBON_KEYS.stringParams.material,
];

export const WALL_RIBBON_TOGGLE_KEYS: readonly WallRibbonToggleCommandKey[] = [
  WALL_RIBBON_KEYS.toggles.flip,
];

export const WALL_RIBBON_KEYS_ACTIONS = {
  close: 'wall.actions.close',
  delete: 'wall.actions.delete',
} as const;

const WALL_ACTION_KEY_SET: ReadonlySet<string> = new Set<string>(
  Object.values(WALL_RIBBON_KEYS_ACTIONS),
);

export function isWallActionKey(action: string): boolean {
  return WALL_ACTION_KEY_SET.has(action);
}

/** Visibility key (red badge when `validation.hasCodeViolations === true`). */
export const WALL_RIBBON_BADGE_KEYS = {
  violations: 'wall.badge.violations',
} as const;

// ─── Type guards (used by useRibbonCommands composer) ────────────────────────

const WALL_NUMBER_KEY_SET: ReadonlySet<string> = new Set<string>(WALL_RIBBON_NUMBER_KEYS);
const WALL_STRING_KEY_SET: ReadonlySet<string> = new Set<string>(WALL_RIBBON_STRING_KEYS);
const WALL_TOGGLE_KEY_SET: ReadonlySet<string> = new Set<string>(WALL_RIBBON_TOGGLE_KEYS);

export function isWallRibbonKey(commandKey: string): boolean {
  return WALL_NUMBER_KEY_SET.has(commandKey);
}

export function isWallRibbonStringKey(commandKey: string): boolean {
  return WALL_STRING_KEY_SET.has(commandKey);
}

export function isWallRibbonToggleKey(commandKey: string): boolean {
  return WALL_TOGGLE_KEY_SET.has(commandKey);
}
