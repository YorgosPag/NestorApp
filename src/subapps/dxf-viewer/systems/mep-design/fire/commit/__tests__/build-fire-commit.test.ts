/**
 * ADR-433 Slice 2 — fire-protection commit builder + proposal store tests.
 *
 * `buildFireCommit` is the pure translation from a reviewed `FireNetworkProposal` to the
 * entities the accept transaction creates. These tests pin: segment count (round **pipe**
 * domain), that each pipe CARRIES its `fire-sprinkler` classification (pipe-only field,
 * unlike the HVAC duct), one `pipe-network` MepSystem per network with the right
 * classification + riser source, and that members = every segment's two endpoints PLUS the
 * served sprinkler-head connectors.
 */

import { buildFireCommit } from '../build-fire-commit';
import { fireProposalStore } from '../../fire-proposal-store';
import type {
  ProposedNetwork,
  ProposedSegment,
  FireNetworkProposal,
} from '../../fire-design-types';

function seg(
  startX: number,
  diameterMm: number,
  role: 'trunk' | 'branch',
): ProposedSegment {
  return {
    start: { x: startX, y: 0 },
    end: { x: startX + 1000, y: 0 },
    service: 'sprinkler',
    classification: 'fire-sprinkler',
    diameterMm,
    cumulativeFlowLpm: role === 'trunk' ? 160 : 80,
    role,
  };
}

function sprinklerNetwork(): ProposedNetwork {
  return {
    service: 'sprinkler',
    classification: 'fire-sprinkler',
    sourceEntityId: 'riser-1',
    sourceConnectorId: 'fire-riser-supply',
    sourcePoint: { x: 0, y: 0 },
    sourceElevationMm: 2800,
    segments: [seg(0, 50, 'trunk'), seg(1000, 25, 'branch')],
    servedTerminalIds: ['sk-1'],
    servedConnectors: [{ entityId: 'sk-1', connectorId: 'spk-supply' }],
    totalFlowLpm: 160,
  };
}

function proposalOf(...networks: ProposedNetwork[]): FireNetworkProposal {
  return { networks, warnings: [], storeyId: 'level-1' };
}

describe('buildFireCommit', () => {
  const name = (n: ProposedNetwork, i: number) => `${n.service} ${i + 1}`;

  it('emits one real round-pipe segment per proposed segment', () => {
    const plan = buildFireCommit(proposalOf(sprinklerNetwork()), 'lyr_1', 'mm', name);
    expect(plan.segmentEntities).toHaveLength(2);
    expect(plan.skippedSegments).toBe(0);
    expect(plan.segmentEntities.every((e) => e.params.domain === 'pipe')).toBe(true);
  });

  it('every pipe CARRIES its fire-sprinkler classification (pipe-only field)', () => {
    const plan = buildFireCommit(proposalOf(sprinklerNetwork()), 'lyr_1', 'mm', name);
    for (const e of plan.segmentEntities) {
      expect(e.params.classification).toBe('fire-sprinkler');
    }
  });

  it('creates one pipe-network MepSystem with the right classification + riser source', () => {
    const plan = buildFireCommit(proposalOf(sprinklerNetwork()), 'lyr_1', 'mm', name);
    expect(plan.systemEntities).toHaveLength(1);
    const sys = plan.systemEntities[0]!;
    expect(sys.params.systemType).toBe('pipe-network');
    expect(sys.params.systemClassification).toBe('fire-sprinkler');
    expect(sys.params.sourceEntityId).toBe('riser-1');
    expect(sys.params.sourceConnectorId).toBe('fire-riser-supply');
  });

  it('members = 2 endpoints per segment + every served head connector', () => {
    const plan = buildFireCommit(proposalOf(sprinklerNetwork()), 'lyr_1', 'mm', name);
    const sys = plan.systemEntities[0]!;
    // 2 segments × 2 endpoints + 1 served connector = 5
    expect(sys.params.members).toHaveLength(5);
    expect(sys.params.members).toContainEqual({ entityId: 'sk-1', connectorId: 'spk-supply' });
    for (const e of plan.segmentEntities) {
      const forSeg = sys.params.members.filter((m) => m.entityId === e.id);
      expect(forSeg).toHaveLength(2);
    }
  });

  it('builds every pipe flat at the riser outlet elevation (Revit "Connect To")', () => {
    const plan = buildFireCommit(proposalOf(sprinklerNetwork()), 'lyr_1', 'mm', name);
    expect(plan.segmentEntities).toHaveLength(2);
    for (const e of plan.segmentEntities) {
      expect(e.params.centerlineElevationMm).toBe(2800);
      expect(e.params.startPoint.z).toBe(2800);
      expect(e.params.endPoint.z).toBe(2800);
    }
  });

  it('an empty proposal yields no entities', () => {
    const plan = buildFireCommit(proposalOf(), 'lyr_1', 'mm', name);
    expect(plan.segmentEntities).toHaveLength(0);
    expect(plan.systemEntities).toHaveLength(0);
  });
});

describe('fireProposalStore', () => {
  afterEach(() => fireProposalStore.reset());

  it('set then get returns the review; reset clears it', () => {
    expect(fireProposalStore.get()).toBeNull();
    const review = { proposal: proposalOf(sprinklerNetwork()), sceneUnits: 'mm' as const };
    fireProposalStore.set(review);
    expect(fireProposalStore.get()).toBe(review);
    fireProposalStore.reset();
    expect(fireProposalStore.get()).toBeNull();
  });
});
