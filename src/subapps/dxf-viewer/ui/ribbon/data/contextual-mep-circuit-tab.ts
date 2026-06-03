/**
 * ADR-408 Φ5 — Contextual ribbon tab for the MEP electrical circuit.
 *
 * Trigger: `mep-circuit-selectable` (dispatched from `useActiveContextualTrigger`
 * in `app/ribbon-contextual-config.ts` when the selection contains ≥1
 * electrical panel AND ≥1 light fixture — a panel = the circuit source, the
 * fixtures = its members, Revit "Power → Create Circuit").
 *
 * Panels:
 *   Ιδιότητες Κυκλώματος (Φ6) → circuit picker + όνομα + χρώμα + προσθήκη/
 *     αφαίρεση μελών (εμφανίζεται όταν η επιλογή αγγίζει υπάρχον κύκλωμα)
 *   Circuit → «Δημιουργία κυκλώματος» + close
 *
 * Behaviour: bridge (`useRibbonMepCircuitBridge`) resolves the source/members
 * from the selection and dispatches a `CreateMepSystemCommand` (undoable). The
 * new circuit owns a deterministic palette colour; colour-by-system (Φ5.C)
 * paints the members. The Φ6 properties panel edits the **active circuit**
 * (`useMepCircuitEditorStore`, synced from the selection) — rename / colour via
 * leaf widgets, add/remove members via the bridge — all through the undoable
 * `UpdateMepSystemParamsCommand`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { RibbonTab } from '../types/ribbon-types';
import { MEP_CIRCUIT_RIBBON_ACTIONS } from '../hooks/bridge/mep-circuit-command-keys';

export const MEP_CIRCUIT_CONTEXTUAL_TRIGGER = 'mep-circuit-selectable';

export const CONTEXTUAL_MEP_CIRCUIT_TAB: RibbonTab = {
  id: 'mep-circuit-editor',
  labelKey: 'ribbon.tabs.mepCircuit',
  isContextual: true,
  contextualTrigger: MEP_CIRCUIT_CONTEXTUAL_TRIGGER,
  panels: [
    {
      // ADR-408 Φ6/Φ7 — manage the active circuit (rename / colour / members /
      // wire style). The widgets self-hide (return null) when there is no active
      // circuit, so the panel is inert in the pure create case (panel + fixtures,
      // no circuit yet).
      id: 'mep-circuit-properties',
      labelKey: 'ribbon.panels.mepCircuitProperties',
      rows: [
        {
          // Row 1 — circuit selector (spans the panel width).
          isInFlyout: false,
          buttons: [
            {
              type: 'widget',
              size: 'small',
              widgetId: 'mep-circuit-picker',
              command: {
                id: 'mepCircuit.picker',
                labelKey: 'ribbon.commands.mepCircuit.circuitPicker',
                commandKey: 'mepCircuit.picker',
              },
            },
          ],
        },
        {
          // Row 2 — name (left column) + add-members action (right column).
          isInFlyout: false,
          buttons: [
            {
              type: 'widget',
              size: 'small',
              widgetId: 'mep-circuit-name',
              command: {
                id: 'mepCircuit.name',
                labelKey: 'ribbon.commands.mepCircuit.name',
                commandKey: 'mepCircuit.name',
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'mepCircuit.addMembers',
                labelKey: 'ribbon.commands.mepCircuit.addMembers',
                tooltipKey: 'ribbon.commands.mepCircuit.addMembersTooltip',
                icon: 'bim-mep-fixture',
                commandKey: MEP_CIRCUIT_RIBBON_ACTIONS.addMembers,
                action: MEP_CIRCUIT_RIBBON_ACTIONS.addMembers,
              },
            },
          ],
        },
        {
          // Row 3 — colour (left column) + remove-members action (right column).
          isInFlyout: false,
          buttons: [
            {
              type: 'widget',
              size: 'small',
              widgetId: 'mep-circuit-color',
              command: {
                id: 'mepCircuit.color',
                labelKey: 'ribbon.commands.mepCircuit.color',
                commandKey: 'mepCircuit.color',
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'mepCircuit.removeMembers',
                labelKey: 'ribbon.commands.mepCircuit.removeMembers',
                tooltipKey: 'ribbon.commands.mepCircuit.removeMembersTooltip',
                icon: 'trash',
                commandKey: MEP_CIRCUIT_RIBBON_ACTIONS.removeMembers,
                action: MEP_CIRCUIT_RIBBON_ACTIONS.removeMembers,
              },
            },
          ],
        },
        {
          // Row 4 — wire style ("Wiring Type"): straight / orthogonal / arc (Φ7).
          isInFlyout: false,
          buttons: [
            {
              type: 'widget',
              size: 'small',
              widgetId: 'mep-circuit-wire-style',
              command: {
                id: 'mepCircuit.wireStyle',
                labelKey: 'ribbon.commands.mepWireStyle.label',
                commandKey: 'mepCircuit.wireStyle',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'mep-circuit-actions',
      labelKey: 'ribbon.panels.mepCircuit',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'large',
              command: {
                id: 'mepCircuit.create',
                labelKey: 'ribbon.commands.mepCircuit.create',
                tooltipKey: 'ribbon.commands.mepCircuit.createTooltip',
                icon: 'bim-electrical-panel',
                commandKey: MEP_CIRCUIT_RIBBON_ACTIONS.create,
                action: MEP_CIRCUIT_RIBBON_ACTIONS.create,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'mepCircuit.close',
                labelKey: 'ribbon.commands.mepCircuit.close',
                icon: 'select',
                commandKey: MEP_CIRCUIT_RIBBON_ACTIONS.close,
                action: MEP_CIRCUIT_RIBBON_ACTIONS.close,
              },
            },
          ],
        },
      ],
    },
  ],
};
