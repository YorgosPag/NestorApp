/**
 * MEP NETWORK PANEL ROWS — SSoT for the "hydronic network" fold-in panel shared by
 * every pipe-network terminal tab (boiler, underfloor loop, water heater, manifold).
 *
 * ADR-408 Εύρος Β #3 — each terminal tab exposes the SAME three rows (picker /
 * name+addMembers / colour+removeMembers) built on the domain-agnostic
 * `mep-circuit-*` widgets and the `MEP_PIPE_NETWORK_RIBBON_ACTIONS` command keys.
 * The ONLY thing that varies per host is the command-id prefix (`mepBoiler`,
 * `mepUnderfloor`, …). Hand-writing the block per tab duplicated ~60 tokens × 4
 * files (flagged by CHECK 3.28 / jscpd, ADR-583) — this builder is the single
 * source. Add a new pipe-network terminal ⇒ call this, do not copy the block.
 *
 * NOTE: `contextual-mep-circuit-tab.ts` and `contextual-electrical-panel-tab.ts`
 * deliberately do NOT use this builder — they drive `MEP_CIRCUIT_RIBBON_ACTIONS`
 * (electrical circuits), a different command family with a different icon set.
 *
 * @see ./contextual-mep-boiler-tab.ts
 * @see ./contextual-mep-underfloor-tab.ts
 * @see ./contextual-mep-water-heater-tab.ts
 * @see ./mep-manifold-contextual-tab-factory.ts
 */

import type { RibbonTab } from '../types/ribbon-types';
import { MEP_PIPE_NETWORK_RIBBON_ACTIONS } from '../hooks/bridge/mep-pipe-network-command-keys';

type PanelRows = RibbonTab['panels'][number]['rows'];

/**
 * Build the three network rows for a pipe-network terminal tab.
 *
 * @param idPrefix command-id namespace of the host tab (e.g. `'mepBoiler'`) —
 *                 yields ids like `mepBoiler.network.addMembers`.
 */
export function mepNetworkPanelRows(idPrefix: string): PanelRows {
  return [
    {
      isInFlyout: false,
      buttons: [
        {
          type: 'widget',
          size: 'small',
          widgetId: 'mep-circuit-picker',
          command: {
            id: `${idPrefix}.network.picker`,
            labelKey: 'ribbon.commands.mepCircuit.networkPicker',
            commandKey: `${idPrefix}.network.picker`,
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
            id: `${idPrefix}.network.name`,
            labelKey: 'ribbon.commands.mepCircuit.name',
            commandKey: `${idPrefix}.network.name`,
          },
        },
        {
          type: 'simple',
          size: 'small',
          command: {
            id: `${idPrefix}.network.addMembers`,
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
            id: `${idPrefix}.network.color`,
            labelKey: 'ribbon.commands.mepCircuit.color',
            commandKey: `${idPrefix}.network.color`,
          },
        },
        {
          type: 'simple',
          size: 'small',
          command: {
            id: `${idPrefix}.network.removeMembers`,
            labelKey: 'ribbon.commands.mepPipeNetwork.removeMembers',
            tooltipKey: 'ribbon.commands.mepPipeNetwork.removeMembersTooltip',
            icon: 'trash',
            commandKey: MEP_PIPE_NETWORK_RIBBON_ACTIONS.removeMembers,
            action: MEP_PIPE_NETWORK_RIBBON_ACTIONS.removeMembers,
          },
        },
      ],
    },
  ];
}
