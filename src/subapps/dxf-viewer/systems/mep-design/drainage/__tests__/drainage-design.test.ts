/**
 * ADR-427 — Sanitary Drainage Auto-Design (Slice 1): unit tests.
 *
 * Demand (DU from EN12056-2) · Sizing (ΣDU→DN growing + min slope) · Router min-Ø
 * propagation · orchestrator (gravity network rooted at the collector, descending z,
 * WC→DN100, missing-collector warning). All pure/deterministic.
 */

import type { Entity } from '../../../../types/entities';
import type { MepFixtureEntity, MepFixtureKind } from '../../../../bim/types/mep-fixture-types';
import { buildDefaultMepFixtureParams } from '../../../../hooks/drawing/mep-fixture-completion';
import { recognizeScene } from '../../../recognition/recognition-engine';
import { sanitaryTerminalRecognizer } from '../../../recognition/recognizers/sanitary-terminal-recognizer';
import { routeOrthogonalTrunkBranch, type RouteTarget } from '../../routing/orthogonal-router';
import { buildDrainageDemandModel } from '../drainage-demand';
import { EN12056_DEMAND_STANDARD } from '../discharge-units';
import { EN12056_DRAINAGE_SIZING } from '../drainage-sizing';
import { designDrainage } from '../design-drainage';

// ─── Scene builders ───────────────────────────────────────────────────────────

function fixture(id: string, kind: MepFixtureKind, x: number, y: number): MepFixtureEntity {
  const params = buildDefaultMepFixtureParams({ x, y }, { kind });
  return { id, type: 'mep-fixture', layerId: 'sanitary', params } as MepFixtureEntity;
}

/** A drainage-collector (φρεάτιο) manifold with a sanitary-drainage outlet. */
function collector(id: string, x: number, y: number): Entity {
  return {
    id,
    type: 'mep-manifold',
    layerId: 'plumbing',
    params: {
      kind: 'drainage-collector',
      position: { x, y, z: 0 },
      rotation: 0,
      connectors: [
        {
          connectorId: 'c-out-0',
          domain: 'pipe',
          flow: 'out',
          localPosition: { x: 0, y: 0, z: 0 },
          pipe: { systemClassification: 'sanitary-drainage', diameterMm: 110 },
        },
      ],
    },
  } as unknown as Entity;
}

function recognize(entities: readonly Entity[]) {
  return recognizeScene(
    { entities, storeyId: 'floor-1', sceneUnits: 'mm' },
    { recognizers: [sanitaryTerminalRecognizer] },
  );
}

// ─── Demand ───────────────────────────────────────────────────────────────────

describe('ADR-427 Stage 1 — demand (EN12056-2 discharge units)', () => {
  it('emits one drainage discharge per fixture with DU + min branch DN', () => {
    const scene = [fixture('wc', 'wc', 1000, 1000), fixture('wb', 'washbasin', 2000, 1000)];
    const model = recognize(scene);
    const demand = buildDrainageDemandModel(model, scene, EN12056_DEMAND_STANDARD);
    const byId = new Map(demand.discharges.map((d) => [d.entityId, d]));

    expect(demand.discharges).toHaveLength(2); // one drain each, supply refs ignored
    expect(byId.get('wc')!.dischargeUnits).toBe(2.0);
    expect(byId.get('wc')!.minBranchDiameterMm).toBe(100);
    expect(byId.get('wb')!.dischargeUnits).toBe(0.5);
    expect(byId.get('wb')!.minBranchDiameterMm).toBe(40);
  });
});

// ─── Sizing ───────────────────────────────────────────────────────────────────

describe('ADR-427 Stage 4 — sizing (ΣDU → DN, growing toward outfall)', () => {
  const dn = (du: number) => EN12056_DRAINAGE_SIZING.diameterForDU(du);
  it('maps cumulative DU to ascending DN steps', () => {
    expect(dn(0.5)).toBe(40);
    expect(dn(1.5)).toBe(50);
    expect(dn(4)).toBe(70);
    expect(dn(20)).toBe(100);
    expect(dn(70)).toBe(125);
    expect(dn(200)).toBe(150); // above last threshold → max DN
  });

  it('steeper minimum slope for smaller bore', () => {
    expect(EN12056_DRAINAGE_SIZING.minSlopePercentForDN(40)).toBe(2.5);
    expect(EN12056_DRAINAGE_SIZING.minSlopePercentForDN(70)).toBe(2.0);
    expect(EN12056_DRAINAGE_SIZING.minSlopePercentForDN(100)).toBe(1.5);
    expect(EN12056_DRAINAGE_SIZING.minSlopePercentForDN(150)).toBe(1.0);
  });
});

// ─── Router min-Ø propagation (the generic §A extension) ─────────────────────

describe('ADR-427 §A — router propagates min branch Ø as a trunk suffix-max', () => {
  it('a WC downstream forces the shared trunk to carry ≥ DN100', () => {
    const root = { x: 0, y: 0 };
    const targets: RouteTarget[] = [
      { point: { x: 2000, y: 500 }, loadingUnits: 0.5, minBranchDiameterMm: 40 }, // basin (near)
      { point: { x: 4000, y: -300 }, loadingUnits: 2.0, minBranchDiameterMm: 100 }, // WC (far)
    ];
    const segs = routeOrthogonalTrunkBranch(root, targets);
    const trunks = segs.filter((s) => s.role === 'trunk');
    // first trunk from the collector carries BOTH fixtures → min-Ø = max(40,100) = 100
    expect(trunks[0].cumulativeMinDiameterMm).toBe(100);
    expect(trunks[0].cumulativeLU).toBeCloseTo(2.5);
    // the basin branch keeps its own 40
    const basinBranch = segs.find((s) => s.role === 'branch' && s.end.x === 2000)!;
    expect(basinBranch.cumulativeMinDiameterMm).toBe(40);
  });
});

// ─── Orchestrator ─────────────────────────────────────────────────────────────

describe('ADR-427 — designDrainage orchestrator', () => {
  it('roots a gravity network at the collector, growing Ø + descending z', () => {
    const entities: Entity[] = [
      collector('col', 0, 0),
      fixture('wc', 'wc', 1500, 800),
      fixture('wb', 'washbasin', 3000, 800),
    ];
    const model = recognize(entities);
    const proposal = designDrainage(model, entities, 'mm');

    expect(proposal.networks).toHaveLength(1);
    const net = proposal.networks[0];
    expect(net.outfallEntityId).toBe('col');
    expect(net.totalDU).toBeCloseTo(2.5); // wc 2.0 + washbasin 0.5
    expect(net.segments.length).toBeGreaterThan(0);

    // WC branch must be ≥ DN100 (min branch DN), regardless of its small DU
    const wcBranch = net.segments.find(
      (s) => s.role === 'branch' && s.end.x === 1500 && s.end.y === 800,
    )!;
    expect(wcBranch.diameterMm).toBeGreaterThanOrEqual(100);

    // growing Ø: the largest trunk DN ≥ any branch DN (cumulative toward the collector)
    const maxTrunk = Math.max(...net.segments.filter((s) => s.role === 'trunk').map((s) => s.diameterMm));
    const maxBranch = Math.max(...net.segments.filter((s) => s.role === 'branch').map((s) => s.diameterMm));
    expect(maxTrunk).toBeGreaterThanOrEqual(maxBranch);

    // descending gravity: every run rises outward (start lower than end), root is lowest
    for (const s of net.segments) {
      expect(s.endElevationMm).toBeGreaterThan(s.startElevationMm);
      expect(s.startElevationMm).toBeGreaterThanOrEqual(net.outfallInvertElevationMm);
      expect(s.slopePercent).toBeGreaterThan(0);
    }
  });

  it('warns and routes nothing when no collector exists', () => {
    const entities: Entity[] = [fixture('wc', 'wc', 1500, 800)];
    const model = recognize(entities);
    const proposal = designDrainage(model, entities, 'mm');
    expect(proposal.networks).toHaveLength(0);
    expect(proposal.warnings.some((w) => w.includes('drainage-collector'))).toBe(true);
  });
});
