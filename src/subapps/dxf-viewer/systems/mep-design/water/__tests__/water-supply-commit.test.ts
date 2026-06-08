/**
 * ADR-426 Slice 2 — water-supply commit builder + proposal store tests.
 *
 * `buildWaterSupplyCommit` is the pure translation from a reviewed
 * `WaterNetworkProposal` to the entities the accept transaction creates. These
 * tests pin: segment count, one MepSystem per network, correct classification +
 * source, and that members = every segment's two endpoints PLUS the served
 * fixture connectors.
 */

import { buildWaterSupplyCommit } from '../commit/build-water-supply-commit';
import { waterProposalStore } from '../water-proposal-store';
import type {
  ProposedNetwork,
  ProposedSegment,
  WaterNetworkProposal,
} from '../water-design-types';

function seg(
  startX: number,
  diameterMm: number,
  role: 'trunk' | 'branch',
): ProposedSegment {
  return {
    start: { x: startX, y: 0 },
    end: { x: startX + 1000, y: 0 },
    service: 'cold',
    classification: 'domestic-cold-water',
    diameterMm,
    cumulativeLU: role === 'trunk' ? 6 : 1,
    role,
  };
}

function coldNetwork(): ProposedNetwork {
  return {
    service: 'cold',
    classification: 'domestic-cold-water',
    sourceEntityId: 'manifold-1',
    sourceConnectorId: 'mani-out',
    sourcePoint: { x: 0, y: 0 },
    sourceElevationMm: 400,
    segments: [seg(0, 22, 'trunk'), seg(1000, 15, 'branch')],
    servedTerminalIds: ['wb-1'],
    servedConnectors: [{ entityId: 'wb-1', connectorId: 'san-cold' }],
    totalLU: 6,
  };
}

function proposalOf(...networks: ProposedNetwork[]): WaterNetworkProposal {
  return { networks, warnings: [], storeyId: 'level-1' };
}

describe('buildWaterSupplyCommit', () => {
  const name = (n: ProposedNetwork, i: number) => `${n.service} ${i + 1}`;

  it('emits one real segment per proposed segment', () => {
    const plan = buildWaterSupplyCommit(proposalOf(coldNetwork()), 'lyr_1', 'mm', name);
    expect(plan.segmentEntities).toHaveLength(2);
    expect(plan.skippedSegments).toBe(0);
    expect(plan.segmentEntities.every((e) => e.params.domain === 'pipe')).toBe(true);
  });

  it('creates one MepSystem per network with the right classification + source', () => {
    const plan = buildWaterSupplyCommit(proposalOf(coldNetwork()), 'lyr_1', 'mm', name);
    expect(plan.systemEntities).toHaveLength(1);
    const sys = plan.systemEntities[0]!;
    expect(sys.params.systemClassification).toBe('domestic-cold-water');
    expect(sys.params.sourceEntityId).toBe('manifold-1');
    expect(sys.params.sourceConnectorId).toBe('mani-out');
  });

  it('members = 2 endpoints per segment + every served fixture connector', () => {
    const plan = buildWaterSupplyCommit(proposalOf(coldNetwork()), 'lyr_1', 'mm', name);
    const sys = plan.systemEntities[0]!;
    // 2 segments × 2 endpoints + 1 served connector = 5
    expect(sys.params.members).toHaveLength(5);
    expect(sys.params.members).toContainEqual({ entityId: 'wb-1', connectorId: 'san-cold' });
    // each emitted segment contributes its own id twice (start + end)
    for (const e of plan.segmentEntities) {
      const forSeg = sys.params.members.filter((m) => m.entityId === e.id);
      expect(forSeg).toHaveLength(2);
    }
  });

  it('builds every segment flat at the source outlet elevation (Revit "Connect To")', () => {
    // coldNetwork sources at 400 mm → no segment may sit at the ceiling default.
    const plan = buildWaterSupplyCommit(proposalOf(coldNetwork()), 'lyr_1', 'mm', name);
    expect(plan.segmentEntities).toHaveLength(2);
    for (const e of plan.segmentEntities) {
      expect(e.params.centerlineElevationMm).toBe(400);
      expect(e.params.startPoint.z).toBe(400);
      expect(e.params.endPoint.z).toBe(400);
    }
  });

  it('handles both cold + hot networks (two systems)', () => {
    const hot: ProposedNetwork = {
      ...coldNetwork(),
      service: 'hot',
      classification: 'domestic-hot-water',
      sourceEntityId: 'boiler-1',
      segments: [seg(0, 18, 'trunk')],
      servedConnectors: [{ entityId: 'wb-1', connectorId: 'san-hot' }],
    };
    const plan = buildWaterSupplyCommit(proposalOf(coldNetwork(), hot), 'lyr_1', 'mm', name);
    expect(plan.systemEntities).toHaveLength(2);
    expect(plan.segmentEntities).toHaveLength(3);
    expect(plan.systemEntities.map((s) => s.params.systemClassification).sort()).toEqual([
      'domestic-cold-water',
      'domestic-hot-water',
    ]);
  });

  it('an empty proposal yields no entities', () => {
    const plan = buildWaterSupplyCommit(proposalOf(), 'lyr_1', 'mm', name);
    expect(plan.segmentEntities).toHaveLength(0);
    expect(plan.systemEntities).toHaveLength(0);
  });
});

describe('waterProposalStore', () => {
  afterEach(() => waterProposalStore.reset());

  it('set then get returns the review; reset clears it', () => {
    expect(waterProposalStore.get()).toBeNull();
    const review = { proposal: proposalOf(coldNetwork()), sceneUnits: 'mm' as const };
    waterProposalStore.set(review);
    expect(waterProposalStore.get()).toBe(review);
    waterProposalStore.reset();
    expect(waterProposalStore.get()).toBeNull();
  });
});
