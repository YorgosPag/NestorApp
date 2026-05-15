/**
 * ADR-353 Phase A/B/C — Array contextual ribbon command-key registry.
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
    // Path (Phase C) — numeric
    pathCount: 'array.params.pathCount',
    pathSpacing: 'array.params.pathSpacing',
  },
  stringParams: {
    // Path (Phase C) — string-valued
    pathMethod: 'array.params.pathMethod',
  },
  toggles: {
    // Polar (Phase B)
    polarRotateItems: 'array.toggles.polarRotateItems',
    // Path (Phase C)
    pathAlignItems: 'array.toggles.pathAlignItems',
    pathReversed: 'array.toggles.pathReversed',
  },
  actions: {
    // Polar (Phase B)
    polarPickCenter: 'array.actions.polarPickCenter',
    // Path (Phase C)
    pathPickPath: 'array.actions.pathPickPath',
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
  | typeof ARRAY_RIBBON_KEYS.params.polarRadius
  | typeof ARRAY_RIBBON_KEYS.params.pathCount
  | typeof ARRAY_RIBBON_KEYS.params.pathSpacing;

export type ArrayRibbonToggleKey =
  | typeof ARRAY_RIBBON_KEYS.toggles.polarRotateItems
  | typeof ARRAY_RIBBON_KEYS.toggles.pathAlignItems
  | typeof ARRAY_RIBBON_KEYS.toggles.pathReversed;

export type ArrayRibbonStringComboKey =
  | typeof ARRAY_RIBBON_KEYS.stringParams.pathMethod;

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
  ARRAY_RIBBON_KEYS.params.pathCount,
  ARRAY_RIBBON_KEYS.params.pathSpacing,
]);

const ALL_ARRAY_TOGGLE_KEYS: ReadonlySet<string> = new Set<string>([
  ARRAY_RIBBON_KEYS.toggles.polarRotateItems,
  ARRAY_RIBBON_KEYS.toggles.pathAlignItems,
  ARRAY_RIBBON_KEYS.toggles.pathReversed,
]);

const ALL_ARRAY_STRING_COMBO_KEYS: ReadonlySet<string> = new Set<string>([
  ARRAY_RIBBON_KEYS.stringParams.pathMethod,
]);

export function isArrayRibbonKey(key: string): key is ArrayRibbonComboKey {
  return ALL_ARRAY_COMBO_KEYS.has(key);
}

export function isArrayRibbonStringKey(key: string): key is ArrayRibbonStringComboKey {
  return ALL_ARRAY_STRING_COMBO_KEYS.has(key);
}

export function isArrayRibbonToggleKey(
  key: string,
): key is ArrayRibbonToggleKey {
  return ALL_ARRAY_TOGGLE_KEYS.has(key);
}
