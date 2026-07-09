'use client';

/**
 * ADR-427 Slice 2 — «Αυτόματη Αποχέτευση» (sanitary-drainage) ribbon bridge.
 *
 * Thin binding over `createRibbonMepAutoBridge` (ADR-609): the drainage discipline
 * config — `designDrainage` engine + `buildDrainageCommit` builder + the
 * `bim:drainage-*` feedback triple. The only gravity discipline: `designDrainage` reads
 * `sceneUnits` (the 3rd arg the factory passes) for the slope rise, and the `-empty`
 * reasons are `no-collector` / `no-fixtures`. Same public API
 * (`useRibbonDrainageAutoBridge(props) → { onAction }`).
 *
 * @see ./create-ribbon-mep-auto-bridge.ts — the parametric single source
 * @see ../../../systems/mep-design/drainage/design-drainage.ts (engine)
 * @see ../../../systems/mep-design/drainage/commit/build-drainage-commit.ts (commit builder)
 * @see docs/centralized-systems/reference/adrs/ADR-427-sanitary-drainage-auto-design.md
 */

import {
  createRibbonMepAutoBridge,
  type RibbonMepAutoBridgeProps,
  type RibbonMepAutoBridge,
} from './create-ribbon-mep-auto-bridge';
import { EventBus } from '../../../systems/events/EventBus';
import { designDrainage } from '../../../systems/mep-design/drainage';
import { drainageProposalStore } from '../../../systems/mep-design/drainage/drainage-proposal-store';
import { buildDrainageCommit } from '../../../systems/mep-design/drainage/commit/build-drainage-commit';
import { DRAINAGE_AUTO_RIBBON_ACTIONS } from './bridge/drainage-auto-command-keys';

export type UseRibbonDrainageAutoBridgeProps = RibbonMepAutoBridgeProps;
export type RibbonDrainageAutoBridge = RibbonMepAutoBridge;

export const useRibbonDrainageAutoBridge = createRibbonMepAutoBridge({
  actions: DRAINAGE_AUTO_RIBBON_ACTIONS,
  store: drainageProposalStore,
  // designDrainage takes sceneUnits as its 3rd arg (gravity slope rise needs mm).
  design: (model, entities, sceneUnits) => designDrainage(model, entities, sceneUnits),
  buildCommit: buildDrainageCommit,
  resolveNetworkName: (t, _network, i) =>
    t('ribbon.commands.drainage.networkName', { n: i + 1 }),
  commandLabel: 'Generate drainage',
  emitEmpty: (hasWarnings) =>
    EventBus.emit('bim:drainage-empty', { reason: hasWarnings ? 'no-collector' : 'no-fixtures' }),
  emitGenerated: (networkCount, warningCount) =>
    EventBus.emit('bim:drainage-generated', { networkCount, warningCount }),
  emitCommitted: (networkCount, segmentCount) =>
    EventBus.emit('bim:drainage-committed', { networkCount, segmentCount }),
});
