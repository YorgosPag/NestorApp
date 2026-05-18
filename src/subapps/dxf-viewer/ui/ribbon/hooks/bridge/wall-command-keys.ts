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
  | typeof WALL_RIBBON_KEYS.stringParams.category;

export type WallRibbonToggleCommandKey =
  | typeof WALL_RIBBON_KEYS.toggles.flip;

export const WALL_RIBBON_NUMBER_KEYS: readonly WallRibbonNumberCommandKey[] = [
  WALL_RIBBON_KEYS.params.height,
  WALL_RIBBON_KEYS.params.thickness,
];

export const WALL_RIBBON_STRING_KEYS: readonly WallRibbonStringCommandKey[] = [
  WALL_RIBBON_KEYS.stringParams.category,
];

export const WALL_RIBBON_TOGGLE_KEYS: readonly WallRibbonToggleCommandKey[] = [
  WALL_RIBBON_KEYS.toggles.flip,
];

export const WALL_RIBBON_KEYS_ACTIONS = {
  close: 'wall.actions.close',
} as const;

/** Visibility key (red badge when `validation.hasCodeViolations === true`). */
export const WALL_RIBBON_BADGE_KEYS = {
  violations: 'wall.badge.violations',
} as const;
