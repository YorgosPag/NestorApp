/**
 * ADR-430 Slice 2 — electrical commit builder (pure).
 *
 * Verifies the proposal → circuit `MepSystem` translation: one geometry-less circuit per
 * proposed circuit, classification/source/members preserved, nominal voltage + single pole +
 * the classification colour stamped, and a fresh enterprise id minted.
 */

import { buildElectricalCommit } from '../commit/build-electrical-commit';
import {
  ELECTRICAL_CLASSIFICATION_COLOR,
  type ElectricalNetworkProposal,
  type ProposedCircuit,
} from '../electrical-design-types';
import { isElectricalSystemParams } from '../../../../bim/types/mep-system-types';

function circuit(over: Partial<ProposedCircuit>): ProposedCircuit {
  return {
    service: 'lighting',
    classification: 'lighting',
    sourceEntityId: 'panel-1',
    sourceConnectorId: 'c1',
    members: [{ entityId: 'lf1', connectorId: 'c1' }],
    memberCount: 1,
    connectedLoadVa: 100,
    breakerAmp: 10,
    conductorMm2: 1.5,
    phase: 'L1',
    voltageDropPercent: 0.5,
    voltageDropExceeded: false,
    ...over,
  };
}

function proposal(circuits: ProposedCircuit[]): ElectricalNetworkProposal {
  return { circuits, warnings: [], storeyId: 'floor-1', skippedAlreadyCircuited: 0 };
}

describe('buildElectricalCommit', () => {
  it('builds one MepSystem per circuit, preserving classification/source/members', () => {
    const plan = buildElectricalCommit(
      proposal([
        circuit({}),
        circuit({ service: 'power', classification: 'power', phase: 'L2', members: [{ entityId: 'sk1', connectorId: 'c1' }] }),
      ]),
      (c, i) => `${c.service}-${i}`,
    );
    expect(plan.systemEntities).toHaveLength(2);
    const [lighting, power] = plan.systemEntities;
    expect(isElectricalSystemParams(lighting.params)).toBe(true);
    if (isElectricalSystemParams(lighting.params)) {
      expect(lighting.params.systemClassification).toBe('lighting');
      expect(lighting.params.sourceEntityId).toBe('panel-1');
      expect(lighting.params.members).toEqual([{ entityId: 'lf1', connectorId: 'c1' }]);
      expect(lighting.params.ratedVoltage).toBe(230);
      expect(lighting.params.poles).toBe(1);
      expect(lighting.params.color).toBe(ELECTRICAL_CLASSIFICATION_COLOR.lighting);
    }
    if (isElectricalSystemParams(power.params)) {
      expect(power.params.systemClassification).toBe('power');
      expect(power.params.color).toBe(ELECTRICAL_CLASSIFICATION_COLOR.power);
    }
  });

  it('mints a unique enterprise id per circuit and applies the resolved name', () => {
    const plan = buildElectricalCommit(
      proposal([circuit({}), circuit({ phase: 'L2' })]),
      (c) => `Circuit ${c.phase}`,
    );
    const ids = plan.systemEntities.map((e) => e.id);
    expect(new Set(ids).size).toBe(2);
    expect(ids.every((id) => id.startsWith('mepsys_'))).toBe(true);
    expect(plan.systemEntities[0].params.name).toBe('Circuit L1');
    expect(plan.systemEntities[1].params.name).toBe('Circuit L2');
  });

  it('produces no systems for an empty proposal', () => {
    expect(buildElectricalCommit(proposal([]), () => 'x').systemEntities).toHaveLength(0);
  });
});
