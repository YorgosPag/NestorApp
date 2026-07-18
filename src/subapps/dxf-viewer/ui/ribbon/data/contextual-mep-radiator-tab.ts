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
import { literalNumberOptions } from './ribbon-numeric-options';

// ADR-422 L2 — ΔΤ regime options derived from the config SSoT (id → «80/60» label).
const SYSTEM_REGIME_OPTIONS = SYSTEM_REGIME_PRESETS.map((p) => ({
  value: p.id,
  labelKey: p.label,
  isLiteralLabel: true,
}));

export const MEP_RADIATOR_CONTEXTUAL_TRIGGER = 'mep-radiator-selected';

// ─── Combobox options (mm presets) ───────────────────────────────────────────

// Body width (mm) — the run along the wall. 1000 = radiator default.
const WIDTH_MM_OPTIONS = literalNumberOptions([400, 600, 800, 1000, 1200, 1600]);

// Depth (mm) — radiator panel thickness.
const LENGTH_MM_OPTIONS = literalNumberOptions([60, 80, 100, 120, 160]);

// Body vertical height (mm).
const BODY_HEIGHT_MM_OPTIONS = literalNumberOptions([300, 400, 500, 600, 900]);

// Floor-relative mounting elevation (mm) — vertical centre (wall-mounted).
const MOUNTING_ELEVATION_MM_OPTIONS = literalNumberOptions([300, 450, 600, 900]);

// Supply/return connector diameter (mm) — typical hydronic tails.
const CONNECTOR_DIAMETER_MM_OPTIONS = literalNumberOptions([12, 15, 18, 22]);

// Nominal catalogue thermal output (W, at ΔT 50K) — typical panel-radiator range.
const THERMAL_OUTPUT_W_OPTIONS = literalNumberOptions([500, 800, 1000, 1500, 2000, 2500]);

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
                numericInput: { quantityKind: 'model-length' },
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
                numericInput: { quantityKind: 'model-length' },
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
                numericInput: { quantityKind: 'model-length' },
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
                numericInput: { quantityKind: 'model-length' },
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
                numericInput: { quantityKind: 'nominal-diameter' },
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
                numericInput: { quantityKind: 'power' },
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
