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
import { catalogOptions, literalNumberOptions } from './ribbon-numeric-options';

export const FLOORPLAN_SYMBOL_CONTEXTUAL_TRIGGER = 'floorplan-symbol-tool-active';

/**
 * Catalog options GENERATED from the SSoT (never hand-listed). ADR-408 Φ14 (A1):
 * the sanitary symbols (WC/washbasin/…) migrated to connectable `mep-fixture`
 * kinds (ribbon «Είδη Υγιεινής»), so they are filtered OUT of this 2D-only picker —
 * one canonical sanitary representation (Revit). Kitchen/furniture remain.
 */
const CATALOG_OPTIONS = catalogOptions(FLOORPLAN_SYMBOL_CATALOG.filter((p) => p.category !== 'sanitary'));

const ROTATION_DEG_OPTIONS = literalNumberOptions([0, 45, 90, 135, 180, 225, 270, 315]);

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
