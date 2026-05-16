/**
 * ADR-358 Phase 7a — Stair contextual ribbon command-key registry.
 *
 * Centralizes the `commandKey` strings shared between the ribbon data
 * declaration (`contextual-stair-tab.ts`) and the bridge mappings
 * (`useRibbonStairBridge`). Mirrors `ARRAY_RIBBON_KEYS` pattern from
 * the array editor bridge.
 */

export const STAIR_RIBBON_KEYS = {
  stringParams: {
    structureType: 'stair.params.structureType',
    riserType: 'stair.params.riserType',
  },
  params: {
    rise: 'stair.params.rise',
    tread: 'stair.params.tread',
    width: 'stair.params.width',
    stepCount: 'stair.params.stepCount',
    storyCount: 'stair.params.storyCount',
    storyHeight: 'stair.params.storyHeight',
  },
  actions: {
    close: 'stair.actions.close',
  },
} as const;

export type StairRibbonComboKey =
  | typeof STAIR_RIBBON_KEYS.params.rise
  | typeof STAIR_RIBBON_KEYS.params.tread
  | typeof STAIR_RIBBON_KEYS.params.width
  | typeof STAIR_RIBBON_KEYS.params.stepCount
  | typeof STAIR_RIBBON_KEYS.params.storyCount
  | typeof STAIR_RIBBON_KEYS.params.storyHeight;

export type StairRibbonStringComboKey =
  | typeof STAIR_RIBBON_KEYS.stringParams.structureType
  | typeof STAIR_RIBBON_KEYS.stringParams.riserType;

const ALL_STAIR_COMBO_KEYS: ReadonlySet<string> = new Set<string>([
  STAIR_RIBBON_KEYS.params.rise,
  STAIR_RIBBON_KEYS.params.tread,
  STAIR_RIBBON_KEYS.params.width,
  STAIR_RIBBON_KEYS.params.stepCount,
  STAIR_RIBBON_KEYS.params.storyCount,
  STAIR_RIBBON_KEYS.params.storyHeight,
]);

const ALL_STAIR_STRING_COMBO_KEYS: ReadonlySet<string> = new Set<string>([
  STAIR_RIBBON_KEYS.stringParams.structureType,
  STAIR_RIBBON_KEYS.stringParams.riserType,
]);

export function isStairRibbonKey(key: string): key is StairRibbonComboKey {
  return ALL_STAIR_COMBO_KEYS.has(key);
}

export function isStairRibbonStringKey(key: string): key is StairRibbonStringComboKey {
  return ALL_STAIR_STRING_COMBO_KEYS.has(key);
}
