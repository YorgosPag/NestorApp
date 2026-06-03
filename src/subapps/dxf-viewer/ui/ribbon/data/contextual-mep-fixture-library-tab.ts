/**
 * ADR-411 — Contextual ribbon tab for the light-fixture library (φωτιστικά).
 *
 * Trigger: `mep-fixture-tool-active` (dispatched from `ribbon-contextual-config`
 * when `activeTool === 'mep-fixture'` — the TOOL-active pattern, mirror of the
 * furniture library tab). Lets the user pick WHICH CC0 model to place (or the
 * parametric symbol) + tune rotation / scale before clicking, bound live to
 * `mepFixtureToolBridgeStore` via `useRibbonMepFixtureLibraryBridge`.
 *
 * Panels:
 *   Library    → catalog combobox (parametric + LIGHT_FIXTURE_CATALOG SSoT)
 *   Placement  → rotation + scale
 *
 * @see docs/centralized-systems/reference/adrs/ADR-411-bim-mesh-library.md
 */

import type { RibbonTab } from '../types/ribbon-types';
import { MEP_FIXTURE_LIBRARY_KEYS } from '../hooks/bridge/mep-fixture-library-command-keys';
import { LIGHT_FIXTURE_CATALOG } from '../../../bim/mep-fixtures/light-fixture-catalog';
import { SELECT_CLEAR_VALUE } from '@/config/domain-constants';

export const MEP_FIXTURE_LIBRARY_CONTEXTUAL_TRIGGER = 'mep-fixture-tool-active';

// ─── Combobox options ────────────────────────────────────────────────────────

/**
 * Catalog options: the parametric (no-mesh) default first, then every CC0 mesh
 * GENERATED from LIGHT_FIXTURE_CATALOG SSoT (never hand-listed). The bridge
 * overrides these with thumbnail `imageUrl`s once Storage URLs resolve.
 */
const ASSET_OPTIONS = [
  { value: SELECT_CLEAR_VALUE, labelKey: 'ribbon.commands.mepFixtureLibrary.parametric', isLiteralLabel: false },
  ...LIGHT_FIXTURE_CATALOG.map((p) => ({ value: p.id, labelKey: p.labelKey, isLiteralLabel: false })),
];

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

export const CONTEXTUAL_MEP_FIXTURE_LIBRARY_TAB: RibbonTab = {
  id: 'mep-fixture-library',
  labelKey: 'ribbon.tabs.mepFixtureLibrary',
  isContextual: true,
  contextualTrigger: MEP_FIXTURE_LIBRARY_CONTEXTUAL_TRIGGER,
  panels: [
    {
      id: 'mep-fixture-library-catalog',
      labelKey: 'ribbon.panels.mepFixtureLibrary',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepFixtureLibrary.asset',
                labelKey: 'ribbon.commands.mepFixtureLibrary.asset',
                commandKey: MEP_FIXTURE_LIBRARY_KEYS.stringParams.assetId,
                comboboxWidthPx: 180,
                options: ASSET_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'mep-fixture-library-placement',
      labelKey: 'ribbon.panels.mepFixtureLibraryPlacement',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepFixtureLibrary.rotation',
                labelKey: 'ribbon.commands.mepFixtureLibrary.rotation',
                commandKey: MEP_FIXTURE_LIBRARY_KEYS.params.rotation,
                comboboxWidthPx: 80,
                options: ROTATION_DEG_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepFixtureLibrary.scale',
                labelKey: 'ribbon.commands.mepFixtureLibrary.scale',
                commandKey: MEP_FIXTURE_LIBRARY_KEYS.params.scale,
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
