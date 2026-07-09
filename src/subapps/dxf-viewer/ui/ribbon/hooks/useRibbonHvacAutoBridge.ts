'use client';

/**
 * ADR-432 Slice 2 — «Αυτόματος Αερισμός» (HVAC / ventilation) ribbon bridge.
 *
 * Thin binding over `createRibbonMepAutoBridge` (ADR-609): the HVAC discipline config —
 * `designHvac` engine + `buildHvacCommit` builder + the `bim:hvac-*` feedback triple.
 * Same public API (`useRibbonHvacAutoBridge(props) → { onAction }`).
 *
 * @see ./create-ribbon-mep-auto-bridge.ts — the parametric single source
 * @see ../../../systems/mep-design/hvac/design-hvac.ts (engine)
 * @see ../../../systems/mep-design/hvac/commit/build-hvac-commit.ts (commit builder)
 * @see docs/centralized-systems/reference/adrs/ADR-432-hvac-auto-design.md
 */

import {
  createRibbonMepAutoBridge,
  type RibbonMepAutoBridgeProps,
  type RibbonMepAutoBridge,
} from './create-ribbon-mep-auto-bridge';
import { EventBus } from '../../../systems/events/EventBus';
import { designHvac } from '../../../systems/mep-design/hvac';
import { hvacProposalStore } from '../../../systems/mep-design/hvac/hvac-proposal-store';
import { buildHvacCommit } from '../../../systems/mep-design/hvac/commit/build-hvac-commit';
import { HVAC_AUTO_RIBBON_ACTIONS } from './bridge/hvac-auto-command-keys';

export type UseRibbonHvacAutoBridgeProps = RibbonMepAutoBridgeProps;
export type RibbonHvacAutoBridge = RibbonMepAutoBridge;

export const useRibbonHvacAutoBridge = createRibbonMepAutoBridge({
  actions: HVAC_AUTO_RIBBON_ACTIONS,
  store: hvacProposalStore,
  design: (model, entities) => designHvac(model, entities),
  buildCommit: buildHvacCommit,
  resolveNetworkName: (t, network, i) =>
    t('ribbon.commands.hvac.networkName', {
      service: t(`ribbon.commands.hvac.service.${network.service}`),
      n: i + 1,
    }),
  commandLabel: 'Generate ventilation',
  emitEmpty: (hasWarnings) =>
    EventBus.emit('bim:hvac-empty', { reason: hasWarnings ? 'no-source' : 'no-terminals' }),
  emitGenerated: (networkCount, warningCount) =>
    EventBus.emit('bim:hvac-generated', { networkCount, warningCount }),
  emitCommitted: (networkCount, segmentCount) =>
    EventBus.emit('bim:hvac-committed', { networkCount, segmentCount }),
});
