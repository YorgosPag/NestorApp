/**
 * ADR-408 Εύρος Β #3 — Contextual ribbon tab for the underfloor heating loop
 * (ενδοδαπέδια θέρμανση).
 *
 * Trigger: `mep-underfloor-selected` (dispatched by `resolveContextualTrigger` in
 * `app/ribbon-contextual-config.ts` when the primary-selected entity has
 * `type === 'mep-underfloor'`). Mirrors `contextual-mep-boiler-tab.ts`, adapted to
 * the area-loop params + a «Δίκτυο» fold-in panel (the loop is a hydronic TERMINAL,
 * a member of a supply + return network).
 *
 * Panels:
 *   Geometry → pipe spacing + edge clearance + pattern selector + total-length readout
 *   Thermal  → screed offset + connector diameter + thermal output (W, catalogue)
 *   Δίκτυο   → fold-in (self-hiding): picker / name + addMembers / color + removeMembers
 *   Actions  → close + delete
 *
 * Live behavior: the bridge (`useRibbonMepUnderfloorBridge`) dispatches updates on
 * every combobox change via `UpdateMepUnderfloorParamsCommand` (undoable) and rebuilds
 * the two entry connectors from the SSoT.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { RibbonTab } from '../types/ribbon-types';
import {
  MEP_UNDERFLOOR_RIBBON_KEYS,
  MEP_UNDERFLOOR_RIBBON_KEYS_ACTIONS,
  MEP_UNDERFLOOR_RIBBON_VISIBILITY_KEYS,
} from '../hooks/bridge/mep-underfloor-command-keys';
import { MEP_PIPE_NETWORK_RIBBON_ACTIONS } from '../hooks/bridge/mep-pipe-network-command-keys';

export const MEP_UNDERFLOOR_CONTEXTUAL_TRIGGER = 'mep-underfloor-selected';

// ─── Combobox options (mm presets) ───────────────────────────────────────────

// Centre-to-centre pipe spacing (mm) — typical residential radiant-floor range.
const PIPE_SPACING_MM_OPTIONS = [
  { value: '100', labelKey: '100', isLiteralLabel: true },
  { value: '150', labelKey: '150', isLiteralLabel: true },
  { value: '200', labelKey: '200', isLiteralLabel: true },
  { value: '250', labelKey: '250', isLiteralLabel: true },
] as const;

// Edge clearance (mm) — inset from the room walls before the field starts.
const EDGE_CLEARANCE_MM_OPTIONS = [
  { value: '50',  labelKey: '50',  isLiteralLabel: true },
  { value: '100', labelKey: '100', isLiteralLabel: true },
  { value: '150', labelKey: '150', isLiteralLabel: true },
  { value: '200', labelKey: '200', isLiteralLabel: true },
] as const;

// Serpentine layout pattern (enum). Translated labels.
const PATTERN_TYPE_OPTIONS = [
  { value: 'boustrophedon', labelKey: 'ribbon.commands.mepUnderfloorEditor.patternBoustrophedon' },
  { value: 'counterflow-spiral', labelKey: 'ribbon.commands.mepUnderfloorEditor.patternCounterflow' },
] as const;

// Screed offset (mm) — pipe centreline elevation above FFL.
const SCREED_OFFSET_MM_OPTIONS = [
  { value: '30', labelKey: '30', isLiteralLabel: true },
  { value: '50', labelKey: '50', isLiteralLabel: true },
  { value: '70', labelKey: '70', isLiteralLabel: true },
] as const;

// Supply/return connector diameter (mm) — typical PEX loop tails.
const CONNECTOR_DIAMETER_MM_OPTIONS = [
  { value: '16', labelKey: '16', isLiteralLabel: true },
  { value: '18', labelKey: '18', isLiteralLabel: true },
  { value: '20', labelKey: '20', isLiteralLabel: true },
] as const;

// Nominal catalogue thermal output (W) — typical per-loop range.
const THERMAL_OUTPUT_W_OPTIONS = [
  { value: '1000', labelKey: '1000', isLiteralLabel: true },
  { value: '2000', labelKey: '2000', isLiteralLabel: true },
  { value: '3000', labelKey: '3000', isLiteralLabel: true },
  { value: '4000', labelKey: '4000', isLiteralLabel: true },
] as const;

// ─── Tab definition ──────────────────────────────────────────────────────────

export const CONTEXTUAL_MEP_UNDERFLOOR_TAB: RibbonTab = {
  id: 'mep-underfloor-editor',
  labelKey: 'ribbon.tabs.mepUnderfloorProperties',
  isContextual: true,
  contextualTrigger: MEP_UNDERFLOOR_CONTEXTUAL_TRIGGER,
  panels: [
    {
      id: 'mep-underfloor-geometry',
      labelKey: 'ribbon.panels.mepUnderfloorGeometry',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepUnderfloor.pipeSpacing',
                labelKey: 'ribbon.commands.mepUnderfloorEditor.pipeSpacing',
                commandKey: MEP_UNDERFLOOR_RIBBON_KEYS.params.pipeSpacing,
                comboboxWidthPx: 80,
                options: PIPE_SPACING_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepUnderfloor.edgeClearance',
                labelKey: 'ribbon.commands.mepUnderfloorEditor.edgeClearance',
                commandKey: MEP_UNDERFLOOR_RIBBON_KEYS.params.edgeClearance,
                comboboxWidthPx: 80,
                options: EDGE_CLEARANCE_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepUnderfloor.patternType',
                labelKey: 'ribbon.commands.mepUnderfloorEditor.patternType',
                commandKey: MEP_UNDERFLOOR_RIBBON_KEYS.params.patternType,
                comboboxWidthPx: 150,
                options: PATTERN_TYPE_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepUnderfloor.totalLength',
                labelKey: 'ribbon.commands.mepUnderfloorEditor.totalLength',
                commandKey: MEP_UNDERFLOOR_RIBBON_KEYS.params.totalLength,
                comboboxWidthPx: 90,
                options: [],
              },
            },
          ],
        },
      ],
    },
    {
      id: 'mep-underfloor-thermal',
      labelKey: 'ribbon.panels.mepUnderfloorThermal',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepUnderfloor.screedOffset',
                labelKey: 'ribbon.commands.mepUnderfloorEditor.screedOffset',
                commandKey: MEP_UNDERFLOOR_RIBBON_KEYS.params.screedOffset,
                comboboxWidthPx: 80,
                options: SCREED_OFFSET_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepUnderfloor.connectorDiameter',
                labelKey: 'ribbon.commands.mepUnderfloorEditor.connectorDiameter',
                commandKey: MEP_UNDERFLOOR_RIBBON_KEYS.params.connectorDiameter,
                comboboxWidthPx: 80,
                options: CONNECTOR_DIAMETER_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepUnderfloor.thermalOutput',
                labelKey: 'ribbon.commands.mepUnderfloorEditor.thermalOutput',
                commandKey: MEP_UNDERFLOOR_RIBBON_KEYS.params.thermalOutput,
                comboboxWidthPx: 90,
                options: THERMAL_OUTPUT_W_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    // ADR-408 Εύρος Β #3 — fold-in panel: hydronic network the loop is a member of
    // (Revit "System Properties" from the terminal). Self-hides when no network.
    // Reuse of the domain-agnostic mep-circuit-* widgets + pipe-network actions.
    {
      id: 'mep-underfloor-network',
      labelKey: 'ribbon.panels.mepPipeNetworkProperties',
      visibilityKey: MEP_UNDERFLOOR_RIBBON_VISIBILITY_KEYS.hasNetwork,
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'widget',
              size: 'small',
              widgetId: 'mep-circuit-picker',
              command: {
                id: 'mepUnderfloor.network.picker',
                labelKey: 'ribbon.commands.mepCircuit.networkPicker',
                commandKey: 'mepUnderfloor.network.picker',
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
                id: 'mepUnderfloor.network.name',
                labelKey: 'ribbon.commands.mepCircuit.name',
                commandKey: 'mepUnderfloor.network.name',
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'mepUnderfloor.network.addMembers',
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
                id: 'mepUnderfloor.network.color',
                labelKey: 'ribbon.commands.mepCircuit.color',
                commandKey: 'mepUnderfloor.network.color',
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'mepUnderfloor.network.removeMembers',
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
      id: 'mep-underfloor-actions',
      labelKey: 'ribbon.panels.mepUnderfloorActions',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'mepUnderfloor.close',
                labelKey: 'ribbon.commands.mepUnderfloorEditor.close',
                icon: 'select',
                commandKey: MEP_UNDERFLOOR_RIBBON_KEYS_ACTIONS.close,
                action: MEP_UNDERFLOOR_RIBBON_KEYS_ACTIONS.close,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'mepUnderfloor.delete',
                labelKey: 'ribbon.commands.mepUnderfloorEditor.delete',
                icon: 'trash',
                commandKey: MEP_UNDERFLOOR_RIBBON_KEYS_ACTIONS.delete,
                action: MEP_UNDERFLOOR_RIBBON_KEYS_ACTIONS.delete,
              },
            },
          ],
        },
      ],
    },
  ],
};
