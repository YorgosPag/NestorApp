/**
 * ADR-428 Slice 2 — heating commit builder + proposal store tests.
 *
 * `buildHeatingCommit` is the pure translation from a reviewed
 * `HeatingNetworkProposal` to the entities the accept transaction creates. These
 * tests pin: segment count, one MepSystem per network, correct classification +
 * source, that members = every segment's two endpoints PLUS the served terminal
 * connectors, and that the whole closed loop is built FLAT at the boiler elevation
 * (no slope — pressurised, unlike drainage).
 */

import { buildHeatingCommit } from '../commit/build-heating-commit';
import { heatingProposalStore } from '../heating-proposal-store';
import type {
  ProposedHeatingNetwork,
  ProposedHeatingSegment,
  HeatingNetworkProposal,
  HeatingNetworkRole,
} from '../heating-design-types';

function seg(
  startX: number,
  diameterMm: number,
  role: 'trunk' | 'branch',
  networkRole: HeatingNetworkRole,
): ProposedHeatingSegment {
  return {
    start: { x: startX, y: 0 },
    end: { x: startX + 1000, y: 0 },
    networkRole,
    classification: networkRole === 'supply' ? 'hydronic-supply' : 'hydronic-return',
    diameterMm,
    cumulativeFlowLps: role === 'trunk' ? 0.12 : 0.02,
    role,
  };
}

function supplyNetwork(): ProposedHeatingNetwork {
  return {
    role: 'supply',
    classification: 'hydronic-supply',
    sourceEntityId: 'boiler-1',
    sourceConnectorId: 'boiler-supply',
    sourcePoint: { x: 0, y: 0 },
    sourceElevationMm: 400,
    segments: [seg(0, 22, 'trunk', 'supply'), seg(1000, 15, 'branch', 'supply')],
    servedTerminalIds: ['rad-1'],
    servedConnectors: [{ entityId: 'rad-1', connectorId: 'rad-supply' }],
    totalFlowLps: 0.12,
  };
}

function returnNetwork(): ProposedHeatingNetwork {
  return {
    ...supplyNetwork(),
    role: 'return',
    classification: 'hydronic-return',
    sourceConnectorId: 'boiler-return',
    segments: [seg(0, 22, 'trunk', 'return')],
    servedConnectors: [{ entityId: 'rad-1', connectorId: 'rad-return' }],
  };
}

function proposalOf(...networks: ProposedHeatingNetwork[]): HeatingNetworkProposal {
  return { networks, warnings: [], storeyId: 'level-1' };
}

describe('buildHeatingCommit', () => {
  const name = (n: ProposedHeatingNetwork, i: number) => `${n.role} ${i + 1}`;

  it('emits one real segment per proposed segment', () => {
    const plan = buildHeatingCommit(proposalOf(supplyNetwork()), 'lyr_1', 'mm', name);
    expect(plan.segmentEntities).toHaveLength(2);
    expect(plan.skippedSegments).toBe(0);
    expect(plan.segmentEntities.every((e) => e.params.domain === 'pipe')).toBe(true);
  });

  it('creates one MepSystem per network with the right classification + source', () => {
    const plan = buildHeatingCommit(proposalOf(supplyNetwork()), 'lyr_1', 'mm', name);
    expect(plan.systemEntities).toHaveLength(1);
    const sys = plan.systemEntities[0]!;
    expect(sys.params.systemClassification).toBe('hydronic-supply');
    expect(sys.params.sourceEntityId).toBe('boiler-1');
    expect(sys.params.sourceConnectorId).toBe('boiler-supply');
  });

  it('members = 2 endpoints per segment + every served terminal connector', () => {
    const plan = buildHeatingCommit(proposalOf(supplyNetwork()), 'lyr_1', 'mm', name);
    const sys = plan.systemEntities[0]!;
    // 2 segments × 2 endpoints + 1 served connector = 5
    expect(sys.params.members).toHaveLength(5);
    expect(sys.params.members).toContainEqual({ entityId: 'rad-1', connectorId: 'rad-supply' });
    for (const e of plan.segmentEntities) {
      const forSeg = sys.params.members.filter((m) => m.entityId === e.id);
      expect(forSeg).toHaveLength(2);
    }
  });

  it('builds every segment flat at the boiler endpoint elevation, no slope', () => {
    // supplyNetwork sources at 400 mm → both endpoints sit there, identical z (no fall).
    const plan = buildHeatingCommit(proposalOf(supplyNetwork()), 'lyr_1', 'mm', name);
    expect(plan.segmentEntities).toHaveLength(2);
    for (const e of plan.segmentEntities) {
      expect(e.params.centerlineElevationMm).toBe(400);
      expect(e.params.startPoint.z).toBe(400);
      expect(e.params.endPoint.z).toBe(400);
    }
  });

  it('handles both supply + return networks (two systems)', () => {
    const plan = buildHeatingCommit(proposalOf(supplyNetwork(), returnNetwork()), 'lyr_1', 'mm', name);
    expect(plan.systemEntities).toHaveLength(2);
    expect(plan.segmentEntities).toHaveLength(3);
    expect(plan.systemEntities.map((s) => s.params.systemClassification).sort()).toEqual([
      'hydronic-return',
      'hydronic-supply',
    ]);
  });

  it('an empty proposal yields no entities', () => {
    const plan = buildHeatingCommit(proposalOf(), 'lyr_1', 'mm', name);
    expect(plan.segmentEntities).toHaveLength(0);
    expect(plan.systemEntities).toHaveLength(0);
  });
});

describe('heatingProposalStore', () => {
  afterEach(() => heatingProposalStore.reset());

  it('set then get returns the review; reset clears it', () => {
    expect(heatingProposalStore.get()).toBeNull();
    const review = { proposal: proposalOf(supplyNetwork()), sceneUnits: 'mm' as const };
    heatingProposalStore.set(review);
    expect(heatingProposalStore.get()).toBe(review);
    heatingProposalStore.reset();
    expect(heatingProposalStore.get()).toBeNull();
  });
});
