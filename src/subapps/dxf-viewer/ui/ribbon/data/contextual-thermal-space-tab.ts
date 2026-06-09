/**
 * ADR-422 L0 — Contextual ribbon tab για thermal-space (θερμικός χώρος).
 *
 * Trigger: `thermal-space-selected` (dispatched από `ribbon-contextual-config.ts`
 * όταν το primary-selected entity έχει `type === 'thermal-space'`).
 *
 * Panels:
 *   Properties → use-type picker (ΤΟΤΕΕ) + setpoint Ti + ACH n
 *   Geometry   → ceiling height (mm)
 *   Actions    → close + delete
 *
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md
 */

import type { RibbonTab } from '../types/ribbon-types';
import { THERMAL_SPACE_RIBBON_KEYS } from '../hooks/bridge/thermal-space-command-keys';
import { listThermalSpaceUseTypes } from '../../../bim/thermal/thermal-space-use-catalog';
import {
  REHEAT_MODES,
  THERMAL_BRIDGE_LEVELS,
} from '../../../bim/thermal/heat-load/heat-load-config';
import { SOLAR_SHADING_LEVELS } from '../../../bim/thermal/heat-load/annual-gains-config';

export const THERMAL_SPACE_CONTEXTUAL_TRIGGER = 'thermal-space-selected';

// ─── Combobox options ─────────────────────────────────────────────────────────

/** Use-type options — generated from the ΤΟΤΕΕ catalog SSoT (never hand-listed). */
const USE_TYPE_OPTIONS = listThermalSpaceUseTypes().map((def) => ({
  value: def.id,
  labelKey: def.labelKey,
  isLiteralLabel: false,
}));

/** Design indoor temperature presets (°C) — ΤΟΤΕΕ 20701-1 range. */
const SETPOINT_C_OPTIONS = [
  { value: '16', labelKey: '16 °C', isLiteralLabel: true },
  { value: '18', labelKey: '18 °C', isLiteralLabel: true },
  { value: '20', labelKey: '20 °C', isLiteralLabel: true },
  { value: '22', labelKey: '22 °C', isLiteralLabel: true },
  { value: '24', labelKey: '24 °C', isLiteralLabel: true },
] as const;

/** Air-changes-per-hour presets (1/h). */
const ACH_OPTIONS = [
  { value: '0.5',  labelKey: '0.5 /h',  isLiteralLabel: true },
  { value: '0.75', labelKey: '0.75 /h', isLiteralLabel: true },
  { value: '1',    labelKey: '1.0 /h',  isLiteralLabel: true },
  { value: '1.5',  labelKey: '1.5 /h',  isLiteralLabel: true },
  { value: '2',    labelKey: '2.0 /h',  isLiteralLabel: true },
] as const;

/** Thermal-bridge level options (ADR-422 L1.5) — from the config SSoT. */
const THERMAL_BRIDGE_OPTIONS = THERMAL_BRIDGE_LEVELS.map((level) => ({
  value: level,
  labelKey: `thermalSpace.thermalBridge.${level}`,
  isLiteralLabel: false,
}));

/** Heating-operation / reheat-mode options (ADR-422 L1.5) — from the config SSoT. */
const REHEAT_MODE_OPTIONS = REHEAT_MODES.map((mode) => ({
  value: mode,
  labelKey: `thermalSpace.reheat.${mode}`,
  isLiteralLabel: false,
}));

/** Solar-shading (obstruction) level options (ADR-422 L7.3) — from the config SSoT. */
const SOLAR_SHADING_OPTIONS = SOLAR_SHADING_LEVELS.map((level) => ({
  value: level,
  labelKey: `thermalSpace.solarShading.${level}`,
  isLiteralLabel: false,
}));

/** Clear ceiling height presets (mm). */
const CEILING_HEIGHT_MM_OPTIONS = [
  { value: '2400', labelKey: '2400 mm', isLiteralLabel: true },
  { value: '2600', labelKey: '2600 mm', isLiteralLabel: true },
  { value: '2700', labelKey: '2700 mm', isLiteralLabel: true },
  { value: '3000', labelKey: '3000 mm', isLiteralLabel: true },
  { value: '3300', labelKey: '3300 mm', isLiteralLabel: true },
  { value: '3600', labelKey: '3600 mm', isLiteralLabel: true },
] as const;

// ─── Tab definition ──────────────────────────────────────────────────────────

export const CONTEXTUAL_THERMAL_SPACE_TAB: RibbonTab = {
  id: 'thermal-space-editor',
  labelKey: 'ribbon.tabs.thermalSpaceProperties',
  isContextual: true,
  contextualTrigger: THERMAL_SPACE_CONTEXTUAL_TRIGGER,
  panels: [
    {
      id: 'thermal-space-properties',
      labelKey: 'ribbon.panels.thermalSpaceProperties',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'thermalSpace.useType',
                labelKey: 'ribbon.commands.thermalSpaceEditor.useType',
                commandKey: THERMAL_SPACE_RIBBON_KEYS.stringParams.useType,
                comboboxWidthPx: 180,
                options: USE_TYPE_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'thermalSpace.setpointTempC',
                labelKey: 'ribbon.commands.thermalSpaceEditor.setpointTempC',
                commandKey: THERMAL_SPACE_RIBBON_KEYS.params.setpointTempC,
                comboboxWidthPx: 100,
                options: SETPOINT_C_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'thermalSpace.airChangesPerHour',
                labelKey: 'ribbon.commands.thermalSpaceEditor.airChangesPerHour',
                commandKey: THERMAL_SPACE_RIBBON_KEYS.params.airChangesPerHour,
                comboboxWidthPx: 100,
                options: ACH_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'thermalSpace.thermalBridgeLevel',
                labelKey: 'ribbon.commands.thermalSpaceEditor.thermalBridgeLevel',
                commandKey: THERMAL_SPACE_RIBBON_KEYS.stringParams.thermalBridgeLevel,
                comboboxWidthPx: 150,
                options: THERMAL_BRIDGE_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'thermalSpace.reheatMode',
                labelKey: 'ribbon.commands.thermalSpaceEditor.reheatMode',
                commandKey: THERMAL_SPACE_RIBBON_KEYS.stringParams.reheatMode,
                comboboxWidthPx: 160,
                options: REHEAT_MODE_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'thermalSpace.solarShadingLevel',
                labelKey: 'ribbon.commands.thermalSpaceEditor.solarShadingLevel',
                commandKey: THERMAL_SPACE_RIBBON_KEYS.stringParams.solarShadingLevel,
                comboboxWidthPx: 160,
                options: SOLAR_SHADING_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'thermal-space-geometry',
      labelKey: 'ribbon.panels.thermalSpaceGeometry',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'thermalSpace.ceilingHeightMm',
                labelKey: 'ribbon.commands.thermalSpaceEditor.ceilingHeightMm',
                commandKey: THERMAL_SPACE_RIBBON_KEYS.params.ceilingHeightMm,
                comboboxWidthPx: 100,
                options: CEILING_HEIGHT_MM_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'thermal-space-heat-load',
      labelKey: 'ribbon.panels.thermalSpaceHeatLoad',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              // Read-only readout (ADR-422 L1) — bridge returns disabled state.
              type: 'combobox',
              size: 'small',
              command: {
                id: 'thermalSpace.heatLoadTotalW',
                labelKey: 'ribbon.commands.thermalSpaceEditor.heatLoadTotalW',
                commandKey: THERMAL_SPACE_RIBBON_KEYS.readouts.heatLoadTotalW,
                comboboxWidthPx: 110,
                options: [],
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'thermalSpace.heatLoadSpecific',
                labelKey: 'ribbon.commands.thermalSpaceEditor.heatLoadSpecific',
                commandKey: THERMAL_SPACE_RIBBON_KEYS.readouts.heatLoadSpecific,
                comboboxWidthPx: 110,
                options: [],
              },
            },
          ],
        },
      ],
    },
    {
      id: 'thermal-space-actions',
      labelKey: 'ribbon.panels.thermalSpaceActions',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'thermalSpace.close',
                labelKey: 'ribbon.commands.thermalSpaceEditor.close',
                icon: 'select',
                commandKey: THERMAL_SPACE_RIBBON_KEYS.actions.close,
                action: THERMAL_SPACE_RIBBON_KEYS.actions.close,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'thermalSpace.delete',
                labelKey: 'ribbon.commands.thermalSpaceEditor.delete',
                icon: 'trash',
                commandKey: THERMAL_SPACE_RIBBON_KEYS.actions.delete,
                action: THERMAL_SPACE_RIBBON_KEYS.actions.delete,
              },
            },
          ],
        },
      ],
    },
  ],
};
