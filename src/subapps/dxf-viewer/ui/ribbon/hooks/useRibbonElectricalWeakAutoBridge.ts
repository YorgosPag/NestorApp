'use client';

/**
 * ADR-431 Slice 2 — Bridge between the «Αυτόματα Ασθενή» ribbon actions and the
 * electrical-WEAK auto-design engine (Slice 1) + the SHARED proposal/commit layer.
 *
 * The sibling of `useRibbonElectricalAutoBridge` (ADR-430): the Generate → review → accept flow
 * lives in `createElectricalAutoBridge`; this file is the weak-current configuration:
 * `designElectricalWeak` (skipping already-channelled outlets), channel naming «Δεδομένα 1» /
 * «Έλεγχος 2» and its EventBus feedback. Same proposal store as the strong bridge (one
 * auto-design review at a time), each acting only on its own `origin`.
 *
 * @see ./useRibbonElectricalAutoBridge.ts (the strong counterpart)
 * @see ../../../systems/mep-design/electrical/design-electrical-weak.ts (engine)
 */

import { EventBus } from '../../../systems/events/EventBus';
import { designElectricalWeak } from '../../../systems/mep-design/electrical';
import type { ProposedWeakChannel } from '../../../systems/mep-design/electrical';
import { buildWeakCommit } from '../../../systems/mep-design/electrical/commit/build-electrical-weak-commit';
import { ELECTRICAL_WEAK_AUTO_RIBBON_ACTIONS } from './bridge/electrical-weak-auto-command-keys';
import {
  createElectricalAutoBridge,
  type ElectricalAutoBridge,
  type ElectricalAutoBridgeProps,
} from './bridge/create-electrical-auto-bridge';

export type UseRibbonElectricalWeakAutoBridgeProps = ElectricalAutoBridgeProps;
export type RibbonElectricalWeakAutoBridge = ElectricalAutoBridge;

export const useRibbonElectricalWeakAutoBridge = createElectricalAutoBridge({
  origin: 'weak',
  actions: ELECTRICAL_WEAK_AUTO_RIBBON_ACTIONS,
  commandLabel: 'Generate structured-cabling channels',
  design: designElectricalWeak,
  countOf: (proposal) => proposal.channels.length,
  buildSystems: (proposal, t) => {
    const resolveChannelName = (channel: ProposedWeakChannel, index: number): string => {
      const base =
        channel.service === 'data'
          ? t('ribbon.commands.electricalWeak.dataName')
          : t('ribbon.commands.electricalWeak.controlsName');
      return `${base} ${index + 1}`;
    };
    return buildWeakCommit(proposal, resolveChannelName).systemEntities;
  },
  emitEmpty: (proposal) =>
    EventBus.emit('bim:electrical-weak-empty', {
      reason: proposal.warnings.some((w) => w.includes('comms-rack')) ? 'no-source' : 'no-terminals',
    }),
  emitGenerated: (proposal) =>
    EventBus.emit('bim:electrical-weak-generated', {
      channelCount: proposal.channels.length,
      skipped: proposal.skippedAlreadyCircuited,
      warningCount: proposal.warnings.length,
    }),
  emitCommitted: (channelCount) => EventBus.emit('bim:electrical-weak-committed', { channelCount }),
});
