/**
 * ADR-415 — Floorplan-symbol contextual ribbon command-key registry.
 *
 * Centralizes the `commandKey` strings shared between the ribbon data declaration
 * (`contextual-floorplan-symbol-tab.ts`) and the bridge mappings
 * (`useRibbonFloorplanSymbolBridge`). Mirrors `FURNITURE_RIBBON_KEYS`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-415-2d-floorplan-symbol-library.md
 */

import { makeKeySetGuard } from './make-key-set-guard';

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

export const isFloorplanSymbolRibbonKey = makeKeySetGuard([
  FLOORPLAN_SYMBOL_RIBBON_KEYS.params.rotation,
]);

export const isFloorplanSymbolRibbonStringKey = makeKeySetGuard([
  FLOORPLAN_SYMBOL_RIBBON_KEYS.stringParams.assetId,
]);
