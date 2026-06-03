/**
 * ADR-410 — Contextual ribbon tab for the furniture library (έπιπλα).
 *
 * Trigger: `furniture-tool-active` (dispatched from `app/ribbon-contextual-config.ts`
 * when `activeTool === 'furniture'` — the TOOL-active pattern, mirror of the
 * column tab). Lets the user pick WHICH catalog model to place + tune rotation /
 * scale before clicking, bound live to `furnitureToolBridgeStore` via
 * `useRibbonFurnitureBridge`.
 *
 * Panels:
 *   Library    → catalog combobox (options generated from FURNITURE_CATALOG SSoT)
 *   Placement  → rotation + scale
 *
 * @see docs/centralized-systems/reference/adrs/ADR-410-cc0-mesh-furniture-import.md
 */

import type { RibbonTab } from '../types/ribbon-types';
import { FURNITURE_RIBBON_KEYS } from '../hooks/bridge/furniture-command-keys';
import { FURNITURE_CATALOG } from '../../../bim/furniture/furniture-catalog';

export const FURNITURE_CONTEXTUAL_TRIGGER = 'furniture-tool-active';

// ─── Combobox options ────────────────────────────────────────────────────────

/** Catalog options GENERATED from the FURNITURE_CATALOG SSoT (never hand-listed). */
const FURNITURE_CATALOG_OPTIONS = FURNITURE_CATALOG.map((p) => ({
  value: p.id,
  labelKey: p.labelKey,
  isLiteralLabel: false,
}));

const ROTATION_DEG_OPTIONS = [
  { value: '0',   labelKey: '0',   isLiteralLabel: true },
  { value: '45',  labelKey: '45',  isLiteralLabel: true },
  { value: '90',  labelKey: '90',  isLiteralLabel: true },
  { value: '135', labelKey: '135', isLiteralLabel: true },
  { value: '180', labelKey: '180', isLiteralLabel: true },
  { value: '225', labelKey: '225', isLiteralLabel: true },
  { value: '270', labelKey: '270', isLiteralLabel: true },
  { value: '315', labelKey: '315', isLiteralLabel: true },
] as const;

const SCALE_OPTIONS = [
  { value: '0.5',  labelKey: '0.5',  isLiteralLabel: true },
  { value: '0.75', labelKey: '0.75', isLiteralLabel: true },
  { value: '1',    labelKey: '1',    isLiteralLabel: true },
  { value: '1.25', labelKey: '1.25', isLiteralLabel: true },
  { value: '1.5',  labelKey: '1.5',  isLiteralLabel: true },
  { value: '2',    labelKey: '2',    isLiteralLabel: true },
] as const;

// ─── Tab definition ──────────────────────────────────────────────────────────

export const CONTEXTUAL_FURNITURE_TAB: RibbonTab = {
  id: 'furniture-editor',
  labelKey: 'ribbon.tabs.furnitureProperties',
  isContextual: true,
  contextualTrigger: FURNITURE_CONTEXTUAL_TRIGGER,
  panels: [
    {
      id: 'furniture-catalog',
      labelKey: 'ribbon.panels.furnitureCatalog',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'furniture.asset',
                labelKey: 'ribbon.commands.furnitureEditor.asset',
                commandKey: FURNITURE_RIBBON_KEYS.stringParams.assetId,
                comboboxWidthPx: 180,
                options: FURNITURE_CATALOG_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'furniture-geometry',
      labelKey: 'ribbon.panels.furnitureGeometry',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'furniture.rotation',
                labelKey: 'ribbon.commands.furnitureEditor.rotation',
                commandKey: FURNITURE_RIBBON_KEYS.params.rotation,
                comboboxWidthPx: 80,
                options: ROTATION_DEG_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'furniture.scale',
                labelKey: 'ribbon.commands.furnitureEditor.scale',
                commandKey: FURNITURE_RIBBON_KEYS.params.scale,
                comboboxWidthPx: 80,
                options: SCALE_OPTIONS,
              },
            },
          ],
        },
      ],
    },
  ],
};
