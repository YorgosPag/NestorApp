/**
 * ADR-429 Slice 3B — parallel supply/return pairing tests.
 *
 * Two layers: (1) the pure `buildPairedReturnNetwork` against a hand-built supply network
 * (offset geometry, re-tap branches, flow/classification invariants, the 2-arm split), and
 * (2) an end-to-end `designHeating` check that supply & return no longer overlap (the bug
 * Slice 3B fixes: previously the independent return spine landed on the supply geometry).
 */

import type { Entity } from '../../../../types/entities';
import { recognizeScene } from '../../../recognition/recognition-engine';
import { heatingTerminalRecognizer } from '../../../recognition/recognizers/heating-terminal-recognizer';
import { HEATING_DISCIPLINE } from '../heating-discipline';
import { designHeating } from '../design-heating';
import { buildPairedReturnNetwork } from '../pair-supply-return';
import type { HeatingEndpoint } from '../heating-source-resolve';
import type {
  ProposedHeatingNetwork,
  ProposedHeatingSegment,
  TerminalHeatDemand,
} from '../heating-design-types';

// ─── Builders ───────────────────────────────────────────────────────────────

function trunk(sx: number, sy: number, ex: number, ey: number, dn: number, flow: number): ProposedHeatingSegment {
  return {
    start: { x: sx, y: sy },
    end: { x: ex, y: ey },
    networkRole: 'supply',
    classification: 'hydronic-supply',
    diameterMm: dn,
    cumulativeFlowLps: flow,
    role: 'trunk',
  };
}

function demand(id: string, rx: number, ry: number, flow: number): TerminalHeatDemand {
  return {
    terminalId: id,
    entityId: id,
    terminalKind: 'panel-radiator',
    thermalOutputW: 2000,
    flowLps: flow,
    supplyConnectorId: 'rad-supply',
    supplyPoint: { x: rx, y: ry },
    returnConnectorId: 'rad-return',
    returnPoint: { x: rx, y: ry },
  };
}

const RETURN_SINK: HeatingEndpoint = {
  role: 'return',
  entityId: 'b',
  connectorId: 'boiler-return',
  classification: 'hydronic-return',
  point: { x: 0, y: 0 },
  elevationMm: 1500,
};

/** Single right-arm supply: boiler(0,0) → r1(1500,800) → r2(3000,800). */
function singleArmSupply(): ProposedHeatingNetwork {
  return {
    role: 'supply',
    classification: 'hydronic-supply',
    sourceEntityId: 'b',
    sourceConnectorId: 'boiler-supply',
    sourcePoint: { x: 0, y: 0 },
    sourceElevationMm: 1500,
    segments: [
      trunk(0, 0, 1500, 0, 22, 0.1),
      trunk(1500, 0, 3000, 0, 18, 0.05),
      { ...trunk(1500, 0, 1500, 800, 15, 0.05), networkRole: 'supply', role: 'branch' },
      { ...trunk(3000, 0, 3000, 800, 15, 0.05), networkRole: 'supply', role: 'branch' },
    ],
    servedTerminalIds: ['r1', 'r2'],
    servedConnectors: [
      { entityId: 'r1', connectorId: 'rad-supply' },
      { entityId: 'r2', connectorId: 'rad-supply' },
    ],
    totalFlowLps: 0.1,
  };
}

// ─── Pure pairing ─────────────────────────────────────────────────────────────

describe('ADR-429 Slice 3B — buildPairedReturnNetwork', () => {
  const demands = [demand('r1', 1500, 800, 0.05), demand('r2', 3000, 800, 0.05)];

  it('roots at the boiler return inlet and inherits its classification/elevation', () => {
    const ret = buildPairedReturnNetwork(singleArmSupply(), RETURN_SINK, demands, HEATING_DISCIPLINE);
    expect(ret.role).toBe('return');
    expect(ret.classification).toBe('hydronic-return');
    expect(ret.sourceConnectorId).toBe('boiler-return');
    expect(ret.sourceElevationMm).toBe(1500);
    expect(ret.segments.every((s) => s.classification === 'hydronic-return')).toBe(true);
    expect(ret.segments.every((s) => s.networkRole === 'return')).toBe(true);
  });

  it('runs the return trunk PARALLEL to the supply spine at a constant DN-aware offset', () => {
    const ret = buildPairedReturnNetwork(singleArmSupply(), RETURN_SINK, demands, HEATING_DISCIPLINE);
    // offset = maxTrunkDN(22) + PAIRING_CLEARANCE_SCENE(30) = 52, left of +x travel ⇒ +y.
    const horizontalTrunks = ret.segments.filter(
      (s) => s.role === 'trunk' && Math.abs(s.start.y - s.end.y) < 1e-6,
    );
    expect(horizontalTrunks.length).toBeGreaterThan(0);
    expect(horizontalTrunks.every((s) => Math.abs(s.start.y - 52) < 1e-6)).toBe(true);
    // …and never overlaps the supply spine (which sits at y=0) — the bug Slice 3B fixes.
    expect(horizontalTrunks.every((s) => Math.abs(s.start.y) > 1e-6)).toBe(true);
  });

  it('copies each return trunk run\'s flow + DN from its supply counterpart', () => {
    const ret = buildPairedReturnNetwork(singleArmSupply(), RETURN_SINK, demands, HEATING_DISCIPLINE);
    const trunks = ret.segments.filter((s) => s.role === 'trunk');
    // first offset run carries the full load (0.1, DN22), the next carries 0.05 (DN18).
    expect(trunks.some((s) => s.cumulativeFlowLps === 0.1 && s.diameterMm === 22)).toBe(true);
    expect(trunks.some((s) => s.cumulativeFlowLps === 0.05 && s.diameterMm === 18)).toBe(true);
  });

  it('bridges the boiler return to the offset spine with a stub', () => {
    const ret = buildPairedReturnNetwork(singleArmSupply(), RETURN_SINK, demands, HEATING_DISCIPLINE);
    const stub = ret.segments.find(
      (s) => Math.abs(s.start.x) < 1e-6 && Math.abs(s.start.y) < 1e-6,
    );
    expect(stub).toBeDefined();
    expect(stub!.role).toBe('trunk');
    expect(stub!.classification).toBe('hydronic-return');
    expect(stub!.end).toEqual({ x: 0, y: 52 });
  });

  it('re-taps EVERY terminal: a branch reaches each return connector point', () => {
    const ret = buildPairedReturnNetwork(singleArmSupply(), RETURN_SINK, demands, HEATING_DISCIPLINE);
    const branches = ret.segments.filter((s) => s.role === 'branch');
    for (const d of demands) {
      expect(branches.some((b) => b.end.x === d.returnPoint.x && b.end.y === d.returnPoint.y)).toBe(true);
    }
    // every branch starts on the offset spine (y=52), i.e. it is connected to the trunk.
    expect(branches.every((b) => Math.abs(b.start.y - 52) < 1e-6)).toBe(true);
  });

  it('preserves the closed-loop invariants (flow conservation, trunk ≥ branch DN)', () => {
    const ret = buildPairedReturnNetwork(singleArmSupply(), RETURN_SINK, demands, HEATING_DISCIPLINE);
    expect(ret.totalFlowLps).toBeCloseTo(0.1, 6);
    const maxCumulative = Math.max(...ret.segments.map((s) => s.cumulativeFlowLps));
    expect(maxCumulative).toBeCloseTo(ret.totalFlowLps, 6);
    const maxTrunkDN = Math.max(...ret.segments.filter((s) => s.role === 'trunk').map((s) => s.diameterMm));
    const maxBranchDN = Math.max(...ret.segments.filter((s) => s.role === 'branch').map((s) => s.diameterMm));
    expect(maxTrunkDN).toBeGreaterThanOrEqual(maxBranchDN);
    expect(ret.servedConnectors).toEqual([
      { entityId: 'r1', connectorId: 'rad-return' },
      { entityId: 'r2', connectorId: 'rad-return' },
    ]);
  });

  it('offsets a LEFT + RIGHT arm onto opposite sides of the spine (2-arm split)', () => {
    const twoArm: ProposedHeatingNetwork = {
      ...singleArmSupply(),
      segments: [
        trunk(0, 0, 1500, 0, 22, 0.05), // right arm
        trunk(0, 0, -1500, 0, 22, 0.05), // left arm
        { ...trunk(1500, 0, 1500, 800, 15, 0.05), role: 'branch' },
        { ...trunk(-1500, 0, -1500, 800, 15, 0.05), role: 'branch' },
      ],
      totalFlowLps: 0.1,
    };
    const twoArmDemands = [demand('r1', 1500, 800, 0.05), demand('r2', -1500, 800, 0.05)];
    const ret = buildPairedReturnNetwork(twoArm, RETURN_SINK, twoArmDemands, HEATING_DISCIPLINE);
    const ys = ret.segments
      .filter((s) => s.role === 'trunk' && Math.abs(s.start.y - s.end.y) < 1e-6)
      .map((s) => s.start.y);
    // right arm (travel +x) ⇒ +52 ; left arm (travel −x) ⇒ −52.
    expect(ys.some((y) => Math.abs(y - 52) < 1e-6)).toBe(true);
    expect(ys.some((y) => Math.abs(y + 52) < 1e-6)).toBe(true);
  });
});

// ─── End-to-end (the bug it fixes) ────────────────────────────────────────────

function radiator(id: string, x: number, y: number, w: number): Entity {
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
      thermalOutputW: w,
      connectors: [
        { connectorId: 'rad-supply', domain: 'pipe', flow: 'in', localPosition: { x: 0, y: 0, z: 0 }, pipe: { systemClassification: 'hydronic-supply', diameterMm: 15 } },
        { connectorId: 'rad-return', domain: 'pipe', flow: 'out', localPosition: { x: 0, y: 0, z: 0 }, pipe: { systemClassification: 'hydronic-return', diameterMm: 15 } },
      ],
    },
  } as unknown as Entity;
}

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
        { connectorId: 'boiler-supply', domain: 'pipe', flow: 'out', localPosition: { x: 0, y: 0, z: 0 }, pipe: { systemClassification: 'hydronic-supply', diameterMm: 22 } },
        { connectorId: 'boiler-return', domain: 'pipe', flow: 'in', localPosition: { x: 0, y: 0, z: 0 }, pipe: { systemClassification: 'hydronic-return', diameterMm: 22 } },
      ],
    },
  } as unknown as Entity;
}

describe('ADR-429 Slice 3B — designHeating no longer overlaps supply/return', () => {
  it('return horizontal trunks are offset off the supply spine', () => {
    const entities: Entity[] = [boiler('b', 0, 0), radiator('r1', 1500, 800, 2000), radiator('r2', 3000, 800, 1500)];
    const model = recognizeScene({ entities, storeyId: 'floor-1', sceneUnits: 'mm' }, { recognizers: [heatingTerminalRecognizer] });
    const proposal = designHeating(model, entities);

    const supply = proposal.networks.find((n) => n.role === 'supply')!;
    const ret = proposal.networks.find((n) => n.role === 'return')!;
    const horizY = (n: ProposedHeatingNetwork) =>
      new Set(
        n.segments
          .filter((s) => s.role === 'trunk' && Math.abs(s.start.y - s.end.y) < 1e-6)
          .map((s) => Math.round(s.start.y)),
      );
    const supplyYs = horizY(supply);
    const returnYs = horizY(ret);
    expect(supplyYs.size).toBeGreaterThan(0);
    expect(returnYs.size).toBeGreaterThan(0);
    // disjoint y-bands ⇒ the two spines run parallel, never on top of each other.
    for (const y of returnYs) expect(supplyYs.has(y)).toBe(false);
  });
});
