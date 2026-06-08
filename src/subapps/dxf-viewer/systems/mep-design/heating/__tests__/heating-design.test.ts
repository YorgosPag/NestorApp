/**
 * ADR-428 — Heating (Hydronic) Auto-Design (Slice 1): unit tests.
 *
 * Demand (W → l/s at ΔΤ 20K) · Sizing (Σflow → DN, velocity-limited) · Source/sink resolve
 * (boiler supply-out + return-in). All pure/deterministic.
 */

import type { Entity } from '../../../../types/entities';
import { recognizeScene } from '../../../recognition/recognition-engine';
import { heatingTerminalRecognizer } from '../../../recognition/recognizers/heating-terminal-recognizer';
import { buildHeatingDemandModel } from '../heating-demand';
import {
  HEATING_70_50_DEMAND_STANDARD,
  flowLpsForTerminal,
} from '../heating-flow';
import { HYDRONIC_VELOCITY_SIZING } from '../heating-sizing';
import {
  resolveHeatingSupplySource,
  resolveHeatingReturnSink,
} from '../heating-source-resolve';

// ─── Scene builders ───────────────────────────────────────────────────────────

/** A panel radiator with a hydronic-supply inlet + hydronic-return outlet. */
function radiator(id: string, x: number, y: number, thermalOutputW?: number): Entity {
  return {
    id,
    type: 'mep-radiator',
    layerId: 'heating',
    params: {
      kind: 'panel-radiator',
      shape: 'rectangular',
      position: { x, y, z: 0 },
      rotation: 0,
      width: 1000,
      length: 100,
      bodyHeightMm: 600,
      mountingElevationMm: 450,
      connectorDiameterMm: 15,
      thermalOutputW,
      connectors: [
        {
          connectorId: 'rad-supply',
          domain: 'pipe',
          flow: 'in',
          localPosition: { x: -400, y: 0, z: 0 },
          pipe: { systemClassification: 'hydronic-supply', diameterMm: 15 },
        },
        {
          connectorId: 'rad-return',
          domain: 'pipe',
          flow: 'out',
          localPosition: { x: 400, y: 0, z: 0 },
          pipe: { systemClassification: 'hydronic-return', diameterMm: 15 },
        },
      ],
    },
  } as unknown as Entity;
}

/** A boiler with a hydronic-supply outlet + hydronic-return inlet. */
function boiler(id: string, x: number, y: number): Entity {
  return {
    id,
    type: 'mep-boiler',
    layerId: 'heating',
    params: {
      kind: 'wall-hung-gas',
      position: { x, y, z: 0 },
      rotation: 0,
      connectors: [
        {
          connectorId: 'boiler-supply',
          domain: 'pipe',
          flow: 'out',
          localPosition: { x: -50, y: 0, z: 0 },
          pipe: { systemClassification: 'hydronic-supply', diameterMm: 22 },
        },
        {
          connectorId: 'boiler-return',
          domain: 'pipe',
          flow: 'in',
          localPosition: { x: 50, y: 0, z: 0 },
          pipe: { systemClassification: 'hydronic-return', diameterMm: 22 },
        },
      ],
    },
  } as unknown as Entity;
}

function recognize(entities: readonly Entity[]) {
  return recognizeScene(
    { entities, storeyId: 'floor-1', sceneUnits: 'mm' },
    { recognizers: [heatingTerminalRecognizer] },
  );
}

// ─── Demand (W → l/s) ───────────────────────────────────────────────────────

describe('ADR-428 Stage 1 — demand (thermal output → design flow)', () => {
  it('converts W to l/s at the 70/50 regime (ΔΤ 20K)', () => {
    // V̇ = Q / (ρ·c·ΔΤ)·1000 = 2000 / (1000·4187·20)·1000 ≈ 0.0239 l/s
    const { flowLps, thermalOutputW } = flowLpsForTerminal(HEATING_70_50_DEMAND_STANDARD, 2000);
    expect(thermalOutputW).toBe(2000);
    expect(flowLps).toBeCloseTo(0.02389, 4);
  });

  it('falls back to the standard default output when a terminal is unsized', () => {
    const sized = flowLpsForTerminal(HEATING_70_50_DEMAND_STANDARD, undefined);
    expect(sized.thermalOutputW).toBe(HEATING_70_50_DEMAND_STANDARD.defaultTerminalOutputW);
    expect(sized.flowLps).toBeGreaterThan(0);
  });

  it('emits one demand per terminal carrying both connector points + the flow', () => {
    const scene = [radiator('r1', 1000, 1000, 2000), radiator('r2', 3000, 1000, 1000)];
    const model = recognize(scene);
    const demand = buildHeatingDemandModel(model, scene, HEATING_70_50_DEMAND_STANDARD);
    const byId = new Map(demand.demands.map((d) => [d.entityId, d]));

    expect(demand.demands).toHaveLength(2);
    const r1 = byId.get('r1')!;
    expect(r1.supplyConnectorId).toBe('rad-supply');
    expect(r1.returnConnectorId).toBe('rad-return');
    // supply inlet at local -400, return outlet at local +400 (rotation 0)
    expect(r1.supplyPoint).toEqual({ x: 600, y: 1000 });
    expect(r1.returnPoint).toEqual({ x: 1400, y: 1000 });
    expect(r1.flowLps).toBeGreaterThan(byId.get('r2')!.flowLps); // 2000W > 1000W
  });
});

// ─── Sizing (velocity-limited DN) ─────────────────────────────────────────────

describe('ADR-428 Stage 4 — sizing (Σflow → DN, v ≤ 1.0 m/s)', () => {
  const dn = (lps: number) => HYDRONIC_VELOCITY_SIZING.diameterForFlowLps(lps);

  it('picks the smallest DN keeping velocity at or below the max', () => {
    // DN15 bore ≈ 0.177 l/s @ 1 m/s; a tiny flow stays on the smallest ladder rung.
    expect(dn(0.02)).toBe(10);
    expect(dn(0.15)).toBe(15);
    // ~0.4 l/s exceeds DN20 (0.314) → DN25 (0.491)
    expect(dn(0.4)).toBe(25);
    // a big trunk flow climbs the ladder
    expect(dn(1.5)).toBe(50);
  });

  it('monotonic: a larger cumulative flow never gets a smaller DN', () => {
    let prev = 0;
    for (const lps of [0.05, 0.2, 0.5, 0.9, 1.4, 2.0, 3.0]) {
      const d = dn(lps);
      expect(d).toBeGreaterThanOrEqual(prev);
      prev = d;
    }
  });
});

// ─── Source / sink resolve ────────────────────────────────────────────────────

describe('ADR-428 Stage 2 — boiler endpoints', () => {
  it('resolves the supply outlet + return inlet on the boiler', () => {
    const entities = [boiler('b', 0, 0), radiator('r1', 1000, 0, 2000)];
    const supply = resolveHeatingSupplySource(entities);
    const ret = resolveHeatingReturnSink(entities);

    expect(supply).not.toBeNull();
    expect(supply!.connectorId).toBe('boiler-supply');
    expect(supply!.classification).toBe('hydronic-supply');
    expect(supply!.point).toEqual({ x: -50, y: 0 });

    expect(ret).not.toBeNull();
    expect(ret!.connectorId).toBe('boiler-return');
    expect(ret!.classification).toBe('hydronic-return');
    expect(ret!.point).toEqual({ x: 50, y: 0 });
  });

  it('returns null when no boiler is present', () => {
    const entities = [radiator('r1', 1000, 0, 2000)];
    expect(resolveHeatingSupplySource(entities)).toBeNull();
    expect(resolveHeatingReturnSink(entities)).toBeNull();
  });
});
