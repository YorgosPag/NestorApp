'use client';

/**
 * ADR-430 Slice 2 — Bridge between the «Αυτόματος Ηλεκτρολογικός» ribbon actions and the
 * electrical-strong auto-design engine (Slice 1) + the proposal/commit layer.
 *
 * The Generate → review → accept flow lives in `createElectricalAutoBridge` (shared with the
 * weak-current bridge); this file is the strong-current configuration: `designElectricalStrong`,
 * circuit naming «Φωτισμός L1» / «Ρευματοδότες L2» and its EventBus feedback
 * (→ `useDxfViewerNotifications`). NO segments — the wiring is derived at render.
 *
 * @see ../../../systems/mep-design/electrical/design-electrical-strong.ts (engine)
 * @see ../../../systems/mep-design/electrical/commit/build-electrical-commit.ts (commit builder)
 * @see ./bridge/create-electrical-auto-bridge.ts (the shared flow)
 * @see docs/centralized-systems/reference/adrs/ADR-430-electrical-strong-auto-design.md
 */

import { EventBus } from '../../../systems/events/EventBus';
import { designElectricalStrong } from '../../../systems/mep-design/electrical';
import type { ProposedCircuit } from '../../../systems/mep-design/electrical';
import { buildElectricalCommit } from '../../../systems/mep-design/electrical/commit/build-electrical-commit';
import { ELECTRICAL_AUTO_RIBBON_ACTIONS } from './bridge/electrical-auto-command-keys';
import {
  createElectricalAutoBridge,
  type ElectricalAutoBridge,
  type ElectricalAutoBridgeProps,
} from './bridge/create-electrical-auto-bridge';

export type UseRibbonElectricalAutoBridgeProps = ElectricalAutoBridgeProps;
export type RibbonElectricalAutoBridge = ElectricalAutoBridge;

export const useRibbonElectricalAutoBridge = createElectricalAutoBridge({
  origin: 'strong',
  actions: ELECTRICAL_AUTO_RIBBON_ACTIONS,
  commandLabel: 'Generate electrical circuits',
  design: designElectricalStrong,
  countOf: (proposal) => proposal.circuits.length,
  buildSystems: (proposal, t) => {
    const resolveCircuitName = (circuit: ProposedCircuit): string => {
      const base =
        circuit.service === 'lighting'
          ? t('ribbon.commands.electrical.lightingName')
          : t('ribbon.commands.electrical.powerName');
      return `${base} ${circuit.phase}`;
    };
    return buildElectricalCommit(proposal, resolveCircuitName).systemEntities;
  },
  emitEmpty: (proposal) =>
    EventBus.emit('bim:electrical-empty', {
      reason: proposal.warnings.some((w) => w.includes('panel')) ? 'no-source' : 'no-terminals',
    }),
  emitGenerated: (proposal) =>
    EventBus.emit('bim:electrical-generated', {
      circuitCount: proposal.circuits.length,
      skipped: proposal.skippedAlreadyCircuited,
      warningCount: proposal.warnings.length,
    }),
  emitCommitted: (circuitCount) => EventBus.emit('bim:electrical-committed', { circuitCount }),
});
