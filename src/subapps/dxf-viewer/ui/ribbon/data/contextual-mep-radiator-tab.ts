/**
 * ADR-408 Εύρος Β #1 — Contextual ribbon tab για το heating radiator (καλοριφέρ).
 *
 * Trigger: `mep-radiator-selected` (dispatched από `resolveContextualTrigger`
 * στο `app/ribbon-contextual-config.ts` όταν το primary-selected entity έχει
 * `type === 'mep-radiator'`). Mirror του «Ιδιότητες Συλλέκτη» (ADR-408 Φ12) αλλά
 * πιο λιτό: το καλοριφέρ είναι ΤΕΡΜΑΤΙΚΟ — δεν έχει classification (η ροή
 * supply/return είναι σταθερή), ούτε πλήθος εξόδων (ακριβώς 2 connectors), ούτε
 * διαχείριση δικτύου (καταναλωτής, όχι πηγή).
 *
 * Panels:
 *   Geometry → width + length + body height + mounting elevation
 *   Thermal  → connector diameter + thermal output (W, catalogue)
 *   Actions  → close + delete
 *
 * Live behavior: ο bridge (`useRibbonMepRadiatorBridge`) dispatch-άρει updates σε
 * κάθε combobox change μέσω `UpdateMepRadiatorParamsCommand` (undoable). Το command
 * ΗΔΗ ξανακάνει seed τους 2 connectors (supply/return) από το `width`, οπότε ο
 * bridge δεν χρειάζεται να τους προ-υπολογίσει (≠ manifold).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { RibbonTab } from '../types/ribbon-types';
import {
  MEP_RADIATOR_RIBBON_KEYS,
  MEP_RADIATOR_RIBBON_KEYS_ACTIONS,
} from '../hooks/bridge/mep-radiator-command-keys';
import { SYSTEM_REGIME_PRESETS } from '../../../bim/thermal/sizing/radiator-sizing-config';

// ADR-422 L2 — ΔΤ regime options derived from the config SSoT (id → «80/60» label).
const SYSTEM_REGIME_OPTIONS = SYSTEM_REGIME_PRESETS.map((p) => ({
  value: p.id,
  labelKey: p.label,
  isLiteralLabel: true,
}));

export const MEP_RADIATOR_CONTEXTUAL_TRIGGER = 'mep-radiator-selected';

// ─── Combobox options (mm presets) ───────────────────────────────────────────

// Body width (mm) — the run along the wall. 1000 = radiator default.
const WIDTH_MM_OPTIONS = [
  { value: '400',  labelKey: '400',  isLiteralLabel: true },
  { value: '600',  labelKey: '600',  isLiteralLabel: true },
  { value: '800',  labelKey: '800',  isLiteralLabel: true },
  { value: '1000', labelKey: '1000', isLiteralLabel: true },
  { value: '1200', labelKey: '1200', isLiteralLabel: true },
  { value: '1600', labelKey: '1600', isLiteralLabel: true },
] as const;

// Depth (mm) — radiator panel thickness.
const LENGTH_MM_OPTIONS = [
  { value: '60',  labelKey: '60',  isLiteralLabel: true },
  { value: '80',  labelKey: '80',  isLiteralLabel: true },
  { value: '100', labelKey: '100', isLiteralLabel: true },
  { value: '120', labelKey: '120', isLiteralLabel: true },
  { value: '160', labelKey: '160', isLiteralLabel: true },
] as const;

// Body vertical height (mm).
const BODY_HEIGHT_MM_OPTIONS = [
  { value: '300', labelKey: '300', isLiteralLabel: true },
  { value: '400', labelKey: '400', isLiteralLabel: true },
  { value: '500', labelKey: '500', isLiteralLabel: true },
  { value: '600', labelKey: '600', isLiteralLabel: true },
  { value: '900', labelKey: '900', isLiteralLabel: true },
] as const;

// Floor-relative mounting elevation (mm) — vertical centre (wall-mounted).
const MOUNTING_ELEVATION_MM_OPTIONS = [
  { value: '300', labelKey: '300', isLiteralLabel: true },
  { value: '450', labelKey: '450', isLiteralLabel: true },
  { value: '600', labelKey: '600', isLiteralLabel: true },
  { value: '900', labelKey: '900', isLiteralLabel: true },
] as const;

// Supply/return connector diameter (mm) — typical hydronic tails.
const CONNECTOR_DIAMETER_MM_OPTIONS = [
  { value: '12', labelKey: '12', isLiteralLabel: true },
  { value: '15', labelKey: '15', isLiteralLabel: true },
  { value: '18', labelKey: '18', isLiteralLabel: true },
  { value: '22', labelKey: '22', isLiteralLabel: true },
] as const;

// Nominal catalogue thermal output (W, at ΔT 50K) — typical panel-radiator range.
const THERMAL_OUTPUT_W_OPTIONS = [
  { value: '500',  labelKey: '500',  isLiteralLabel: true },
  { value: '800',  labelKey: '800',  isLiteralLabel: true },
  { value: '1000', labelKey: '1000', isLiteralLabel: true },
  { value: '1500', labelKey: '1500', isLiteralLabel: true },
  { value: '2000', labelKey: '2000', isLiteralLabel: true },
  { value: '2500', labelKey: '2500', isLiteralLabel: true },
] as const;

// ─── Tab definition ──────────────────────────────────────────────────────────

export const CONTEXTUAL_MEP_RADIATOR_TAB: RibbonTab = {
  id: 'mep-radiator-editor',
  labelKey: 'ribbon.tabs.mepRadiatorProperties',
  isContextual: true,
  contextualTrigger: MEP_RADIATOR_CONTEXTUAL_TRIGGER,
  panels: [
    {
      id: 'mep-radiator-geometry',
      labelKey: 'ribbon.panels.mepRadiatorGeometry',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepRadiator.width',
                labelKey: 'ribbon.commands.mepRadiatorEditor.width',
                commandKey: MEP_RADIATOR_RIBBON_KEYS.params.width,
                comboboxWidthPx: 90,
                options: WIDTH_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepRadiator.length',
                labelKey: 'ribbon.commands.mepRadiatorEditor.length',
                commandKey: MEP_RADIATOR_RIBBON_KEYS.params.length,
                comboboxWidthPx: 80,
                options: LENGTH_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepRadiator.bodyHeight',
                labelKey: 'ribbon.commands.mepRadiatorEditor.bodyHeight',
                commandKey: MEP_RADIATOR_RIBBON_KEYS.params.bodyHeight,
                comboboxWidthPx: 80,
                options: BODY_HEIGHT_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepRadiator.mountingElevation',
                labelKey: 'ribbon.commands.mepRadiatorEditor.mountingElevation',
                commandKey: MEP_RADIATOR_RIBBON_KEYS.params.mountingElevation,
                comboboxWidthPx: 90,
                options: MOUNTING_ELEVATION_MM_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'mep-radiator-thermal',
      labelKey: 'ribbon.panels.mepRadiatorThermal',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepRadiator.connectorDiameter',
                labelKey: 'ribbon.commands.mepRadiatorEditor.connectorDiameter',
                commandKey: MEP_RADIATOR_RIBBON_KEYS.params.connectorDiameter,
                comboboxWidthPx: 80,
                options: CONNECTOR_DIAMETER_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepRadiator.thermalOutput',
                labelKey: 'ribbon.commands.mepRadiatorEditor.thermalOutput',
                commandKey: MEP_RADIATOR_RIBBON_KEYS.params.thermalOutput,
                comboboxWidthPx: 90,
                options: THERMAL_OUTPUT_W_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-422 L2 — radiator sizing (EN 442): regime selector + derived readouts.
      id: 'mep-radiator-sizing',
      labelKey: 'ribbon.panels.mepRadiatorSizing',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepRadiator.systemRegime',
                labelKey: 'ribbon.commands.mepRadiatorEditor.systemRegime',
                commandKey: MEP_RADIATOR_RIBBON_KEYS.stringParams.systemRegime,
                comboboxWidthPx: 90,
                options: SYSTEM_REGIME_OPTIONS,
              },
            },
            {
              // Read-only readout (ADR-422 L2) — bridge returns disabled state.
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepRadiator.requiredOutputW',
                labelKey: 'ribbon.commands.mepRadiatorEditor.requiredOutput',
                commandKey: MEP_RADIATOR_RIBBON_KEYS.readouts.requiredOutputW,
                comboboxWidthPx: 110,
                options: [],
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepRadiator.correctionFactor',
                labelKey: 'ribbon.commands.mepRadiatorEditor.correctionFactor',
                commandKey: MEP_RADIATOR_RIBBON_KEYS.readouts.correctionFactor,
                comboboxWidthPx: 90,
                options: [],
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepRadiator.adequacy',
                labelKey: 'ribbon.commands.mepRadiatorEditor.adequacy',
                commandKey: MEP_RADIATOR_RIBBON_KEYS.readouts.adequacy,
                comboboxWidthPx: 100,
                options: [],
              },
            },
          ],
        },
      ],
    },
    {
      id: 'mep-radiator-actions',
      labelKey: 'ribbon.panels.mepRadiatorActions',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'mepRadiator.close',
                labelKey: 'ribbon.commands.mepRadiatorEditor.close',
                icon: 'select',
                commandKey: MEP_RADIATOR_RIBBON_KEYS_ACTIONS.close,
                action: MEP_RADIATOR_RIBBON_KEYS_ACTIONS.close,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'mepRadiator.delete',
                labelKey: 'ribbon.commands.mepRadiatorEditor.delete',
                icon: 'trash',
                commandKey: MEP_RADIATOR_RIBBON_KEYS_ACTIONS.delete,
                action: MEP_RADIATOR_RIBBON_KEYS_ACTIONS.delete,
              },
            },
          ],
        },
      ],
    },
  ],
};
