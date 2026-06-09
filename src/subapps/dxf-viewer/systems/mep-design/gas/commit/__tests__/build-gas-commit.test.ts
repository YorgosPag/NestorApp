/**
 * ADR-434 Slice 2 — Gas commit builder + proposal store tests.
 *
 * `buildGasCommit` is the pure translation from a reviewed `GasNetworkProposal` to the
 * entities the accept transaction creates. These tests pin: segment count (round **fuel**
 * domain), one `fuel-network` MepSystem per network with the right fuel-gas classification +
 * meter source, and that members = every segment's two endpoints PLUS the served appliance
 * connectors. A fuel segment must carry NO classification (the System owns it).
 */

import { buildGasCommit } from '../build-gas-commit';
import { gasProposalStore } from '../../gas-proposal-store';
import { isFuelSystemParams } from '../../../../../bim/types/mep-system-types';
import type {
  ProposedFuelNetwork,
  ProposedFuelSegment,
  GasNetworkProposal,
} from '../../gas-design-types';

function seg(
  startX: number,
  diameterMm: number,
  role: 'trunk' | 'branch',
): ProposedFuelSegment {
  return {
    start: { x: startX, y: 0 },
    end: { x: startX + 1000, y: 0 },
    service: 'gas',
    classification: 'fuel-gas',
    diameterMm,
    cumulativeFlowCmh: role === 'trunk' ? 3.6 : 1.1,
    role,
  };
}

function gasNetwork(): ProposedFuelNetwork {
  return {
    service: 'gas',
    classification: 'fuel-gas',
    sourceEntityId: 'meter-1',
    sourceConnectorId: 'gas-meter-out',
    sourcePoint: { x: 0, y: 0 },
    sourceElevationMm: 1400,
    segments: [seg(0, 25, 'trunk'), seg(1000, 15, 'branch')],
    servedTerminalIds: ['cooker-1'],
    servedConnectors: [{ entityId: 'cooker-1', connectorId: 'gas-cooker-supply' }],
    totalFlowCmh: 3.6,
  };
}

function proposalOf(...networks: ProposedFuelNetwork[]): GasNetworkProposal {
  return { networks, warnings: [], storeyId: 'level-1' };
}

describe('buildGasCommit', () => {
  const name = (n: ProposedFuelNetwork, i: number) => `${n.service} ${i + 1}`;

  it('emits one real round-fuel segment per proposed segment', () => {
    const plan = buildGasCommit(proposalOf(gasNetwork()), 'lyr_1', 'mm', name);
    expect(plan.segmentEntities).toHaveLength(2);
    expect(plan.skippedSegments).toBe(0);
    expect(plan.segmentEntities.every((e) => e.params.domain === 'fuel')).toBe(true);
    expect(plan.segmentEntities.every((e) => e.params.sectionKind === 'round')).toBe(true);
  });

  it('a fuel segment carries no classification (the System owns it)', () => {
    const plan = buildGasCommit(proposalOf(gasNetwork()), 'lyr_1', 'mm', name);
    for (const e of plan.segmentEntities) {
      expect('classification' in e.params).toBe(false);
    }
  });

  it('creates one fuel-network MepSystem with the right classification + meter source', () => {
    const plan = buildGasCommit(proposalOf(gasNetwork()), 'lyr_1', 'mm', name);
    expect(plan.systemEntities).toHaveLength(1);
    const sys = plan.systemEntities[0]!;
    expect(isFuelSystemParams(sys.params)).toBe(true);
    expect(sys.params.systemType).toBe('fuel-network');
    expect(sys.params.systemClassification).toBe('fuel-gas');
    expect(sys.params.sourceEntityId).toBe('meter-1');
    expect(sys.params.sourceConnectorId).toBe('gas-meter-out');
  });

  it('seeds the system with the SSoT fuel-gas yellow colour', () => {
    const plan = buildGasCommit(proposalOf(gasNetwork()), 'lyr_1', 'mm', name);
    expect(plan.systemEntities[0]!.params.color).toBe('#eab308');
  });

  it('members = 2 endpoints per segment + every served appliance connector', () => {
    const plan = buildGasCommit(proposalOf(gasNetwork()), 'lyr_1', 'mm', name);
    const sys = plan.systemEntities[0]!;
    // 2 segments × 2 endpoints + 1 served connector = 5
    expect(sys.params.members).toHaveLength(5);
    expect(sys.params.members).toContainEqual({ entityId: 'cooker-1', connectorId: 'gas-cooker-supply' });
    for (const e of plan.segmentEntities) {
      const forSeg = sys.params.members.filter((m) => m.entityId === e.id);
      expect(forSeg).toHaveLength(2);
    }
  });

  it('builds every fuel run flat at the meter outlet elevation (Revit "Connect To")', () => {
    const plan = buildGasCommit(proposalOf(gasNetwork()), 'lyr_1', 'mm', name);
    expect(plan.segmentEntities).toHaveLength(2);
    for (const e of plan.segmentEntities) {
      expect(e.params.centerlineElevationMm).toBe(1400);
      expect(e.params.startPoint.z).toBe(1400);
      expect(e.params.endPoint.z).toBe(1400);
    }
  });

  it('an empty proposal yields no entities', () => {
    const plan = buildGasCommit(proposalOf(), 'lyr_1', 'mm', name);
    expect(plan.segmentEntities).toHaveLength(0);
    expect(plan.systemEntities).toHaveLength(0);
  });
});

describe('gasProposalStore', () => {
  afterEach(() => gasProposalStore.reset());

  it('set then get returns the review; reset clears it', () => {
    expect(gasProposalStore.get()).toBeNull();
    const review = { proposal: proposalOf(gasNetwork()), sceneUnits: 'mm' as const };
    gasProposalStore.set(review);
    expect(gasProposalStore.get()).toBe(review);
    gasProposalStore.reset();
    expect(gasProposalStore.get()).toBeNull();
  });
});
