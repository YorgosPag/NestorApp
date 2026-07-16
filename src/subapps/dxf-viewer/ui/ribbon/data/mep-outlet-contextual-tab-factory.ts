/**
 * ADR-430 / ADR-431 — Factory for the small wall-box MEP "outlet" contextual
 * ribbon tab, shared by the power socket (strong current, ADR-430) and the
 * data outlet (weak current / structured cabling, ADR-431). Both are
 * `mep-fixture` entities driven by the SAME `MEP_FIXTURE_RIBBON_KEYS` bridge
 * and share IDENTICAL geometry (parametric wall-box ~80×80, 0-315° rotation
 * ladder, 3D-view fallback) — the two Revit categories differ ONLY in
 * labelling (tab/panel titles) + the contextual trigger that selects them,
 * exactly as Revit shows "Electrical Fixtures" and "Communication Devices" as
 * separate categories over one IfcOutlet base.
 *
 * This factory is the SINGLE source of the tab STRUCTURE + the shared
 * combobox presets. The two kinds differ only in a small config
 * (`MepOutletContextualTabConfig`): ids, the trigger, and the tab/panel
 * i18n labels. Because both tabs reuse the same `MEP_FIXTURE_RIBBON_KEYS`
 * command keys, the SAME `useRibbonMepFixtureBridge` drives both — no
 * behavioural fork.
 *
 * @see contextual-mep-socket-tab.ts       (power socket config)
 * @see contextual-mep-data-outlet-tab.ts  (data outlet config)
 * @see docs/centralized-systems/reference/adrs/ADR-430-electrical-strong-auto-design.md
 * @see docs/centralized-systems/reference/adrs/ADR-431-electrical-weak-auto-design.md
 */

import type { RibbonTab } from '../types/ribbon-types';
import { literalNumberOptions, MEP_FIXTURE_PARAMETRIC_3D_VIEW_OPTIONS } from './ribbon-numeric-options';
import {
  MEP_FIXTURE_RIBBON_KEYS,
  MEP_FIXTURE_RIBBON_KEYS_ACTIONS,
} from '../hooks/bridge/mep-fixture-command-keys';

// ─── Combobox options (mm / deg presets) — shared by BOTH outlet kinds ─────

// Footprint width/length (mm) — typical flush wall-box plan sizes (single gang
// ≈ 80×80, double gang up to ~120).
const DIMENSION_MM_OPTIONS = literalNumberOptions([60, 70, 80, 85, 100, 120]);

const ROTATION_DEG_OPTIONS = literalNumberOptions([0, 45, 90, 135, 180, 225, 270, 315]);

// Body height (mm) — the wall-box depth proud of the wall.
const BODY_HEIGHT_MM_OPTIONS = literalNumberOptions([30, 40, 50, 60]);

// Wall-mount elevation above FFL (mm) — 150 skirting, 300 general outlet,
// 1100/1200 above-worktop (Revit / structured-cabling mounting heights).
const MOUNTING_ELEVATION_MM_OPTIONS = literalNumberOptions([150, 300, 1100, 1200]);

/** The kind-specific bits that distinguish a power-socket tab from a data-outlet tab. */
export interface MepOutletContextualTabConfig {
  /** Stable tab id (e.g. `mep-socket-editor`). */
  readonly tabId: string;
  /** Panel-id prefix, kept distinct per kind (e.g. `mep-socket`). */
  readonly panelIdPrefix: string;
  /** Command-id prefix, camelCase (e.g. `mepSocket`). */
  readonly commandIdPrefix: string;
  /** Contextual trigger string this tab listens for. */
  readonly trigger: string;
  /** Tab button label (i18n key). */
  readonly tabLabelKey: string;
  /** Panel titles (i18n keys). */
  readonly panelLabelKeys: {
    readonly geometry: string;
    readonly threeDView: string;
    readonly actions: string;
  };
}

/**
 * Build an MEP outlet contextual `RibbonTab` from a kind config. Structure +
 * shared presets are fixed; only ids + tab/panel labels vary. Panels:
 * Γεωμετρία → 3D View → Ενέργειες.
 */
export function buildMepOutletContextualTab(config: MepOutletContextualTabConfig): RibbonTab {
  const { tabId, panelIdPrefix, commandIdPrefix, trigger, tabLabelKey, panelLabelKeys } = config;

  const geometryPanel: RibbonTab['panels'][number] = {
    id: `${panelIdPrefix}-geometry`,
    labelKey: panelLabelKeys.geometry,
    rows: [
      {
        isInFlyout: false,
        buttons: [
          {
            type: 'combobox',
            size: 'small',
            command: {
              id: `${commandIdPrefix}.width`,
              labelKey: 'ribbon.commands.mepSanitaryFixtureEditor.width',
              commandKey: MEP_FIXTURE_RIBBON_KEYS.params.width,
              comboboxWidthPx: 80,
              options: DIMENSION_MM_OPTIONS,
            },
          },
          {
            type: 'combobox',
            size: 'small',
            command: {
              id: `${commandIdPrefix}.length`,
              labelKey: 'ribbon.commands.mepSanitaryFixtureEditor.length',
              commandKey: MEP_FIXTURE_RIBBON_KEYS.params.length,
              comboboxWidthPx: 80,
              options: DIMENSION_MM_OPTIONS,
            },
          },
          {
            type: 'combobox',
            size: 'small',
            command: {
              id: `${commandIdPrefix}.rotation`,
              labelKey: 'ribbon.commands.mepSanitaryFixtureEditor.rotation',
              commandKey: MEP_FIXTURE_RIBBON_KEYS.params.rotation,
              comboboxWidthPx: 80,
              options: ROTATION_DEG_OPTIONS,
            },
          },
          {
            type: 'combobox',
            size: 'small',
            command: {
              id: `${commandIdPrefix}.bodyHeight`,
              labelKey: 'ribbon.commands.mepSanitaryFixtureEditor.bodyHeight',
              commandKey: MEP_FIXTURE_RIBBON_KEYS.params.bodyHeight,
              comboboxWidthPx: 80,
              options: BODY_HEIGHT_MM_OPTIONS,
            },
          },
          {
            type: 'combobox',
            size: 'small',
            command: {
              id: `${commandIdPrefix}.mountingElevation`,
              labelKey: 'ribbon.commands.mepSanitaryFixtureEditor.mountingElevation',
              commandKey: MEP_FIXTURE_RIBBON_KEYS.params.mountingElevation,
              comboboxWidthPx: 90,
              options: MOUNTING_ELEVATION_MM_OPTIONS,
            },
          },
        ],
      },
    ],
  };

  const threeDViewPanel: RibbonTab['panels'][number] = {
    id: `${panelIdPrefix}-3d-view`,
    labelKey: panelLabelKeys.threeDView,
    rows: [
      {
        isInFlyout: false,
        buttons: [
          {
            type: 'combobox',
            size: 'small',
            command: {
              id: `${commandIdPrefix}.threeDView`,
              labelKey: 'ribbon.commands.mepSanitaryFixtureEditor.threeDView',
              commandKey: MEP_FIXTURE_RIBBON_KEYS.stringParams.assetId,
              comboboxWidthPx: 150,
              options: MEP_FIXTURE_PARAMETRIC_3D_VIEW_OPTIONS,
            },
          },
        ],
      },
    ],
  };

  const actionsPanel: RibbonTab['panels'][number] = {
    id: `${panelIdPrefix}-actions`,
    labelKey: panelLabelKeys.actions,
    rows: [
      {
        isInFlyout: false,
        buttons: [
          {
            type: 'simple',
            size: 'small',
            command: {
              id: `${commandIdPrefix}.close`,
              labelKey: 'ribbon.commands.mepSanitaryFixtureEditor.close',
              icon: 'select',
              commandKey: MEP_FIXTURE_RIBBON_KEYS_ACTIONS.close,
              action: MEP_FIXTURE_RIBBON_KEYS_ACTIONS.close,
            },
          },
          {
            type: 'simple',
            size: 'small',
            command: {
              id: `${commandIdPrefix}.delete`,
              labelKey: 'ribbon.commands.mepSanitaryFixtureEditor.delete',
              icon: 'trash',
              commandKey: MEP_FIXTURE_RIBBON_KEYS_ACTIONS.delete,
              action: MEP_FIXTURE_RIBBON_KEYS_ACTIONS.delete,
            },
          },
        ],
      },
    ],
  };

  return {
    id: tabId,
    labelKey: tabLabelKey,
    isContextual: true,
    contextualTrigger: trigger,
    panels: [geometryPanel, threeDViewPanel, actionsPanel],
  };
}
