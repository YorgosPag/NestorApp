/**
 * ADR-427 Slice 2 — drainage commit builder + proposal store tests.
 *
 * `buildDrainageCommit` is the pure translation from a reviewed
 * `DrainageNetworkProposal` to the entities the accept transaction creates. These
 * tests pin: segment count, one MepSystem per network rooted at the collector
 * (φρεάτιο) outlet, the `sanitary-drainage` classification, that members = every
 * segment's two endpoints PLUS the served fixture drain connectors, and — the
 * gravity-specific part — that each committed run keeps the proposal's DESCENDING
 * per-endpoint elevations and its `slopePercent` instance param.
 */

import { buildDrainageCommit } from '../commit/build-drainage-commit';
import { drainageProposalStore } from '../drainage-proposal-store';
import type {
  ProposedDrainageNetwork,
  ProposedDrainageSegment,
  DrainageNetworkProposal,
} from '../drainage-design-types';

function seg(
  startX: number,
  diameterMm: number,
  role: 'trunk' | 'branch',
  startElevationMm: number,
  endElevationMm: number,
): ProposedDrainageSegment {
  return {
    start: { x: startX, y: 0 },
    end: { x: startX + 1000, y: 0 },
    classification: 'sanitary-drainage',
    diameterMm,
    cumulativeDU: role === 'trunk' ? 8 : 2,
    role,
    slopePercent: 2,
    startElevationMm,
    endElevationMm,
  };
}

function network(): ProposedDrainageNetwork {
  return {
    classification: 'sanitary-drainage',
    outfallEntityId: 'collector-1',
    outfallConnectorId: 'col-in',
    outfallPoint: { x: 0, y: 0 },
    outfallInvertElevationMm: 100,
    // `start` lower (toward the φρεάτιο), `end` higher — flow descends end→start.
    segments: [seg(0, 110, 'trunk', 100, 120), seg(1000, 100, 'branch', 120, 140)],
    servedTerminalIds: ['wc-1'],
    servedConnectors: [{ entityId: 'wc-1', connectorId: 'san-drain' }],
    totalDU: 8,
  };
}

function proposalOf(...networks: ProposedDrainageNetwork[]): DrainageNetworkProposal {
  return { networks, warnings: [], storeyId: 'level-1' };
}

describe('buildDrainageCommit', () => {
  const name = (_n: ProposedDrainageNetwork, i: number) => `Αποχέτευση ${i + 1}`;

  it('emits one real pipe segment per proposed segment', () => {
    const plan = buildDrainageCommit(proposalOf(network()), 'lyr_1', 'mm', name);
    expect(plan.segmentEntities).toHaveLength(2);
    expect(plan.skippedSegments).toBe(0);
    expect(plan.segmentEntities.every((e) => e.params.domain === 'pipe')).toBe(true);
  });

  it('creates one MepSystem rooted at the collector outlet with drainage classification', () => {
    const plan = buildDrainageCommit(proposalOf(network()), 'lyr_1', 'mm', name);
    expect(plan.systemEntities).toHaveLength(1);
    const sys = plan.systemEntities[0]!;
    expect(sys.params.systemClassification).toBe('sanitary-drainage');
    expect(sys.params.sourceEntityId).toBe('collector-1');
    expect(sys.params.sourceConnectorId).toBe('col-in');
  });

  it('members = 2 endpoints per segment + every served fixture drain connector', () => {
    const plan = buildDrainageCommit(proposalOf(network()), 'lyr_1', 'mm', name);
    const sys = plan.systemEntities[0]!;
    // 2 segments × 2 endpoints + 1 served connector = 5
    expect(sys.params.members).toHaveLength(5);
    expect(sys.params.members).toContainEqual({ entityId: 'wc-1', connectorId: 'san-drain' });
    for (const e of plan.segmentEntities) {
      const forSeg = sys.params.members.filter((m) => m.entityId === e.id);
      expect(forSeg).toHaveLength(2);
    }
  });

  it('keeps the proposal’s descending per-endpoint elevations + slope on each run', () => {
    const plan = buildDrainageCommit(proposalOf(network()), 'lyr_1', 'mm', name);
    expect(plan.segmentEntities).toHaveLength(2);
    for (const e of plan.segmentEntities) {
      // distinct snapped z ⇒ "real connected run": the network geometry wins (no re-projection).
      expect(e.params.startPoint.z!).toBeLessThan(e.params.endPoint.z!);
      expect(e.params.slopePercent).toBe(2);
    }
    // First run sits at the collector invert datum (100 → 120).
    const first = plan.segmentEntities[0]!;
    expect(first.params.startPoint.z!).toBe(100);
    expect(first.params.endPoint.z!).toBe(120);
  });

  it('skips an invalid (zero-length) run without aborting the network', () => {
    const bad = network();
    const degenerate: ProposedDrainageSegment = {
      ...bad.segments[0]!,
      end: { x: 0, y: 0 }, // start === end ⇒ invalid geometry
    };
    const plan = buildDrainageCommit(
      proposalOf({ ...bad, segments: [degenerate, bad.segments[1]!] }),
      'lyr_1',
      'mm',
      name,
    );
    expect(plan.skippedSegments).toBe(1);
    expect(plan.segmentEntities).toHaveLength(1);
    expect(plan.systemEntities).toHaveLength(1);
  });

  it('an empty proposal yields no entities', () => {
    const plan = buildDrainageCommit(proposalOf(), 'lyr_1', 'mm', name);
    expect(plan.segmentEntities).toHaveLength(0);
    expect(plan.systemEntities).toHaveLength(0);
  });
});

describe('drainageProposalStore', () => {
  afterEach(() => drainageProposalStore.reset());

  it('set then get returns the review; reset clears it', () => {
    expect(drainageProposalStore.get()).toBeNull();
    const review = { proposal: proposalOf(network()), sceneUnits: 'mm' as const };
    drainageProposalStore.set(review);
    expect(drainageProposalStore.get()).toBe(review);
    drainageProposalStore.reset();
    expect(drainageProposalStore.get()).toBeNull();
  });
});
