/**
 * ADR-433 — Fire-protection (sprinkler) Auto-Design (Slice 1): unit + integration tests.
 *
 * Demand (constant design flow) · Sizing (Σflow → DN, velocity-limited) · Source resolve
 * (fire-riser pipe outlet, connector-driven) · orchestrator (wet-pipe network + missing-source
 * warning). All pure/deterministic. Mirror of `hvac-design.test.ts` but on the pressurised
 * pipe domain (the segment carries the `fire-sprinkler` classification).
 */

import type { Entity } from '../../../../types/entities';
import type { MepFixtureEntity } from '../../../../bim/types/mep-fixture-types';
import { buildDefaultMepFixtureParams } from '../../../../hooks/drawing/mep-fixture-completion';
import { recognizeScene } from '../../../recognition/recognition-engine';
import { sprinklerRecognizer } from '../../../recognition/recognizers/sprinkler-recognizer';
import { buildFireDemandModel } from '../fire-demand';
import { NFPA13_LIGHT_HAZARD_DEMAND_STANDARD, DEFAULT_SPRINKLER_FLOW_LPM } from '../fire-flow-standard';
import { VELOCITY_LIMITED_FIRE_SIZING } from '../fire-sizing';
import { resolveFireSource } from '../fire-source-resolve';
import { designFire } from '../design-fire';

// ─── Scene builders ───────────────────────────────────────────────────────────

function fixture(id: string, kind: 'sprinkler' | 'fire-riser', x: number, y: number): MepFixtureEntity {
  const params = buildDefaultMepFixtureParams({ x, y }, { kind });
  return { id, type: 'mep-fixture', layerId: 'fire', params } as MepFixtureEntity;
}

function recognize(entities: readonly Entity[]) {
  return recognizeScene(
    { entities, storeyId: 'floor-1', sceneUnits: 'mm' },
    { recognizers: [sprinklerRecognizer] },
  );
}

// ─── Demand ───────────────────────────────────────────────────────────────────

describe('ADR-433 Stage 1 — demand (constant design flow)', () => {
  it('emits one sprinkler demand per head at the standard flow', () => {
    const entities = [fixture('sk1', 'sprinkler', 1000, 1000), fixture('sk2', 'sprinkler', 2000, 1000)];
    const model = recognize(entities);
    const demand = buildFireDemandModel(model, entities, NFPA13_LIGHT_HAZARD_DEMAND_STANDARD);
    expect(demand.demands).toHaveLength(2);
    for (const d of demand.demands) {
      expect(d.service).toBe('sprinkler');
      expect(d.flowLpm).toBe(DEFAULT_SPRINKLER_FLOW_LPM);
    }
  });

  it('does NOT emit a demand for the fire riser (it is the source, not a terminal)', () => {
    const entities = [fixture('fr1', 'fire-riser', 0, 0), fixture('sk1', 'sprinkler', 1000, 1000)];
    const model = recognize(entities);
    const demand = buildFireDemandModel(model, entities, NFPA13_LIGHT_HAZARD_DEMAND_STANDARD);
    expect(demand.demands).toHaveLength(1);
    expect(demand.demands[0]!.entityId).toBe('sk1');
  });
});

// ─── Sizing ───────────────────────────────────────────────────────────────────

describe('ADR-433 Stage 4 — sizing (Σflow → DN, velocity-limited, ascending)', () => {
  const dn = (lpm: number) => VELOCITY_LIMITED_FIRE_SIZING.diameterForFlow(lpm);
  it('maps cumulative flow to ascending standard DN sizes', () => {
    expect(dn(80)).toBe(20);
    expect(dn(160)).toBe(25);
    expect(dn(285)).toBe(32);
    expect(dn(450)).toBe(40);
    expect(dn(705)).toBe(50);
    expect(dn(1190)).toBe(65);
    expect(dn(1805)).toBe(80);
    expect(dn(9999)).toBe(100); // above last threshold → max DN
  });
});

// ─── Source resolve ─────────────────────────────────────────────────────────

describe('ADR-433 Stage 2 — source resolve (fire-riser pipe outlet, connector-driven)', () => {
  it('finds the fire-riser outlet and ignores the sprinkler head', () => {
    const entities = [fixture('sk1', 'sprinkler', 1000, 1000), fixture('fr1', 'fire-riser', 0, 0)];
    const source = resolveFireSource(entities, 'fire-sprinkler');
    expect(source).not.toBeNull();
    expect(source!.entityId).toBe('fr1');
    expect(source!.classification).toBe('fire-sprinkler');
  });

  it('returns null when no fire riser is present', () => {
    const entities = [fixture('sk1', 'sprinkler', 1000, 1000)];
    expect(resolveFireSource(entities, 'fire-sprinkler')).toBeNull();
  });
});

// ─── Orchestrator ─────────────────────────────────────────────────────────────

describe('ADR-433 — designFire orchestrator', () => {
  it('routes a sized wet-pipe network from the riser to the heads', () => {
    const entities: Entity[] = [
      fixture('fr1', 'fire-riser', 0, 0),
      fixture('sk1', 'sprinkler', 1500, 800),
      fixture('sk2', 'sprinkler', 3000, 800),
    ];
    const model = recognize(entities);
    const proposal = designFire(model, entities);

    const net = proposal.networks.find((n) => n.service === 'sprinkler');
    expect(net).toBeDefined();
    expect(net!.segments.length).toBeGreaterThan(0);
    expect(net!.totalFlowLpm).toBe(2 * DEFAULT_SPRINKLER_FLOW_LPM);
    expect(net!.sourceEntityId).toBe('fr1');
    expect(net!.classification).toBe('fire-sprinkler');
    for (const s of net!.segments) {
      expect(s.classification).toBe('fire-sprinkler');
      expect(s.diameterMm).toBeGreaterThanOrEqual(20);
    }
    expect(proposal.warnings).toHaveLength(0);
  });

  it('warns and emits no network when there are heads but no riser', () => {
    const entities: Entity[] = [
      fixture('sk1', 'sprinkler', 1500, 800),
      fixture('sk2', 'sprinkler', 3000, 800),
    ];
    const model = recognize(entities);
    const proposal = designFire(model, entities);
    expect(proposal.networks).toHaveLength(0);
    expect(proposal.warnings.some((w) => w.includes('fire-sprinkler'))).toBe(true);
  });
});
