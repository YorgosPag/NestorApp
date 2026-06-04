/**
 * ADR-415 — Floorplan-symbol contextual ribbon command-key registry.
 *
 * Centralizes the `commandKey` strings shared between the ribbon data declaration
 * (`contextual-floorplan-symbol-tab.ts`) and the bridge mappings
 * (`useRibbonFloorplanSymbolBridge`). Mirrors `FURNITURE_RIBBON_KEYS`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-415-2d-floorplan-symbol-library.md
 */

export const FLOORPLAN_SYMBOL_RIBBON_KEYS = {
  stringParams: {
    /** Catalog asset selector (which symbol to place). */
    assetId: 'floorplanSymbol.params.assetId',
  },
  params: {
    /** deg — plan rotation about the insertion point. */
    rotation: 'floorplanSymbol.params.rotation',
  },
} as const;

export type FloorplanSymbolRibbonNumberCommandKey =
  | typeof FLOORPLAN_SYMBOL_RIBBON_KEYS.params.rotation;

export type FloorplanSymbolRibbonStringCommandKey =
  | typeof FLOORPLAN_SYMBOL_RIBBON_KEYS.stringParams.assetId;

const NUMBER_KEY_SET: ReadonlySet<string> = new Set<string>([
  FLOORPLAN_SYMBOL_RIBBON_KEYS.params.rotation,
]);
const STRING_KEY_SET: ReadonlySet<string> = new Set<string>([
  FLOORPLAN_SYMBOL_RIBBON_KEYS.stringParams.assetId,
]);

export function isFloorplanSymbolRibbonKey(commandKey: string): boolean {
  return NUMBER_KEY_SET.has(commandKey);
}

export function isFloorplanSymbolRibbonStringKey(commandKey: string): boolean {
  return STRING_KEY_SET.has(commandKey);
}
