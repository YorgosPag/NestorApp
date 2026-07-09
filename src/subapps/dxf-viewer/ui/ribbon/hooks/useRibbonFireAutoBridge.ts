'use client';

/**
 * ADR-433 Slice 2 — «Αυτόματη Πυρόσβεση» (fire-protection / sprinkler) ribbon bridge.
 *
 * Thin binding over `createRibbonMepAutoBridge` (ADR-609): the fire discipline config —
 * `designFire` engine + `buildFireCommit` builder + the `bim:fire-*` feedback triple.
 * Same public API (`useRibbonFireAutoBridge(props) → { onAction }`).
 *
 * @see ./create-ribbon-mep-auto-bridge.ts — the parametric single source
 * @see ../../../systems/mep-design/fire/design-fire.ts (engine)
 * @see ../../../systems/mep-design/fire/commit/build-fire-commit.ts (commit builder)
 * @see docs/centralized-systems/reference/adrs/ADR-433-fire-protection-auto-design.md
 */

import {
  createRibbonMepAutoBridge,
  type RibbonMepAutoBridgeProps,
  type RibbonMepAutoBridge,
} from './create-ribbon-mep-auto-bridge';
import { EventBus } from '../../../systems/events/EventBus';
import { designFire } from '../../../systems/mep-design/fire';
import { fireProposalStore } from '../../../systems/mep-design/fire/fire-proposal-store';
import { buildFireCommit } from '../../../systems/mep-design/fire/commit/build-fire-commit';
import { FIRE_AUTO_RIBBON_ACTIONS } from './bridge/fire-auto-command-keys';

export type UseRibbonFireAutoBridgeProps = RibbonMepAutoBridgeProps;
export type RibbonFireAutoBridge = RibbonMepAutoBridge;

export const useRibbonFireAutoBridge = createRibbonMepAutoBridge({
  actions: FIRE_AUTO_RIBBON_ACTIONS,
  store: fireProposalStore,
  design: (model, entities) => designFire(model, entities),
  buildCommit: buildFireCommit,
  resolveNetworkName: (t, network, i) =>
    t('ribbon.commands.fire.networkName', {
      service: t(`ribbon.commands.fire.service.${network.service}`),
      n: i + 1,
    }),
  commandLabel: 'Generate fire protection',
  emitEmpty: (hasWarnings) =>
    EventBus.emit('bim:fire-empty', { reason: hasWarnings ? 'no-source' : 'no-terminals' }),
  emitGenerated: (networkCount, warningCount) =>
    EventBus.emit('bim:fire-generated', { networkCount, warningCount }),
  emitCommitted: (networkCount, segmentCount) =>
    EventBus.emit('bim:fire-committed', { networkCount, segmentCount }),
});
