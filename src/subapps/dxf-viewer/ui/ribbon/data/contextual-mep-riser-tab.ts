/**
 * ADR-408 Φ15 Phase-2 — Contextual ribbon tab for the MEP riser (κατακόρυφη
 * στήλη αποχέτευσης) placement tool.
 *
 * Trigger: `mep-riser-tool-active` (dispatched from `ribbon-contextual-config`
 * when `activeTool === 'mep-drain-riser'` — the TOOL-active pattern, mirror of
 * the light-fixture library tab). Lets the user set the Revit base/top span
 * («Έως όροφο» — base is the current floor) + the pipe diameter before the
 * single placement click, bound live to `mepRiserToolBridgeStore` via
 * `useRibbonMepRiserBridge`.
 *
 * Panels:
 *   Στήλη  → «Έως όροφο» (dynamic floors from the bridge) + «Διάμετρος» (DN)
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { RibbonTab } from '../types/ribbon-types';
import { MEP_RISER_RIBBON_KEYS } from '../hooks/bridge/mep-riser-command-keys';

export const MEP_RISER_CONTEXTUAL_TRIGGER = 'mep-riser-tool-active';

// ─── Combobox options ────────────────────────────────────────────────────────

// «Έως όροφο» options are DYNAMIC (the building's floors above the current one) —
// the bridge's `getComboboxState` supplies them; the static list stays empty.
const TO_FLOOR_OPTIONS: readonly never[] = [];

// Drainage stack outer diameter (mm) — sanitary DN presets (DEFAULT = 100).
const DIAMETER_MM_OPTIONS = [
  { value: '50',  labelKey: '50',  isLiteralLabel: true },
  { value: '75',  labelKey: '75',  isLiteralLabel: true },
  { value: '100', labelKey: '100', isLiteralLabel: true },
  { value: '125', labelKey: '125', isLiteralLabel: true },
  { value: '160', labelKey: '160', isLiteralLabel: true },
] as const;

// ─── Tab definition ──────────────────────────────────────────────────────────

export const CONTEXTUAL_MEP_RISER_TAB: RibbonTab = {
  id: 'mep-riser',
  labelKey: 'ribbon.tabs.mepRiser',
  isContextual: true,
  contextualTrigger: MEP_RISER_CONTEXTUAL_TRIGGER,
  panels: [
    {
      id: 'mep-riser-span',
      labelKey: 'ribbon.panels.mepRiser',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepRiser.toFloor',
                labelKey: 'ribbon.commands.mepRiser.toFloor',
                commandKey: MEP_RISER_RIBBON_KEYS.stringParams.toFloor,
                comboboxWidthPx: 140,
                options: TO_FLOOR_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepRiser.diameter',
                labelKey: 'ribbon.commands.mepRiser.diameter',
                commandKey: MEP_RISER_RIBBON_KEYS.params.diameter,
                comboboxWidthPx: 80,
                options: DIAMETER_MM_OPTIONS,
              },
            },
          ],
        },
      ],
    },
  ],
};
