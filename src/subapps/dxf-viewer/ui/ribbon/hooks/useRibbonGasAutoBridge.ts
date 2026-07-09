'use client';

/**
 * ADR-434 Slice 2 — «Αυτόματο Αέριο» (gas / φυσικό αέριο) ribbon bridge.
 *
 * Thin binding over `createRibbonMepAutoBridge` (ADR-609): the gas discipline config —
 * `designGas` engine + `buildGasCommit` builder + the `bim:gas-*` feedback triple.
 * Same public API (`useRibbonGasAutoBridge(props) → { onAction }`).
 *
 * @see ./create-ribbon-mep-auto-bridge.ts — the parametric single source
 * @see ../../../systems/mep-design/gas/design-gas.ts (engine)
 * @see ../../../systems/mep-design/gas/commit/build-gas-commit.ts (commit builder)
 * @see docs/centralized-systems/reference/adrs/ADR-434-gas-auto-design.md
 */

import {
  createRibbonMepAutoBridge,
  type RibbonMepAutoBridgeProps,
  type RibbonMepAutoBridge,
} from './create-ribbon-mep-auto-bridge';
import { EventBus } from '../../../systems/events/EventBus';
import { designGas } from '../../../systems/mep-design/gas';
import { gasProposalStore } from '../../../systems/mep-design/gas/gas-proposal-store';
import { buildGasCommit } from '../../../systems/mep-design/gas/commit/build-gas-commit';
import { GAS_AUTO_RIBBON_ACTIONS } from './bridge/gas-auto-command-keys';

export type UseRibbonGasAutoBridgeProps = RibbonMepAutoBridgeProps;
export type RibbonGasAutoBridge = RibbonMepAutoBridge;

export const useRibbonGasAutoBridge = createRibbonMepAutoBridge({
  actions: GAS_AUTO_RIBBON_ACTIONS,
  store: gasProposalStore,
  design: (model, entities) => designGas(model, entities),
  buildCommit: buildGasCommit,
  resolveNetworkName: (t, network, i) =>
    t('ribbon.commands.gas.networkName', {
      service: t(`ribbon.commands.gas.service.${network.service}`),
      n: i + 1,
    }),
  commandLabel: 'Generate gas supply',
  emitEmpty: (hasWarnings) =>
    EventBus.emit('bim:gas-empty', { reason: hasWarnings ? 'no-source' : 'no-terminals' }),
  emitGenerated: (networkCount, warningCount) =>
    EventBus.emit('bim:gas-generated', { networkCount, warningCount }),
  emitCommitted: (networkCount, segmentCount) =>
    EventBus.emit('bim:gas-committed', { networkCount, segmentCount }),
});
