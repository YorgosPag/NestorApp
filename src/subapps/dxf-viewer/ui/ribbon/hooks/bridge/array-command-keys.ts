/**
 * ADR-353 Phase A — Array contextual ribbon command-key registry.
 *
 * Centralizes the `commandKey` strings shared between the ribbon data
 * declaration (`contextual-array-tab.ts`) and the bridge mappings
 * (`useRibbonArrayBridge`). Mirrors `TEXT_RIBBON_KEYS` pattern from
 * the text editor bridge.
 */

export const ARRAY_RIBBON_KEYS = {
  params: {
    rows: 'array.params.rows',
    cols: 'array.params.cols',
    rowSpacing: 'array.params.rowSpacing',
    colSpacing: 'array.params.colSpacing',
    angle: 'array.params.angle',
  },
} as const;

export type ArrayRibbonKey =
  | typeof ARRAY_RIBBON_KEYS.params.rows
  | typeof ARRAY_RIBBON_KEYS.params.cols
  | typeof ARRAY_RIBBON_KEYS.params.rowSpacing
  | typeof ARRAY_RIBBON_KEYS.params.colSpacing
  | typeof ARRAY_RIBBON_KEYS.params.angle;

const ALL_ARRAY_KEYS: ReadonlySet<string> = new Set<string>([
  ARRAY_RIBBON_KEYS.params.rows,
  ARRAY_RIBBON_KEYS.params.cols,
  ARRAY_RIBBON_KEYS.params.rowSpacing,
  ARRAY_RIBBON_KEYS.params.colSpacing,
  ARRAY_RIBBON_KEYS.params.angle,
]);

export function isArrayRibbonKey(key: string): key is ArrayRibbonKey {
  return ALL_ARRAY_KEYS.has(key);
}
