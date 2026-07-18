/**
 * ADR-408 DHW — Contextual ribbon tab για τον domestic hot water heater (θερμοσίφωνα).
 *
 * Trigger: `mep-water-heater-selected` (dispatched από `resolveContextualTrigger`
 * στο `app/ribbon-contextual-config.ts` όταν το primary-selected entity έχει
 * `type === 'mep-water-heater'`). Mirrors «Ιδιότητες Λέβητα» (contextual-mep-boiler-tab)
 * — ο θερμοσίφωνας είναι ΠΗΓΗ δικτύου ζεστού νερού χρήσης (DHW SOURCE), επομένως
 * μπορεί να τροφοδοτεί δίκτυο σωλήνων (Revit "Domestic Hot Water" system).
 *
 * Panels:
 *   Geometry → width + length + body height + mounting elevation
 *   Thermal  → connector diameter + thermal output (W) + tank capacity (L)
 *   Δίκτυο   → fold-in (self-hiding): picker / name + addMembers / color + removeMembers
 *   Actions  → close + delete
 *
 * DHW difference vs boiler: adds `tankCapacityL` (litres) in the Thermal panel —
 * the storage tank size is the key DHW-specific sizing parameter.
 *
 * Live behavior: ο bridge (`useRibbonMepWaterHeaterBridge`) dispatch-άρει updates σε
 * κάθε combobox change μέσω `UpdateMepWaterHeaterParamsCommand` (undoable). Το command
 * ΗΔΗ ξανακάνει seed τους connectors από το `width`, οπότε ο bridge δεν χρειάζεται
 * να τους προ-υπολογίσει (≠ manifold).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { RibbonTab } from '../types/ribbon-types';
import {
  MEP_WATER_HEATER_RIBBON_KEYS,
  MEP_WATER_HEATER_RIBBON_KEYS_ACTIONS,
  MEP_WATER_HEATER_RIBBON_VISIBILITY_KEYS,
} from '../hooks/bridge/mep-water-heater-command-keys';
import { MEP_PIPE_NETWORK_RIBBON_ACTIONS } from '../hooks/bridge/mep-pipe-network-command-keys';
import { literalNumberOptions } from './ribbon-numeric-options';
import { mepNetworkPanelRows } from './mep-network-panel-rows';

export const MEP_WATER_HEATER_CONTEXTUAL_TRIGGER = 'mep-water-heater-selected';

// ─── Combobox options (mm presets) ───────────────────────────────────────────

// Body width (mm) — the largest horizontal dimension of the water heater cabinet.
const WIDTH_MM_OPTIONS = literalNumberOptions([400, 450, 500, 600]);

// Depth (mm) — front-to-back depth of the water heater cabinet.
const LENGTH_MM_OPTIONS = literalNumberOptions([300, 400, 500, 600]);

// Body vertical height (mm) — typical storage water heater heights.
const BODY_HEIGHT_MM_OPTIONS = literalNumberOptions([700, 900, 1200, 1500]);

// Floor-relative mounting elevation (mm) — vertical centre (wall-mounted heater).
const MOUNTING_ELEVATION_MM_OPTIONS = literalNumberOptions([900, 1200, 1500]);

// Cold-inlet / hot-outlet connector diameter (mm) — typical DHW tails.
const CONNECTOR_DIAMETER_MM_OPTIONS = literalNumberOptions([15, 18, 22, 28]);

// Nominal heating element power (W) — typical residential electric water heater range.
const THERMAL_OUTPUT_W_OPTIONS = literalNumberOptions([1200, 1500, 2000, 2500, 3000]);

// Storage tank capacity (L) — EN 15316 / typical catalogue sizes.
const TANK_CAPACITY_L_OPTIONS = literalNumberOptions([30, 50, 80, 100, 120, 150, 200]);

// ─── Tab definition ──────────────────────────────────────────────────────────

export const CONTEXTUAL_MEP_WATER_HEATER_TAB: RibbonTab = {
  id: 'mep-water-heater-editor',
  labelKey: 'ribbon.tabs.mepWaterHeaterProperties',
  isContextual: true,
  contextualTrigger: MEP_WATER_HEATER_CONTEXTUAL_TRIGGER,
  panels: [
    {
      id: 'mep-water-heater-geometry',
      labelKey: 'ribbon.panels.mepWaterHeaterGeometry',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepWaterHeater.width',
                labelKey: 'ribbon.commands.mepWaterHeaterEditor.width',
                commandKey: MEP_WATER_HEATER_RIBBON_KEYS.params.width,
                comboboxWidthPx: 90,
                options: WIDTH_MM_OPTIONS,
                numericInput: { quantityKind: 'model-length' },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepWaterHeater.length',
                labelKey: 'ribbon.commands.mepWaterHeaterEditor.length',
                commandKey: MEP_WATER_HEATER_RIBBON_KEYS.params.length,
                comboboxWidthPx: 80,
                options: LENGTH_MM_OPTIONS,
                numericInput: { quantityKind: 'model-length' },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepWaterHeater.bodyHeight',
                labelKey: 'ribbon.commands.mepWaterHeaterEditor.bodyHeight',
                commandKey: MEP_WATER_HEATER_RIBBON_KEYS.params.bodyHeight,
                comboboxWidthPx: 80,
                options: BODY_HEIGHT_MM_OPTIONS,
                numericInput: { quantityKind: 'model-length' },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepWaterHeater.mountingElevation',
                labelKey: 'ribbon.commands.mepWaterHeaterEditor.mountingElevation',
                commandKey: MEP_WATER_HEATER_RIBBON_KEYS.params.mountingElevation,
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
      id: 'mep-water-heater-thermal',
      labelKey: 'ribbon.panels.mepWaterHeaterThermal',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepWaterHeater.connectorDiameter',
                labelKey: 'ribbon.commands.mepWaterHeaterEditor.connectorDiameter',
                commandKey: MEP_WATER_HEATER_RIBBON_KEYS.params.connectorDiameter,
                comboboxWidthPx: 80,
                options: CONNECTOR_DIAMETER_MM_OPTIONS,
                numericInput: { quantityKind: 'nominal-diameter' },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepWaterHeater.thermalOutput',
                labelKey: 'ribbon.commands.mepWaterHeaterEditor.thermalOutput',
                commandKey: MEP_WATER_HEATER_RIBBON_KEYS.params.thermalOutput,
                comboboxWidthPx: 90,
                options: THERMAL_OUTPUT_W_OPTIONS,
                numericInput: { quantityKind: 'power' },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepWaterHeater.tankCapacityL',
                labelKey: 'ribbon.commands.mepWaterHeaterEditor.tankCapacityL',
                commandKey: MEP_WATER_HEATER_RIBBON_KEYS.params.tankCapacityL,
                comboboxWidthPx: 90,
                options: TANK_CAPACITY_L_OPTIONS,
                numericInput: { quantityKind: 'volume' },
              },
            },
          ],
        },
      ],
    },
    // ADR-408 DHW — fold-in panel: διαχείριση δικτύου ζεστού νερού χρήσης που πηγάζει
    // από τον θερμοσίφωνα (Revit "Domestic Hot Water System Properties" from the
    // equipment). Self-hides όταν δεν υπάρχει δίκτυο. Reuse των domain-agnostic
    // mep-circuit-* widgets + pipe-network actions (ίδια με τον λέβητα, ADR-408 Εύρος Β).
    {
      id: 'mep-water-heater-network',
      labelKey: 'ribbon.panels.mepPipeNetworkProperties',
      visibilityKey: MEP_WATER_HEATER_RIBBON_VISIBILITY_KEYS.hasNetwork,
      rows: mepNetworkPanelRows('mepWaterHeater'),
    },
    {
      id: 'mep-water-heater-actions',
      labelKey: 'ribbon.panels.mepWaterHeaterActions',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'mepWaterHeater.close',
                labelKey: 'ribbon.commands.mepWaterHeaterEditor.close',
                icon: 'select',
                commandKey: MEP_WATER_HEATER_RIBBON_KEYS_ACTIONS.close,
                action: MEP_WATER_HEATER_RIBBON_KEYS_ACTIONS.close,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'mepWaterHeater.delete',
                labelKey: 'ribbon.commands.mepWaterHeaterEditor.delete',
                icon: 'trash',
                commandKey: MEP_WATER_HEATER_RIBBON_KEYS_ACTIONS.delete,
                action: MEP_WATER_HEATER_RIBBON_KEYS_ACTIONS.delete,
              },
            },
          ],
        },
      ],
    },
  ],
};
