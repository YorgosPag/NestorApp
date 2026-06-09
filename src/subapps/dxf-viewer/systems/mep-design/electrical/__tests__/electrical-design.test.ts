/**
 * ADR-430 Slice 1 — Electrical-strong auto-design engine (headless).
 *
 * Unit-tests the four stages — demand (VA), grouping (the brain: split-by-service,
 * group-by-zone, bin-pack), phase balance (LPT), sizing (conductor/breaker + voltage drop) —
 * plus the `designElectricalStrong` orchestrator integration (panel source, non-destructive
 * skip of already-circuited terminals, empty/warning cases).
 */

import {
  designElectricalStrong,
  groupIntoCircuits,
  balancePhases,
  sizeCircuit,
  daisyChainLengthM,
  buildElectricalDemandModel,
  HD384_DEMAND_STANDARD,
  HD384_GROUPING_STANDARD,
  HD384_SIZING_STANDARD,
  type TerminalElectricalDemand,
  type ElectricalCircuitService,
} from '../index';
import type { ElectricalCircuitGroup } from '../electrical-circuit-grouping';
import { buildDefaultMepFixtureParams } from '../../../../hooks/drawing/mep-fixture-completion';
import { buildDefaultPanelOutgoingConnector } from '../../../../bim/types/mep-connector-types';
import { electricalTerminalRecognizer } from '../../../recognition/recognizers/electrical-terminal-recognizer';
import type { Entity } from '../../../../types/entities';
import type { MepFixtureEntity } from '../../../../bim/types/mep-fixture-types';
import type { MepSystemEntity } from '../../../../bim/types/mep-system-types';
import type { RecognitionModel } from '../../../recognition/recognition-types';

// ─── Builders ───────────────────────────────────────────────────────────────

let counter = 0;
function demand(
  service: ElectricalCircuitService,
  loadVa: number,
  x: number,
  y: number,
  spaceId?: string,
): TerminalElectricalDemand {
  const n = counter++;
  return {
    terminalId: `t${n}`,
    entityId: `e${n}`,
    connectorId: 'c1',
    terminalKind: service === 'lighting' ? 'light-fixture' : 'socket',
    service,
    load: loadVa,
    point: { x, y },
    ...(spaceId ? { spaceId } : {}),
  };
}

function fixture(id: string, kind: 'light-fixture' | 'socket', x: number, y: number): MepFixtureEntity {
  const params = buildDefaultMepFixtureParams({ x, y }, { kind });
  return { id, type: 'mep-fixture', layerId: 'electrical', params } as MepFixtureEntity;
}

function panel(id: string, x: number, y: number): Entity {
  return {
    id,
    type: 'electrical-panel',
    layerId: 'electrical',
    params: { position: { x, y, z: 0 }, rotation: 0, connectors: [buildDefaultPanelOutgoingConnector()] },
  } as unknown as Entity;
}

/** Assemble a RecognitionModel from scene entities via the electrical recognizer. */
function model(entities: readonly Entity[], storeyId = 'floor-1'): RecognitionModel {
  const elements = electricalTerminalRecognizer.recognize({
    entities,
    storeyId,
    sceneUnits: 'mm',
    spaces: [],
  });
  return { spaces: [], elements, storeyId };
}

beforeEach(() => {
  counter = 0;
});

// ─── Stage 1 — Demand ─────────────────────────────────────────────────────────

describe('buildElectricalDemandModel', () => {
  it('assigns lighting 100 VA, socket 200 VA, derives service from the connector', () => {
    const m = model([fixture('lf', 'light-fixture', 0, 0), fixture('sk', 'socket', 1, 0)]);
    const demands = buildElectricalDemandModel(m, HD384_DEMAND_STANDARD).demands;
    const byKind = new Map(demands.map((d) => [d.terminalKind, d]));
    expect(byKind.get('light-fixture')!.service).toBe('lighting');
    expect(byKind.get('light-fixture')!.load).toBe(100);
    expect(byKind.get('socket')!.service).toBe('power');
    expect(byKind.get('socket')!.load).toBe(200);
  });
});

// ─── Stage 2 — Grouping (the brain) ───────────────────────────────────────────

describe('groupIntoCircuits', () => {
  it('NEVER mixes lighting and sockets in one circuit', () => {
    const groups = groupIntoCircuits(
      [demand('lighting', 100, 0, 0), demand('power', 200, 1, 0)],
      HD384_GROUPING_STANDARD,
    );
    expect(groups).toHaveLength(2);
    expect(new Set(groups.map((g) => g.service))).toEqual(new Set(['lighting', 'power']));
  });

  it('splits a lighting bucket at the 12-point cap (13 points → 12 + 1)', () => {
    const demands = Array.from({ length: 13 }, (_, i) => demand('lighting', 100, i, 0));
    const groups = groupIntoCircuits(demands, HD384_GROUPING_STANDARD);
    expect(groups).toHaveLength(2);
    expect(groups[0].memberCount ?? groups[0].members.length).toBe(12);
    expect(groups[1].members.length).toBe(1);
  });

  it('splits a socket bucket at the 8-point cap (9 points → 8 + 1)', () => {
    const demands = Array.from({ length: 9 }, (_, i) => demand('power', 200, i, 0));
    const groups = groupIntoCircuits(demands, HD384_GROUPING_STANDARD);
    expect(groups.map((g) => g.members.length)).toEqual([8, 1]);
  });

  it('splits on the breaker-load cap before the point cap (high-VA loads)', () => {
    // 5 × 500 VA lighting: maxLoadVa 1840 → 3 fit (1500), 4th (2000) opens a new circuit.
    const demands = Array.from({ length: 5 }, (_, i) => demand('lighting', 500, i, 0));
    const groups = groupIntoCircuits(demands, HD384_GROUPING_STANDARD);
    expect(groups.map((g) => g.members.length)).toEqual([3, 2]);
    expect(groups[0].connectedLoad).toBe(1500);
  });

  it('keeps circuits within one zone (same service, two zones → two circuits)', () => {
    const groups = groupIntoCircuits(
      [demand('lighting', 100, 0, 0, 'zoneA'), demand('lighting', 100, 9, 0, 'zoneB')],
      HD384_GROUPING_STANDARD,
    );
    expect(groups).toHaveLength(2);
    expect(groups[0].spaceId).toBe('zoneA');
    expect(groups[1].spaceId).toBe('zoneB');
  });
});

// ─── Phase balance ────────────────────────────────────────────────────────────

describe('balancePhases', () => {
  function group(loadVa: number): ElectricalCircuitGroup {
    return {
      service: 'lighting',
      rule: HD384_GROUPING_STANDARD.rules.lighting,
      members: [],
      points: [],
      connectedLoad: loadVa,
    };
  }

  it('spreads three equal circuits across L1/L2/L3', () => {
    const phases = balancePhases([group(100), group(100), group(100)], HD384_GROUPING_STANDARD.phases);
    expect(new Set(phases)).toEqual(new Set(['L1', 'L2', 'L3']));
  });

  it('puts the 4th (smallest) circuit on the least-loaded phase', () => {
    // loads 300/200/100/50 → L1=300, L2=200, L3=100, then 50 → L3 (now lightest).
    const phases = balancePhases(
      [group(300), group(200), group(100), group(50)],
      HD384_GROUPING_STANDARD.phases,
    );
    expect(phases[0]).toBe('L1');
    expect(phases[3]).toBe('L3');
  });
});

// ─── Stage 3 — Sizing ─────────────────────────────────────────────────────────

describe('daisyChainLengthM', () => {
  it('greedy nearest-neighbour chain length, scene→meters', () => {
    // source (0,0) → (1000,0) → (2000,0); sceneToM = 0.001 → 2 m.
    const len = daisyChainLengthM({ x: 0, y: 0 }, [{ x: 2000, y: 0 }, { x: 1000, y: 0 }], 0.001);
    expect(len).toBeCloseTo(2, 6);
  });
});

describe('sizeCircuit', () => {
  function group(service: ElectricalCircuitService, loadVa: number, points: { x: number; y: number }[]): ElectricalCircuitGroup {
    return {
      service,
      rule: HD384_GROUPING_STANDARD.rules[service],
      members: points.map((_, i) => ({ entityId: `e${i}`, connectorId: 'c1' })),
      points,
      connectedLoad: loadVa,
    };
  }

  it('uses the rule breaker/conductor; short run → drop within limit', () => {
    const sizing = sizeCircuit(
      group('lighting', 800, [{ x: 1000, y: 0 }]),
      { x: 0, y: 0 },
      0.001,
      230,
      HD384_SIZING_STANDARD,
    );
    expect(sizing.breakerAmp).toBe(10);
    expect(sizing.conductorMm2).toBe(1.5);
    expect(sizing.voltageDropExceeded).toBe(false);
  });

  it('flags an excessive voltage drop on a long, heavily-loaded run', () => {
    // 1800 VA over ~200 m on 1.5mm² → well past the 3% lighting limit.
    const sizing = sizeCircuit(
      group('lighting', 1800, [{ x: 200000, y: 0 }]),
      { x: 0, y: 0 },
      0.001,
      230,
      HD384_SIZING_STANDARD,
    );
    expect(sizing.voltageDropExceeded).toBe(true);
    expect(sizing.voltageDropPercent).toBeGreaterThan(3);
  });
});

// ─── Orchestrator integration ─────────────────────────────────────────────────

describe('designElectricalStrong', () => {
  it('produces separate lighting + socket circuits from a panel + mixed loads', () => {
    const entities = [
      panel('p1', 0, 0),
      fixture('lf1', 'light-fixture', 1000, 0),
      fixture('lf2', 'light-fixture', 2000, 0),
      fixture('sk1', 'socket', 1000, 1000),
    ];
    const proposal = designElectricalStrong(model(entities), entities, [], 'mm');
    expect(proposal.circuits).toHaveLength(2);
    const lighting = proposal.circuits.find((c) => c.service === 'lighting')!;
    const power = proposal.circuits.find((c) => c.service === 'power')!;
    expect(lighting.members).toHaveLength(2);
    expect(lighting.classification).toBe('lighting');
    expect(lighting.sourceEntityId).toBe('p1');
    expect(power.members).toHaveLength(1);
    expect(power.classification).toBe('power');
  });

  it('warns + emits nothing when no panel is present', () => {
    const entities = [fixture('lf1', 'light-fixture', 0, 0)];
    const proposal = designElectricalStrong(model(entities), entities, [], 'mm');
    expect(proposal.circuits).toHaveLength(0);
    expect(proposal.warnings[0]).toContain('no electrical panel');
  });

  it('skips terminals already wired to a circuit (non-destructive)', () => {
    const entities = [
      panel('p1', 0, 0),
      fixture('lf1', 'light-fixture', 1000, 0),
      fixture('lf2', 'light-fixture', 2000, 0),
    ];
    const existing: MepSystemEntity[] = [
      {
        id: 'sys1',
        params: {
          systemType: 'electrical-circuit',
          systemClassification: 'lighting',
          name: 'Manual',
          sourceEntityId: 'p1',
          sourceConnectorId: 'c1',
          members: [{ entityId: 'lf1', connectorId: 'c1' }],
        },
      },
    ];
    const proposal = designElectricalStrong(model(entities), entities, existing, 'mm');
    expect(proposal.skippedAlreadyCircuited).toBe(1);
    // only lf2 remains → one circuit with one member.
    expect(proposal.circuits).toHaveLength(1);
    expect(proposal.circuits[0].members).toEqual([{ entityId: 'lf2', connectorId: 'c1' }]);
  });
});
