/**
 * ADR-408 Φ13 — Contextual ribbon tab for the MEP plumbing pipe-network.
 *
 * The water-distribution analogue of `contextual-mep-circuit-tab.ts`. Trigger:
 * `mep-pipe-network-selectable` (dispatched from `useActiveContextualTrigger` when
 * the selection contains a plumbing **manifold** (συλλέκτης = the network source)
 * AND ≥1 **pipe segment** — Revit "create a Piping System from the equipment + its
 * pipes"), or when a selected manifold already sources a network (manage mode).
 *
 * Panels:
 *   Ιδιότητες Δικτύου → network picker + όνομα + χρώμα + προσθήκη/αφαίρεση
 *     σωλήνων (εμφανίζεται όταν η επιλογή αγγίζει υπάρχον δίκτυο)
 *   Δίκτυο → «Δημιουργία δικτύου ύδρευσης» + close
 *
 * The properties panel **reuses the domain-agnostic** `mep-circuit-*` widgets
 * (picker / name / colour read `useMepCircuitEditorStore.activeSystemId` and edit
 * via `UpdateMepSystemParamsCommand` regardless of system type) — no fork. The
 * electrical-only wire-style / conductor rows are deliberately absent (they self-
 * hide for a pipe network anyway). The bridge (`useRibbonMepPipeNetworkBridge`)
 * resolves the source/members and dispatches an undoable `CreateMepSystemCommand`.
 *
 * @see ./contextual-mep-circuit-tab.ts — the electrical counterpart
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ13
 */

import type { RibbonTab } from '../types/ribbon-types';
import { MEP_PIPE_NETWORK_RIBBON_ACTIONS } from '../hooks/bridge/mep-pipe-network-command-keys';

export const MEP_PIPE_NETWORK_CONTEXTUAL_TRIGGER = 'mep-pipe-network-selectable';

export const CONTEXTUAL_MEP_PIPE_NETWORK_TAB: RibbonTab = {
  id: 'mep-pipe-network-editor',
  labelKey: 'ribbon.tabs.mepPipeNetwork',
  isContextual: true,
  contextualTrigger: MEP_PIPE_NETWORK_CONTEXTUAL_TRIGGER,
  panels: [
    {
      // ADR-408 Φ13 — manage the active network (rename / colour / members). The
      // widgets self-hide (return null) when there is no active network, so the
      // panel is inert in the pure create case (manifold + pipes, no network yet).
      id: 'mep-pipe-network-properties',
      labelKey: 'ribbon.panels.mepPipeNetworkProperties',
      rows: [
        {
          // Row 1 — network selector (spans the panel width). Reuses the shared
          // (system-agnostic) circuit picker widget.
          isInFlyout: false,
          buttons: [
            {
              type: 'widget',
              size: 'small',
              widgetId: 'mep-circuit-picker',
              command: {
                id: 'mepPipeNetwork.picker',
                labelKey: 'ribbon.commands.mepCircuit.circuitPicker',
                commandKey: 'mepPipeNetwork.picker',
              },
            },
          ],
        },
        {
          // Row 2 — classification ("System Type": ύδρευση/θέρμανση). Reuses the
          // dedicated pipe-network classification widget (self-hides when the active
          // system is not a pipe network). ADR-408 Φ-heating.
          isInFlyout: false,
          buttons: [
            {
              type: 'widget',
              size: 'small',
              widgetId: 'mep-network-classification',
              command: {
                id: 'mepPipeNetwork.classification',
                labelKey: 'ribbon.commands.mepClassification.label',
                commandKey: 'mepPipeNetwork.classification',
              },
            },
          ],
        },
        {
          // Row 3 — name (left column) + add-members action (right column).
          isInFlyout: false,
          buttons: [
            {
              type: 'widget',
              size: 'small',
              widgetId: 'mep-circuit-name',
              command: {
                id: 'mepPipeNetwork.name',
                labelKey: 'ribbon.commands.mepCircuit.name',
                commandKey: 'mepPipeNetwork.name',
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'mepPipeNetwork.addMembers',
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
          // Row 3 — colour (left column) + remove-members action (right column).
          isInFlyout: false,
          buttons: [
            {
              type: 'widget',
              size: 'small',
              widgetId: 'mep-circuit-color',
              command: {
                id: 'mepPipeNetwork.color',
                labelKey: 'ribbon.commands.mepCircuit.color',
                commandKey: 'mepPipeNetwork.color',
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'mepPipeNetwork.removeMembers',
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
      id: 'mep-pipe-network-actions',
      labelKey: 'ribbon.panels.mepPipeNetwork',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'large',
              command: {
                id: 'mepPipeNetwork.create',
                labelKey: 'ribbon.commands.mepPipeNetwork.create',
                tooltipKey: 'ribbon.commands.mepPipeNetwork.createTooltip',
                icon: 'bim-mep-manifold',
                commandKey: MEP_PIPE_NETWORK_RIBBON_ACTIONS.create,
                action: MEP_PIPE_NETWORK_RIBBON_ACTIONS.create,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'mepPipeNetwork.close',
                labelKey: 'ribbon.commands.mepPipeNetwork.close',
                icon: 'select',
                commandKey: MEP_PIPE_NETWORK_RIBBON_ACTIONS.close,
                action: MEP_PIPE_NETWORK_RIBBON_ACTIONS.close,
              },
            },
          ],
        },
      ],
    },
  ],
};
