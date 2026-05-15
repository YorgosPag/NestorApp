/**
 * ADR-353 Phase A/B — Array contextual ribbon command-key registry.
 *
 * Centralizes the `commandKey` strings shared between the ribbon data
 * declaration (`contextual-array-tab.ts`) and the bridge mappings
 * (`useRibbonArrayBridge`). Mirrors `TEXT_RIBBON_KEYS` pattern from
 * the text editor bridge.
 */

export const ARRAY_RIBBON_KEYS = {
  params: {
    // Rect (Phase A)
    rows: 'array.params.rows',
    cols: 'array.params.cols',
    rowSpacing: 'array.params.rowSpacing',
    colSpacing: 'array.params.colSpacing',
    angle: 'array.params.angle',
    // Polar (Phase B)
    polarCount: 'array.params.polarCount',
    polarFillAngle: 'array.params.polarFillAngle',
    polarStartAngle: 'array.params.polarStartAngle',
    polarRadius: 'array.params.polarRadius',
  },
  toggles: {
    // Polar (Phase B)
    polarRotateItems: 'array.toggles.polarRotateItems',
  },
  actions: {
    // Polar (Phase B)
    polarPickCenter: 'array.actions.polarPickCenter',
  },
} as const;

export type ArrayRibbonComboKey =
  | typeof ARRAY_RIBBON_KEYS.params.rows
  | typeof ARRAY_RIBBON_KEYS.params.cols
  | typeof ARRAY_RIBBON_KEYS.params.rowSpacing
  | typeof ARRAY_RIBBON_KEYS.params.colSpacing
  | typeof ARRAY_RIBBON_KEYS.params.angle
  | typeof ARRAY_RIBBON_KEYS.params.polarCount
  | typeof ARRAY_RIBBON_KEYS.params.polarFillAngle
  | typeof ARRAY_RIBBON_KEYS.params.polarStartAngle
  | typeof ARRAY_RIBBON_KEYS.params.polarRadius;

export type ArrayRibbonToggleKey =
  | typeof ARRAY_RIBBON_KEYS.toggles.polarRotateItems;

/** @deprecated Phase A alias — use {@link ArrayRibbonComboKey}. */
export type ArrayRibbonKey = ArrayRibbonComboKey;

const ALL_ARRAY_COMBO_KEYS: ReadonlySet<string> = new Set<string>([
  ARRAY_RIBBON_KEYS.params.rows,
  ARRAY_RIBBON_KEYS.params.cols,
  ARRAY_RIBBON_KEYS.params.rowSpacing,
  ARRAY_RIBBON_KEYS.params.colSpacing,
  ARRAY_RIBBON_KEYS.params.angle,
  ARRAY_RIBBON_KEYS.params.polarCount,
  ARRAY_RIBBON_KEYS.params.polarFillAngle,
  ARRAY_RIBBON_KEYS.params.polarStartAngle,
  ARRAY_RIBBON_KEYS.params.polarRadius,
]);

const ALL_ARRAY_TOGGLE_KEYS: ReadonlySet<string> = new Set<string>([
  ARRAY_RIBBON_KEYS.toggles.polarRotateItems,
]);

export function isArrayRibbonKey(key: string): key is ArrayRibbonComboKey {
  return ALL_ARRAY_COMBO_KEYS.has(key);
}

export function isArrayRibbonToggleKey(
  key: string,
): key is ArrayRibbonToggleKey {
  return ALL_ARRAY_TOGGLE_KEYS.has(key);
}
