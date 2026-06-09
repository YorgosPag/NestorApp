/**
 * ADR-432 Slice 2 — HVAC commit builder + proposal store tests.
 *
 * `buildHvacCommit` is the pure translation from a reviewed `DuctNetworkProposal`
 * to the entities the accept transaction creates. These tests pin: segment count
 * (round **duct** domain), one `duct-network` MepSystem per network with the right
 * supply-air classification + AHU source, and that members = every segment's two
 * endpoints PLUS the served air-terminal connectors. A duct segment must carry NO
 * classification (the System owns it).
 */

import { buildHvacCommit } from '../build-hvac-commit';
import { hvacProposalStore } from '../../hvac-proposal-store';
import { isDuctSystemParams } from '../../../../../bim/types/mep-system-types';
import type {
  ProposedDuctNetwork,
  ProposedDuctSegment,
  DuctNetworkProposal,
} from '../../hvac-design-types';

function seg(
  startX: number,
  diameterMm: number,
  role: 'trunk' | 'branch',
): ProposedDuctSegment {
  return {
    start: { x: startX, y: 0 },
    end: { x: startX + 1000, y: 0 },
    service: 'supply',
    classification: 'supply-air',
    diameterMm,
    cumulativeAirflowCmh: role === 'trunk' ? 450 : 150,
    role,
  };
}

function supplyNetwork(): ProposedDuctNetwork {
  return {
    service: 'supply',
    classification: 'supply-air',
    sourceEntityId: 'ahu-1',
    sourceConnectorId: 'ahu-supply',
    sourcePoint: { x: 0, y: 0 },
    sourceElevationMm: 2800,
    segments: [seg(0, 250, 'trunk'), seg(1000, 125, 'branch')],
    servedTerminalIds: ['at-1'],
    servedConnectors: [{ entityId: 'at-1', connectorId: 'at-supply' }],
    totalAirflowCmh: 450,
  };
}

function proposalOf(...networks: ProposedDuctNetwork[]): DuctNetworkProposal {
  return { networks, warnings: [], storeyId: 'level-1' };
}

describe('buildHvacCommit', () => {
  const name = (n: ProposedDuctNetwork, i: number) => `${n.service} ${i + 1}`;

  it('emits one real round-duct segment per proposed segment', () => {
    const plan = buildHvacCommit(proposalOf(supplyNetwork()), 'lyr_1', 'mm', name);
    expect(plan.segmentEntities).toHaveLength(2);
    expect(plan.skippedSegments).toBe(0);
    expect(plan.segmentEntities.every((e) => e.params.domain === 'duct')).toBe(true);
    expect(plan.segmentEntities.every((e) => e.params.sectionKind === 'round')).toBe(true);
  });

  it('a duct segment carries no plumbing classification (the System owns it)', () => {
    const plan = buildHvacCommit(proposalOf(supplyNetwork()), 'lyr_1', 'mm', name);
    for (const e of plan.segmentEntities) {
      expect('classification' in e.params).toBe(false);
    }
  });

  it('creates one duct-network MepSystem with the right classification + AHU source', () => {
    const plan = buildHvacCommit(proposalOf(supplyNetwork()), 'lyr_1', 'mm', name);
    expect(plan.systemEntities).toHaveLength(1);
    const sys = plan.systemEntities[0]!;
    expect(isDuctSystemParams(sys.params)).toBe(true);
    expect(sys.params.systemType).toBe('duct-network');
    expect(sys.params.systemClassification).toBe('supply-air');
    expect(sys.params.sourceEntityId).toBe('ahu-1');
    expect(sys.params.sourceConnectorId).toBe('ahu-supply');
  });

  it('seeds the system with the SSoT supply-air palette colour', () => {
    const plan = buildHvacCommit(proposalOf(supplyNetwork()), 'lyr_1', 'mm', name);
    expect(plan.systemEntities[0]!.params.color).toBe('#38bdf8');
  });

  it('members = 2 endpoints per segment + every served terminal connector', () => {
    const plan = buildHvacCommit(proposalOf(supplyNetwork()), 'lyr_1', 'mm', name);
    const sys = plan.systemEntities[0]!;
    // 2 segments × 2 endpoints + 1 served connector = 5
    expect(sys.params.members).toHaveLength(5);
    expect(sys.params.members).toContainEqual({ entityId: 'at-1', connectorId: 'at-supply' });
    for (const e of plan.segmentEntities) {
      const forSeg = sys.params.members.filter((m) => m.entityId === e.id);
      expect(forSeg).toHaveLength(2);
    }
  });

  it('builds every duct flat at the AHU outlet elevation (Revit "Connect To")', () => {
    const plan = buildHvacCommit(proposalOf(supplyNetwork()), 'lyr_1', 'mm', name);
    expect(plan.segmentEntities).toHaveLength(2);
    for (const e of plan.segmentEntities) {
      expect(e.params.centerlineElevationMm).toBe(2800);
      expect(e.params.startPoint.z).toBe(2800);
      expect(e.params.endPoint.z).toBe(2800);
    }
  });

  it('an empty proposal yields no entities', () => {
    const plan = buildHvacCommit(proposalOf(), 'lyr_1', 'mm', name);
    expect(plan.segmentEntities).toHaveLength(0);
    expect(plan.systemEntities).toHaveLength(0);
  });
});

describe('hvacProposalStore', () => {
  afterEach(() => hvacProposalStore.reset());

  it('set then get returns the review; reset clears it', () => {
    expect(hvacProposalStore.get()).toBeNull();
    const review = { proposal: proposalOf(supplyNetwork()), sceneUnits: 'mm' as const };
    hvacProposalStore.set(review);
    expect(hvacProposalStore.get()).toBe(review);
    hvacProposalStore.reset();
    expect(hvacProposalStore.get()).toBeNull();
  });
});
