'use client';

/**
 * ADR-415 — Bridge between the contextual floorplan-symbol ribbon tab and the
 * active placement tool (`floorplanSymbolToolBridgeStore`).
 *
 * Drawing-mode ONLY (mirror of the furniture bridge): the symbol is placed via the
 * tool, so the ribbon reads/writes the tool handle. Picking a catalog symbol →
 * `setAssetId`; rotation → `setParamOverrides`. The next click places the chosen
 * symbol with the chosen rotation.
 *
 * No-ops for commandKeys outside `FLOORPLAN_SYMBOL_RIBBON_KEYS` so it composes with
 * the other bridges in `useRibbonCommands`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-415-2d-floorplan-symbol-library.md
 */

import { floorplanSymbolToolBridgeStore } from './bridge/floorplan-symbol-tool-bridge-store';
import {
  FLOORPLAN_SYMBOL_RIBBON_KEYS,
  isFloorplanSymbolRibbonKey,
} from './bridge/floorplan-symbol-command-keys';
import { FLOORPLAN_SYMBOL_CATALOG } from '../../../bim/floorplan-symbols/floorplan-symbol-catalog';
import type { RibbonEntityBridgeCore } from './ribbon-entity-bridge-shared';
import { useToolHandleBridge } from './ribbon-tool-handle-bridge-shared';

export type RibbonFloorplanSymbolBridge = RibbonEntityBridgeCore;

/** Catalog options GENERATED from the SSoT (never hand-listed). */
const CATALOG_OPTIONS = FLOORPLAN_SYMBOL_CATALOG.map((p) => ({
  value: p.id,
  labelKey: p.labelKey,
  isLiteralLabel: false,
}));

/** commandKey → numeric override field on FloorplanSymbolParamOverrides. */
const NUMBER_KEY_TO_OVERRIDE: Readonly<Record<string, string>> = {
  [FLOORPLAN_SYMBOL_RIBBON_KEYS.params.rotation]: 'rotationDeg',
};

export function useRibbonFloorplanSymbolBridge(): RibbonFloorplanSymbolBridge {
  // Subscribe to the tool handle so the ribbon re-renders on tool state changes.
  const toolHandle = floorplanSymbolToolBridgeStore.use();

  return useToolHandleBridge({
    toolHandle,
    readImperative: () => floorplanSymbolToolBridgeStore.get(),
    assetIdKey: FLOORPLAN_SYMBOL_RIBBON_KEYS.stringParams.assetId,
    buildOptions: () => CATALOG_OPTIONS,
    numberKeyToField: NUMBER_KEY_TO_OVERRIDE,
  });
}

/** Type guard used by `useRibbonCommands` composer (no visibility keys). */
export function isFloorplanSymbolPanelVisibilityKey(_visibilityKey: string): boolean {
  return false;
}

export { isFloorplanSymbolRibbonKey };
