/**
 * ADR-408 Εύρος Β — Contextual ribbon tab για τον heating boiler (λέβητα).
 *
 * Trigger: `mep-boiler-selected` (dispatched από `resolveContextualTrigger`
 * στο `app/ribbon-contextual-config.ts` όταν το primary-selected entity έχει
 * `type === 'mep-boiler'`). Συνδυασμός του «Ιδιότητες Καλοριφέρ» (ADR-408 Εύρος Β)
 * + του «Δίκτυο» fold-in panel του «Ιδιότητες Συλλέκτη» (ADR-408 Φ12) — ο λέβητας
 * είναι ΥΔΡΟΝΙΚΗ ΠΗΓΗ (≠ καλοριφέρ που είναι τερματικό), επομένως μπορεί να
 * τροφοδοτεί δίκτυο σωλήνων.
 *
 * Panels:
 *   Geometry → width + length + body height + mounting elevation
 *   Thermal  → connector diameter + thermal output (W, catalogue)
 *   Δίκτυο   → fold-in (self-hiding): picker / name + addMembers / color + removeMembers
 *   Actions  → close + delete
 *
 * Live behavior: ο bridge (`useRibbonMepBoilerBridge`) dispatch-άρει updates σε
 * κάθε combobox change μέσω `UpdateMepBoilerParamsCommand` (undoable). Το command
 * ΗΔΗ ξανακάνει seed τους connectors από το `width`, οπότε ο bridge δεν χρειάζεται
 * να τους προ-υπολογίσει (≠ manifold).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { RibbonTab } from '../types/ribbon-types';
import {
  MEP_BOILER_RIBBON_KEYS,
  MEP_BOILER_RIBBON_KEYS_ACTIONS,
  MEP_BOILER_RIBBON_VISIBILITY_KEYS,
} from '../hooks/bridge/mep-boiler-command-keys';
import { MEP_PIPE_NETWORK_RIBBON_ACTIONS } from '../hooks/bridge/mep-pipe-network-command-keys';

export const MEP_BOILER_CONTEXTUAL_TRIGGER = 'mep-boiler-selected';

// ─── Combobox options (mm presets) ───────────────────────────────────────────

// Body width (mm) — the largest horizontal dimension of the boiler cabinet.
const WIDTH_MM_OPTIONS = [
  { value: '400',  labelKey: '400',  isLiteralLabel: true },
  { value: '450',  labelKey: '450',  isLiteralLabel: true },
  { value: '600',  labelKey: '600',  isLiteralLabel: true },
  { value: '800',  labelKey: '800',  isLiteralLabel: true },
] as const;

// Depth (mm) — front-to-back depth of the boiler cabinet.
const LENGTH_MM_OPTIONS = [
  { value: '250', labelKey: '250', isLiteralLabel: true },
  { value: '300', labelKey: '300', isLiteralLabel: true },
  { value: '350', labelKey: '350', isLiteralLabel: true },
  { value: '450', labelKey: '450', isLiteralLabel: true },
] as const;

// Body vertical height (mm) — typical wall-hung boiler heights.
const BODY_HEIGHT_MM_OPTIONS = [
  { value: '500', labelKey: '500', isLiteralLabel: true },
  { value: '700', labelKey: '700', isLiteralLabel: true },
  { value: '900', labelKey: '900', isLiteralLabel: true },
] as const;

// Floor-relative mounting elevation (mm) — vertical centre (wall-mounted boiler).
const MOUNTING_ELEVATION_MM_OPTIONS = [
  { value: '900',  labelKey: '900',  isLiteralLabel: true },
  { value: '1200', labelKey: '1200', isLiteralLabel: true },
  { value: '1500', labelKey: '1500', isLiteralLabel: true },
] as const;

// Supply/return connector diameter (mm) — typical hydronic boiler tails.
const CONNECTOR_DIAMETER_MM_OPTIONS = [
  { value: '15', labelKey: '15', isLiteralLabel: true },
  { value: '18', labelKey: '18', isLiteralLabel: true },
  { value: '22', labelKey: '22', isLiteralLabel: true },
  { value: '28', labelKey: '28', isLiteralLabel: true },
] as const;

// Nominal catalogue thermal output (W) — typical residential/commercial boiler range.
const THERMAL_OUTPUT_W_OPTIONS = [
  { value: '6000',  labelKey: '6000',  isLiteralLabel: true },
  { value: '12000', labelKey: '12000', isLiteralLabel: true },
  { value: '18000', labelKey: '18000', isLiteralLabel: true },
  { value: '24000', labelKey: '24000', isLiteralLabel: true },
  { value: '35000', labelKey: '35000', isLiteralLabel: true },
] as const;

// ─── Tab definition ──────────────────────────────────────────────────────────

export const CONTEXTUAL_MEP_BOILER_TAB: RibbonTab = {
  id: 'mep-boiler-editor',
  labelKey: 'ribbon.tabs.mepBoilerProperties',
  isContextual: true,
  contextualTrigger: MEP_BOILER_CONTEXTUAL_TRIGGER,
  panels: [
    {
      id: 'mep-boiler-geometry',
      labelKey: 'ribbon.panels.mepBoilerGeometry',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepBoiler.width',
                labelKey: 'ribbon.commands.mepBoilerEditor.width',
                commandKey: MEP_BOILER_RIBBON_KEYS.params.width,
                comboboxWidthPx: 90,
                options: WIDTH_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepBoiler.length',
                labelKey: 'ribbon.commands.mepBoilerEditor.length',
                commandKey: MEP_BOILER_RIBBON_KEYS.params.length,
                comboboxWidthPx: 80,
                options: LENGTH_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepBoiler.bodyHeight',
                labelKey: 'ribbon.commands.mepBoilerEditor.bodyHeight',
                commandKey: MEP_BOILER_RIBBON_KEYS.params.bodyHeight,
                comboboxWidthPx: 80,
                options: BODY_HEIGHT_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepBoiler.mountingElevation',
                labelKey: 'ribbon.commands.mepBoilerEditor.mountingElevation',
                commandKey: MEP_BOILER_RIBBON_KEYS.params.mountingElevation,
                comboboxWidthPx: 90,
                options: MOUNTING_ELEVATION_MM_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'mep-boiler-thermal',
      labelKey: 'ribbon.panels.mepBoilerThermal',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepBoiler.connectorDiameter',
                labelKey: 'ribbon.commands.mepBoilerEditor.connectorDiameter',
                commandKey: MEP_BOILER_RIBBON_KEYS.params.connectorDiameter,
                comboboxWidthPx: 80,
                options: CONNECTOR_DIAMETER_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepBoiler.thermalOutput',
                labelKey: 'ribbon.commands.mepBoilerEditor.thermalOutput',
                commandKey: MEP_BOILER_RIBBON_KEYS.params.thermalOutput,
                comboboxWidthPx: 90,
                options: THERMAL_OUTPUT_W_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    // ADR-408 Εύρος Β — fold-in panel: διαχείριση υδρονικού δικτύου που πηγάζει
    // από τον λέβητα (Revit "System Properties" from the equipment). Self-hides
    // όταν δεν υπάρχει δίκτυο. Reuse των domain-agnostic mep-circuit-* widgets +
    // pipe-network actions (ίδια με τον συλλέκτη, ADR-408 Φ13).
    {
      id: 'mep-boiler-network',
      labelKey: 'ribbon.panels.mepPipeNetworkProperties',
      visibilityKey: MEP_BOILER_RIBBON_VISIBILITY_KEYS.hasNetwork,
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'widget',
              size: 'small',
              widgetId: 'mep-circuit-picker',
              command: {
                id: 'mepBoiler.network.picker',
                labelKey: 'ribbon.commands.mepCircuit.networkPicker',
                commandKey: 'mepBoiler.network.picker',
              },
            },
          ],
        },
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'widget',
              size: 'small',
              widgetId: 'mep-circuit-name',
              command: {
                id: 'mepBoiler.network.name',
                labelKey: 'ribbon.commands.mepCircuit.name',
                commandKey: 'mepBoiler.network.name',
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'mepBoiler.network.addMembers',
                labelKey: 'ribbon.commands.mepPipeNetwork.addMembers',
                tooltipKey: 'ribbon.commands.mepPipeNetwork.addMembersTooltip',
                icon: 'bim-pipe',
                commandKey: MEP_PIPE_NETWORK_RIBBON_ACTIONS.addMembers,
                action: MEP_PIPE_NETWORK_RIBBON_ACTIONS.addMembers,
              },
            },
          ],
        },
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'widget',
              size: 'small',
              widgetId: 'mep-circuit-color',
              command: {
                id: 'mepBoiler.network.color',
                labelKey: 'ribbon.commands.mepCircuit.color',
                commandKey: 'mepBoiler.network.color',
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'mepBoiler.network.removeMembers',
                labelKey: 'ribbon.commands.mepPipeNetwork.removeMembers',
                tooltipKey: 'ribbon.commands.mepPipeNetwork.removeMembersTooltip',
                icon: 'trash',
                commandKey: MEP_PIPE_NETWORK_RIBBON_ACTIONS.removeMembers,
                action: MEP_PIPE_NETWORK_RIBBON_ACTIONS.removeMembers,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'mep-boiler-actions',
      labelKey: 'ribbon.panels.mepBoilerActions',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'mepBoiler.close',
                labelKey: 'ribbon.commands.mepBoilerEditor.close',
                icon: 'select',
                commandKey: MEP_BOILER_RIBBON_KEYS_ACTIONS.close,
                action: MEP_BOILER_RIBBON_KEYS_ACTIONS.close,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'mepBoiler.delete',
                labelKey: 'ribbon.commands.mepBoilerEditor.delete',
                icon: 'trash',
                commandKey: MEP_BOILER_RIBBON_KEYS_ACTIONS.delete,
                action: MEP_BOILER_RIBBON_KEYS_ACTIONS.delete,
              },
            },
          ],
        },
      ],
    },
  ],
};
