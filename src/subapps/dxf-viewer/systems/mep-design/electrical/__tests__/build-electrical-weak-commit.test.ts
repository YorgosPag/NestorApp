/**
 * ADR-431 Slice 2 — electrical-weak commit builder (pure).
 *
 * Verifies the proposal → channel `MepSystem` translation: one geometry-less channel per
 * proposed channel, classification/source/members preserved, the classification colour
 * stamped, NO voltage/poles (weak current), and a fresh enterprise id minted.
 */

import { buildWeakCommit } from '../commit/build-electrical-weak-commit';
import { ELECTRICAL_CLASSIFICATION_COLOR } from '../electrical-design-types';
import type { ProposedWeakChannel, WeakNetworkProposal } from '../electrical-weak-design-types';
import { isElectricalSystemParams } from '../../../../bim/types/mep-system-types';

function channel(over: Partial<ProposedWeakChannel>): ProposedWeakChannel {
  return {
    service: 'data',
    classification: 'data',
    sourceEntityId: 'rack-1',
    sourceConnectorId: 'c1',
    members: [{ entityId: 'do1', connectorId: 'c1' }],
    memberCount: 1,
    connectedPorts: 1,
    cableType: 'Cat6',
    channelLengthM: 20,
    channelLengthExceeded: false,
    ...over,
  };
}

function proposal(channels: ProposedWeakChannel[]): WeakNetworkProposal {
  return { channels, warnings: [], storeyId: 'floor-1', skippedAlreadyCircuited: 0 };
}

describe('buildWeakCommit', () => {
  it('builds one MepSystem per channel, preserving classification/source/members, no voltage', () => {
    const plan = buildWeakCommit(
      proposal([
        channel({}),
        channel({ service: 'controls', classification: 'controls', members: [{ entityId: 'ct1', connectorId: 'c1' }] }),
      ]),
      (c, i) => `${c.service}-${i}`,
    );
    expect(plan.systemEntities).toHaveLength(2);
    const [data, controls] = plan.systemEntities;
    expect(isElectricalSystemParams(data.params)).toBe(true);
    if (isElectricalSystemParams(data.params)) {
      expect(data.params.systemClassification).toBe('data');
      expect(data.params.sourceEntityId).toBe('rack-1');
      expect(data.params.members).toEqual([{ entityId: 'do1', connectorId: 'c1' }]);
      expect(data.params.ratedVoltage).toBeUndefined();
      expect(data.params.poles).toBeUndefined();
      expect(data.params.color).toBe(ELECTRICAL_CLASSIFICATION_COLOR.data);
    }
    if (isElectricalSystemParams(controls.params)) {
      expect(controls.params.systemClassification).toBe('controls');
      expect(controls.params.color).toBe(ELECTRICAL_CLASSIFICATION_COLOR.controls);
    }
  });

  it('mints a unique enterprise id per channel and applies the resolved name', () => {
    const plan = buildWeakCommit(proposal([channel({}), channel({})]), (c, i) => `Channel ${i + 1}`);
    const ids = plan.systemEntities.map((e) => e.id);
    expect(new Set(ids).size).toBe(2);
    expect(ids.every((id) => id.startsWith('mepsys_'))).toBe(true);
    expect(plan.systemEntities[0].params.name).toBe('Channel 1');
  });

  it('produces no systems for an empty proposal', () => {
    expect(buildWeakCommit(proposal([]), () => 'x').systemEntities).toHaveLength(0);
  });
});
