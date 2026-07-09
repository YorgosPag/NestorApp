'use client';

/**
 * ADR-426 Slice 2 — «Αυτόματη Ύδρευση» (water-supply) ribbon bridge.
 *
 * Thin binding over `createRibbonMepAutoBridge` (ADR-609): the water-supply discipline
 * config — `designWaterSupply` engine + `buildWaterSupplyCommit` builder + the
 * `bim:water-supply-*` feedback triple. Same public API
 * (`useRibbonWaterAutoSupplyBridge(props) → { onAction }`).
 *
 * @see ./create-ribbon-mep-auto-bridge.ts — the parametric single source
 * @see ../../../systems/mep-design/water/design-water-supply.ts (engine)
 * @see ../../../systems/mep-design/water/commit/build-water-supply-commit.ts (commit builder)
 * @see docs/centralized-systems/reference/adrs/ADR-426-water-supply-auto-design.md
 */

import {
  createRibbonMepAutoBridge,
  type RibbonMepAutoBridgeProps,
  type RibbonMepAutoBridge,
} from './create-ribbon-mep-auto-bridge';
import { EventBus } from '../../../systems/events/EventBus';
import { designWaterSupply } from '../../../systems/mep-design/water';
import { waterProposalStore } from '../../../systems/mep-design/water/water-proposal-store';
import { buildWaterSupplyCommit } from '../../../systems/mep-design/water/commit/build-water-supply-commit';
import { WATER_SUPPLY_RIBBON_ACTIONS } from './bridge/water-auto-supply-command-keys';

export type UseRibbonWaterAutoSupplyBridgeProps = RibbonMepAutoBridgeProps;
export type RibbonWaterAutoSupplyBridge = RibbonMepAutoBridge;

export const useRibbonWaterAutoSupplyBridge = createRibbonMepAutoBridge({
  actions: WATER_SUPPLY_RIBBON_ACTIONS,
  store: waterProposalStore,
  design: (model, entities) => designWaterSupply(model, entities),
  buildCommit: buildWaterSupplyCommit,
  resolveNetworkName: (t, network, i) =>
    t('ribbon.commands.waterSupply.networkName', {
      service: t(`ribbon.commands.waterSupply.service.${network.service}`),
      n: i + 1,
    }),
  commandLabel: 'Generate water supply',
  emitEmpty: (hasWarnings) =>
    EventBus.emit('bim:water-supply-empty', { reason: hasWarnings ? 'no-source' : 'no-fixtures' }),
  emitGenerated: (networkCount, warningCount) =>
    EventBus.emit('bim:water-supply-generated', { networkCount, warningCount }),
  emitCommitted: (networkCount, segmentCount) =>
    EventBus.emit('bim:water-supply-committed', { networkCount, segmentCount }),
});
