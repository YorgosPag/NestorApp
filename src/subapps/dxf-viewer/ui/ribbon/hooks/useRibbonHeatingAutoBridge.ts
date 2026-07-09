'use client';

/**
 * ADR-428 Slice 2 — «Αυτόματη Θέρμανση» (heating / hydronic) ribbon bridge.
 *
 * Thin binding over `createRibbonMepAutoBridge` (ADR-609): the heating discipline
 * config — `designHeating` engine + `buildHeatingCommit` builder + the `bim:heating-*`
 * feedback triple. The name resolver keys off `network.role` (supply/return loop), not
 * an index. Same public API (`useRibbonHeatingAutoBridge(props) → { onAction }`).
 *
 * @see ./create-ribbon-mep-auto-bridge.ts — the parametric single source
 * @see ../../../systems/mep-design/heating/design-heating.ts (engine)
 * @see ../../../systems/mep-design/heating/commit/build-heating-commit.ts (commit builder)
 * @see docs/centralized-systems/reference/adrs/ADR-428-heating-auto-design.md
 */

import {
  createRibbonMepAutoBridge,
  type RibbonMepAutoBridgeProps,
  type RibbonMepAutoBridge,
} from './create-ribbon-mep-auto-bridge';
import { EventBus } from '../../../systems/events/EventBus';
import { designHeating } from '../../../systems/mep-design/heating';
import { heatingProposalStore } from '../../../systems/mep-design/heating/heating-proposal-store';
import { buildHeatingCommit } from '../../../systems/mep-design/heating/commit/build-heating-commit';
import { HEATING_AUTO_RIBBON_ACTIONS } from './bridge/heating-auto-command-keys';

export type UseRibbonHeatingAutoBridgeProps = RibbonMepAutoBridgeProps;
export type RibbonHeatingAutoBridge = RibbonMepAutoBridge;

export const useRibbonHeatingAutoBridge = createRibbonMepAutoBridge({
  actions: HEATING_AUTO_RIBBON_ACTIONS,
  store: heatingProposalStore,
  // designHeating takes (model, entities) only — the closed loop is flat (no slope), so
  // it needs no sceneUnits (unlike designDrainage). sceneUnits is carried separately for
  // the ghost (mm → canvas) and the commit (segment build).
  design: (model, entities) => designHeating(model, entities),
  buildCommit: buildHeatingCommit,
  resolveNetworkName: (t, network) =>
    network.role === 'supply'
      ? t('ribbon.commands.heating.supplyName')
      : t('ribbon.commands.heating.returnName'),
  commandLabel: 'Generate heating',
  emitEmpty: (hasWarnings) =>
    EventBus.emit('bim:heating-empty', { reason: hasWarnings ? 'no-source' : 'no-terminals' }),
  emitGenerated: (networkCount, warningCount) =>
    EventBus.emit('bim:heating-generated', { networkCount, warningCount }),
  emitCommitted: (networkCount, segmentCount) =>
    EventBus.emit('bim:heating-committed', { networkCount, segmentCount }),
});
