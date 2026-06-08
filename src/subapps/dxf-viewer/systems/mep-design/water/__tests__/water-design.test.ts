/**
 * ADR-426 — Water-Supply Auto-Design (Slice 1): unit tests.
 *
 * Demand (LU from EN806) · Sizing (ΣLU→DN) · Router (Manhattan trunk-branch) ·
 * orchestrator (cold/hot networks + missing-source warning). All pure/deterministic.
 */

import type { Entity } from '../../../../types/entities';
import type { MepFixtureEntity, MepFixtureKind } from '../../../../bim/types/mep-fixture-types';
import type { PlumbingSystemClassification } from '../../../../bim/types/mep-connector-types';
import { buildDefaultMepFixtureParams } from '../../../../hooks/drawing/mep-fixture-completion';
import { recognizeScene } from '../../../recognition/recognition-engine';
import { sanitaryTerminalRecognizer } from '../../../recognition/recognizers/sanitary-terminal-recognizer';
import { buildWaterDemandModel } from '../water-demand';
import { EN806_DEMAND_STANDARD } from '../water-loading-units';
import { DIN1988_SIZING_STANDARD } from '../water-sizing';
import { routeOrthogonalTrunkBranch, type RouteTarget } from '../orthogonal-router';
import { designWaterSupply } from '../design-water-supply';

// ─── Scene builders ───────────────────────────────────────────────────────────

function fixture(id: string, kind: MepFixtureKind, x: number, y: number): MepFixtureEntity {
  const params = buildDefaultMepFixtureParams({ x, y }, { kind });
  return { id, type: 'mep-fixture', layerId: 'sanitary', params } as MepFixtureEntity;
}

function source(
  id: string,
  x: number,
  y: number,
  classification: PlumbingSystemClassification,
): Entity {
  return {
    id,
    type: 'mep-manifold',
    layerId: 'plumbing',
    params: {
      position: { x, y, z: 0 },
      rotation: 0,
      connectors: [
        {
          connectorId: 'm-out-0',
          domain: 'pipe',
          flow: 'out',
          localPosition: { x: 0, y: 0, z: 0 },
          pipe: { systemClassification: classification, diameterMm: 28 },
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

describe('ADR-426 Stage 1 — demand (EN806 loading units)', () => {
  it('emits cold-only for WC, cold+hot for washbasin, with correct LU', () => {
    const model = recognize([fixture('wc', 'wc', 1000, 1000), fixture('wb', 'washbasin', 2000, 1000)]);
    const demand = buildWaterDemandModel(model, [
      fixture('wc', 'wc', 1000, 1000),
      fixture('wb', 'washbasin', 2000, 1000),
    ], EN806_DEMAND_STANDARD);

    const byKey = new Map(demand.demands.map((d) => [`${d.entityId}:${d.service}`, d]));
    expect(byKey.get('wc:cold')!.loadingUnits).toBe(1);
    expect(byKey.has('wc:hot')).toBe(false); // WC = cold only
    expect(byKey.get('wb:cold')!.loadingUnits).toBe(1);
    expect(byKey.get('wb:hot')!.loadingUnits).toBe(1);
  });
});

// ─── Sizing ───────────────────────────────────────────────────────────────────

describe('ADR-426 Stage 4 — sizing (ΣLU → DN, diminishing)', () => {
  const dn = (lu: number) => DIN1988_SIZING_STANDARD.diameterForLU(lu);
  it('maps cumulative LU to ascending DN steps', () => {
    expect(dn(1)).toBe(15);
    expect(dn(4)).toBe(18);
    expect(dn(5)).toBe(22);
    expect(dn(20)).toBe(28);
    expect(dn(50)).toBe(35);
    expect(dn(99)).toBe(42);
    expect(dn(500)).toBe(54); // above last threshold → max DN
  });
});

// ─── Router ───────────────────────────────────────────────────────────────────

describe('ADR-426 Stage 3 — orthogonal trunk-branch router', () => {
  it('builds a spine with diminishing cumulative LU + branch drops', () => {
    const src = { x: 0, y: 0 };
    const targets: RouteTarget[] = [
      { point: { x: 2000, y: 500 }, loadingUnits: 2 },
      { point: { x: 4000, y: -300 }, loadingUnits: 1 },
    ];
    const segs = routeOrthogonalTrunkBranch(src, targets);
    const trunks = segs.filter((s) => s.role === 'trunk');
    const branches = segs.filter((s) => s.role === 'branch');
    expect(trunks).toHaveLength(2);
    expect(branches).toHaveLength(2);
    // first trunk from source carries total LU (3), second carries only the far fixture (1)
    expect(trunks[0]).toMatchObject({ start: { x: 0, y: 0 }, end: { x: 2000, y: 0 }, cumulativeLU: 3 });
    expect(trunks[1]).toMatchObject({ start: { x: 2000, y: 0 }, end: { x: 4000, y: 0 }, cumulativeLU: 1 });
    // branches drop orthogonally to each fixture, carrying that fixture's LU
    expect(branches[0]).toMatchObject({ end: { x: 2000, y: 500 }, cumulativeLU: 2 });
  });

  it('handles fixtures on both sides of the source (two arms)', () => {
    const segs = routeOrthogonalTrunkBranch({ x: 0, y: 0 }, [
      { point: { x: 1000, y: 200 }, loadingUnits: 1 },
      { point: { x: -1500, y: 200 }, loadingUnits: 1 },
    ]);
    expect(segs.filter((s) => s.role === 'trunk')).toHaveLength(2); // one per arm
    expect(segs.filter((s) => s.role === 'branch')).toHaveLength(2);
  });

  it('returns nothing for no targets', () => {
    expect(routeOrthogonalTrunkBranch({ x: 0, y: 0 }, [])).toHaveLength(0);
  });
});

// ─── Orchestrator ─────────────────────────────────────────────────────────────

describe('ADR-426 — designWaterSupply orchestrator', () => {
  it('routes a cold network and warns when the hot source is missing', () => {
    const entities: Entity[] = [
      source('m-cold', 0, 0, 'domestic-cold-water'),
      fixture('wc', 'wc', 1500, 800),
      fixture('wb', 'washbasin', 3000, 800), // washbasin draws hot too
    ];
    const model = recognize(entities);
    const proposal = designWaterSupply(model, entities);

    const cold = proposal.networks.find((n) => n.service === 'cold');
    expect(cold).toBeDefined();
    expect(cold!.segments.length).toBeGreaterThan(0);
    expect(cold!.totalLU).toBe(2); // wc 1 + washbasin 1
    expect(cold!.sourceEntityId).toBe('m-cold');
    // every segment sized
    for (const s of cold!.segments) expect(s.diameterMm).toBeGreaterThanOrEqual(15);
    // hot has demand (washbasin) but no source → warning, no hot network
    expect(proposal.networks.find((n) => n.service === 'hot')).toBeUndefined();
    expect(proposal.warnings.some((w) => w.includes('domestic-hot-water'))).toBe(true);
  });

  it('routes both cold and hot when both sources exist', () => {
    const entities: Entity[] = [
      source('m-cold', 0, 0, 'domestic-cold-water'),
      source('m-hot', 0, 200, 'domestic-hot-water'),
      fixture('wb', 'washbasin', 2000, 1000),
      fixture('sh', 'shower', 3500, 1000),
    ];
    const model = recognize(entities);
    const proposal = designWaterSupply(model, entities);
    expect(proposal.networks.map((n) => n.service).sort()).toEqual(['cold', 'hot']);
    expect(proposal.warnings).toHaveLength(0);
    const hot = proposal.networks.find((n) => n.service === 'hot')!;
    expect(hot.totalLU).toBe(3); // washbasin 1 + shower 2
  });
});
