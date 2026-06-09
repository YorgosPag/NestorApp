/**
 * ADR-432 — HVAC (ventilation) Auto-Design (Slice 1): unit + integration tests.
 *
 * Demand (constant air-flow) · Sizing (Σair-flow → round Ø, ASHRAE equal-friction) ·
 * Source resolve (AHU duct outlet, connector-driven) · orchestrator (supply network +
 * missing-source warning). All pure/deterministic.
 */

import type { Entity } from '../../../../types/entities';
import type { MepFixtureEntity } from '../../../../bim/types/mep-fixture-types';
import { buildDefaultMepFixtureParams } from '../../../../hooks/drawing/mep-fixture-completion';
import { recognizeScene } from '../../../recognition/recognition-engine';
import { airTerminalRecognizer } from '../../../recognition/recognizers/air-terminal-recognizer';
import { buildHvacDemandModel } from '../hvac-air-demand';
import { CONSTANT_AIRFLOW_DEMAND_STANDARD, DEFAULT_TERMINAL_AIRFLOW_CMH } from '../air-flow-standard';
import { ASHRAE_EQUAL_FRICTION_SIZING } from '../duct-sizing';
import { resolveHvacSource } from '../hvac-source-resolve';
import { designHvac } from '../design-hvac';

// ─── Scene builders ───────────────────────────────────────────────────────────

function fixture(id: string, kind: 'air-terminal' | 'ahu', x: number, y: number): MepFixtureEntity {
  const params = buildDefaultMepFixtureParams({ x, y }, { kind });
  return { id, type: 'mep-fixture', layerId: 'hvac', params } as MepFixtureEntity;
}

function recognize(entities: readonly Entity[]) {
  return recognizeScene(
    { entities, storeyId: 'floor-1', sceneUnits: 'mm' },
    { recognizers: [airTerminalRecognizer] },
  );
}

// ─── Demand ───────────────────────────────────────────────────────────────────

describe('ADR-432 Stage 1 — demand (constant air-flow)', () => {
  it('emits one supply demand per air terminal at the standard air-flow', () => {
    const entities = [fixture('at1', 'air-terminal', 1000, 1000), fixture('at2', 'air-terminal', 2000, 1000)];
    const model = recognize(entities);
    const demand = buildHvacDemandModel(model, entities, CONSTANT_AIRFLOW_DEMAND_STANDARD);
    expect(demand.demands).toHaveLength(2);
    for (const d of demand.demands) {
      expect(d.service).toBe('supply');
      expect(d.airflowCmh).toBe(DEFAULT_TERMINAL_AIRFLOW_CMH);
    }
  });

  it('does NOT emit a demand for the AHU (it is the source, not a terminal)', () => {
    const entities = [fixture('ahu1', 'ahu', 0, 0), fixture('at1', 'air-terminal', 1000, 1000)];
    const model = recognize(entities);
    const demand = buildHvacDemandModel(model, entities, CONSTANT_AIRFLOW_DEMAND_STANDARD);
    expect(demand.demands).toHaveLength(1);
    expect(demand.demands[0]!.entityId).toBe('at1');
  });
});

// ─── Sizing ───────────────────────────────────────────────────────────────────

describe('ADR-432 Stage 4 — sizing (Σair-flow → round Ø, ascending)', () => {
  const dia = (cmh: number) => ASHRAE_EQUAL_FRICTION_SIZING.diameterForAirflow(cmh);
  it('maps cumulative air-flow to ascending standard round-duct sizes', () => {
    expect(dia(100)).toBe(100);
    expect(dia(150)).toBe(125);
    expect(dia(300)).toBe(160);
    expect(dia(500)).toBe(200);
    expect(dia(900)).toBe(250);
    expect(dia(1500)).toBe(315);
    expect(dia(2500)).toBe(400);
    expect(dia(9999)).toBe(500); // above last threshold → max size
  });
});

// ─── Source resolve ─────────────────────────────────────────────────────────

describe('ADR-432 Stage 2 — source resolve (AHU duct outlet, connector-driven)', () => {
  it('finds the AHU supply-air outlet and ignores the air terminal', () => {
    const entities = [fixture('at1', 'air-terminal', 1000, 1000), fixture('ahu1', 'ahu', 0, 0)];
    const source = resolveHvacSource(entities, 'supply-air');
    expect(source).not.toBeNull();
    expect(source!.entityId).toBe('ahu1');
    expect(source!.classification).toBe('supply-air');
  });

  it('returns null when no AHU is present', () => {
    const entities = [fixture('at1', 'air-terminal', 1000, 1000)];
    expect(resolveHvacSource(entities, 'supply-air')).toBeNull();
  });
});

// ─── Orchestrator ─────────────────────────────────────────────────────────────

describe('ADR-432 — designHvac orchestrator', () => {
  it('routes a sized supply duct network from the AHU to the terminals', () => {
    const entities: Entity[] = [
      fixture('ahu1', 'ahu', 0, 0),
      fixture('at1', 'air-terminal', 1500, 800),
      fixture('at2', 'air-terminal', 3000, 800),
    ];
    const model = recognize(entities);
    const proposal = designHvac(model, entities);

    const supply = proposal.networks.find((n) => n.service === 'supply');
    expect(supply).toBeDefined();
    expect(supply!.segments.length).toBeGreaterThan(0);
    expect(supply!.totalAirflowCmh).toBe(2 * DEFAULT_TERMINAL_AIRFLOW_CMH);
    expect(supply!.sourceEntityId).toBe('ahu1');
    expect(supply!.classification).toBe('supply-air');
    for (const s of supply!.segments) expect(s.diameterMm).toBeGreaterThanOrEqual(100);
    expect(proposal.warnings).toHaveLength(0);
  });

  it('warns and emits no network when there are terminals but no AHU', () => {
    const entities: Entity[] = [
      fixture('at1', 'air-terminal', 1500, 800),
      fixture('at2', 'air-terminal', 3000, 800),
    ];
    const model = recognize(entities);
    const proposal = designHvac(model, entities);
    expect(proposal.networks).toHaveLength(0);
    expect(proposal.warnings.some((w) => w.includes('supply-air'))).toBe(true);
  });
});
