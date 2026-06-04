/**
 * ADR-415 — Contextual ribbon tab for the floorplan symbol library.
 *
 * Trigger: `floorplan-symbol-tool-active` (dispatched from
 * `app/ribbon-contextual-config.ts` when `activeTool === 'floorplan-symbol'`).
 * Lets the user pick WHICH symbol to place + rotation before clicking, bound live
 * to `floorplanSymbolToolBridgeStore` via `useRibbonFloorplanSymbolBridge`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-415-2d-floorplan-symbol-library.md
 */

import type { RibbonTab } from '../types/ribbon-types';
import { FLOORPLAN_SYMBOL_RIBBON_KEYS } from '../hooks/bridge/floorplan-symbol-command-keys';
import { FLOORPLAN_SYMBOL_CATALOG } from '../../../bim/floorplan-symbols/floorplan-symbol-catalog';

export const FLOORPLAN_SYMBOL_CONTEXTUAL_TRIGGER = 'floorplan-symbol-tool-active';

/** Catalog options GENERATED from the SSoT (never hand-listed). */
const CATALOG_OPTIONS = FLOORPLAN_SYMBOL_CATALOG.map((p) => ({
  value: p.id,
  labelKey: p.labelKey,
  isLiteralLabel: false,
}));

const ROTATION_DEG_OPTIONS = [
  { value: '0', labelKey: '0', isLiteralLabel: true },
  { value: '45', labelKey: '45', isLiteralLabel: true },
  { value: '90', labelKey: '90', isLiteralLabel: true },
  { value: '135', labelKey: '135', isLiteralLabel: true },
  { value: '180', labelKey: '180', isLiteralLabel: true },
  { value: '225', labelKey: '225', isLiteralLabel: true },
  { value: '270', labelKey: '270', isLiteralLabel: true },
  { value: '315', labelKey: '315', isLiteralLabel: true },
] as const;

export const CONTEXTUAL_FLOORPLAN_SYMBOL_TAB: RibbonTab = {
  id: 'floorplan-symbol-editor',
  labelKey: 'ribbon.tabs.floorplanSymbolProperties',
  isContextual: true,
  contextualTrigger: FLOORPLAN_SYMBOL_CONTEXTUAL_TRIGGER,
  panels: [
    {
      id: 'floorplan-symbol-catalog',
      labelKey: 'ribbon.panels.floorplanSymbolCatalog',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'floorplanSymbol.asset',
                labelKey: 'ribbon.commands.floorplanSymbolEditor.asset',
                commandKey: FLOORPLAN_SYMBOL_RIBBON_KEYS.stringParams.assetId,
                comboboxWidthPx: 200,
                options: CATALOG_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'floorplan-symbol-geometry',
      labelKey: 'ribbon.panels.floorplanSymbolGeometry',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'floorplanSymbol.rotation',
                labelKey: 'ribbon.commands.floorplanSymbolEditor.rotation',
                commandKey: FLOORPLAN_SYMBOL_RIBBON_KEYS.params.rotation,
                comboboxWidthPx: 80,
                options: ROTATION_DEG_OPTIONS,
              },
            },
          ],
        },
      ],
    },
  ],
};
