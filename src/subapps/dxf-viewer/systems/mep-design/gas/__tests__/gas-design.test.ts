/**
 * ADR-434 — Gas (φυσικό αέριο) Auto-Design (Slice 1): unit + integration tests.
 *
 * Demand (constant appliance-flow) · Sizing (Σflow → DN, low-pressure velocity-limited) ·
 * Source resolve (gas-meter fuel outlet, connector-driven) · orchestrator (gas network +
 * missing-source warning). All pure/deterministic.
 */

import type { Entity } from '../../../../types/entities';
import type { MepFixtureEntity } from '../../../../bim/types/mep-fixture-types';
import { buildDefaultMepFixtureParams } from '../../../../hooks/drawing/mep-fixture-completion';
import { recognizeScene } from '../../../recognition/recognition-engine';
import { gasRecognizer } from '../../../recognition/recognizers/gas-recognizer';
import { buildGasDemandModel } from '../gas-demand';
import { CONSTANT_GAS_DEMAND_STANDARD, DEFAULT_GAS_COOKER_FLOW_CMH } from '../gas-flow-standard';
import { LOW_PRESSURE_VELOCITY_SIZING } from '../gas-sizing';
import { resolveGasSource } from '../gas-source-resolve';
import { designGas } from '../design-gas';

// ─── Scene builders ───────────────────────────────────────────────────────────

function fixture(id: string, kind: 'gas-meter' | 'gas-cooker', x: number, y: number): MepFixtureEntity {
  const params = buildDefaultMepFixtureParams({ x, y }, { kind });
  return { id, type: 'mep-fixture', layerId: 'gas', params } as MepFixtureEntity;
}

function recognize(entities: readonly Entity[]) {
  return recognizeScene(
    { entities, storeyId: 'floor-1', sceneUnits: 'mm' },
    { recognizers: [gasRecognizer] },
  );
}

// ─── Demand ───────────────────────────────────────────────────────────────────

describe('ADR-434 Stage 1 — demand (constant appliance-flow)', () => {
  it('emits one gas demand per cooker at the standard flow', () => {
    const entities = [fixture('c1', 'gas-cooker', 1000, 1000), fixture('c2', 'gas-cooker', 2000, 1000)];
    const model = recognize(entities);
    const demand = buildGasDemandModel(model, entities, CONSTANT_GAS_DEMAND_STANDARD);
    expect(demand.demands).toHaveLength(2);
    for (const d of demand.demands) {
      expect(d.service).toBe('gas');
      expect(d.flowCmh).toBe(DEFAULT_GAS_COOKER_FLOW_CMH);
    }
  });

  it('does NOT emit a demand for the gas meter (it is the source, not a terminal)', () => {
    const entities = [fixture('m1', 'gas-meter', 0, 0), fixture('c1', 'gas-cooker', 1000, 1000)];
    const model = recognize(entities);
    const demand = buildGasDemandModel(model, entities, CONSTANT_GAS_DEMAND_STANDARD);
    expect(demand.demands).toHaveLength(1);
    expect(demand.demands[0]!.entityId).toBe('c1');
  });
});

// ─── Sizing ───────────────────────────────────────────────────────────────────

describe('ADR-434 Stage 4 — sizing (Σflow → DN, ascending)', () => {
  const dn = (cmh: number) => LOW_PRESSURE_VELOCITY_SIZING.diameterForFlow(cmh);
  it('maps cumulative gas flow to ascending standard nominal diameters', () => {
    expect(dn(2)).toBe(15);
    expect(dn(5)).toBe(20);
    expect(dn(12)).toBe(25);
    expect(dn(30)).toBe(32);
    expect(dn(80)).toBe(40);
    expect(dn(999)).toBe(50); // above last threshold → max size
  });
});

// ─── Source resolve ─────────────────────────────────────────────────────────

describe('ADR-434 Stage 2 — source resolve (gas-meter fuel outlet, connector-driven)', () => {
  it('finds the gas-meter fuel-gas outlet and ignores the cooker', () => {
    const entities = [fixture('c1', 'gas-cooker', 1000, 1000), fixture('m1', 'gas-meter', 0, 0)];
    const source = resolveGasSource(entities, 'fuel-gas');
    expect(source).not.toBeNull();
    expect(source!.entityId).toBe('m1');
    expect(source!.classification).toBe('fuel-gas');
  });

  it('returns null when no gas meter is present', () => {
    const entities = [fixture('c1', 'gas-cooker', 1000, 1000)];
    expect(resolveGasSource(entities, 'fuel-gas')).toBeNull();
  });
});

// ─── Orchestrator ─────────────────────────────────────────────────────────────

describe('ADR-434 — designGas orchestrator', () => {
  it('routes a sized fuel network from the meter to the appliances', () => {
    const entities: Entity[] = [
      fixture('m1', 'gas-meter', 0, 0),
      fixture('c1', 'gas-cooker', 1500, 800),
      fixture('c2', 'gas-cooker', 3000, 800),
    ];
    const model = recognize(entities);
    const proposal = designGas(model, entities);

    const gas = proposal.networks.find((n) => n.service === 'gas');
    expect(gas).toBeDefined();
    expect(gas!.segments.length).toBeGreaterThan(0);
    expect(gas!.totalFlowCmh).toBeCloseTo(2 * DEFAULT_GAS_COOKER_FLOW_CMH);
    expect(gas!.sourceEntityId).toBe('m1');
    expect(gas!.classification).toBe('fuel-gas');
    for (const s of gas!.segments) expect(s.diameterMm).toBeGreaterThanOrEqual(15);
    expect(proposal.warnings).toHaveLength(0);
  });

  it('warns and emits no network when there are appliances but no meter', () => {
    const entities: Entity[] = [
      fixture('c1', 'gas-cooker', 1500, 800),
      fixture('c2', 'gas-cooker', 3000, 800),
    ];
    const model = recognize(entities);
    const proposal = designGas(model, entities);
    expect(proposal.networks).toHaveLength(0);
    expect(proposal.warnings.some((w) => w.includes('fuel-gas'))).toBe(true);
  });
});
