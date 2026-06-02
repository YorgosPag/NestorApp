/**
 * ADR-408 Φ5 — Contextual ribbon tab for the MEP electrical circuit.
 *
 * Trigger: `mep-circuit-selectable` (dispatched from `useActiveContextualTrigger`
 * in `app/ribbon-contextual-config.ts` when the selection contains ≥1
 * electrical panel AND ≥1 light fixture — a panel = the circuit source, the
 * fixtures = its members, Revit "Power → Create Circuit").
 *
 * Panel (opening slice — action only):
 *   Circuit → «Δημιουργία κυκλώματος» + close
 *
 * Behaviour: bridge (`useRibbonMepCircuitBridge`) resolves the source/members
 * from the selection and dispatches a `CreateMepSystemCommand` (undoable). The
 * new circuit owns a deterministic palette colour; colour-by-system (Φ5.C)
 * paints the members.
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
