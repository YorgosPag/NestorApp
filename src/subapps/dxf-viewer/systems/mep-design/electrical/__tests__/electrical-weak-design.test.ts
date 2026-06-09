/**
 * ADR-431 Slice 1 — Electrical-WEAK (ασθενή) auto-design engine (headless).
 *
 * Unit-tests the weak stages — demand (ports), grouping (the SHARED brain: split-by-
 * service, group-by-zone, bin-pack under the port budget), sizing (90 m channel length) —
 * plus the `designElectricalWeak` orchestrator integration (comms-rack source, classification-
 * aware source selection, non-destructive skip, empty/warning cases). Confirms the shared core
 * is the same bin-packer as strong, only the descriptor differs.
 */

import {
  designElectricalWeak,
  groupIntoCircuits,
  buildWeakDemandModel,
  sizeWeakChannel,
  ISO11801_DEMAND_STANDARD,
  ISO11801_GROUPING_STANDARD,
  ISO11801_SIZING_STANDARD,
  type WeakCircuitService,
  type WeakCircuitGroup,
} from '../index';
import type { TerminalDemand } from '../circuit-grouping-core';
import { buildDefaultMepFixtureParams } from '../../../../hooks/drawing/mep-fixture-completion';
import { buildDefaultElectricalPanelParams } from '../../../../hooks/drawing/electrical-panel-completion';
import { electricalTerminalRecognizer } from '../../../recognition/recognizers/electrical-terminal-recognizer';
import type { Entity } from '../../../../types/entities';
import type { MepFixtureEntity } from '../../../../bim/types/mep-fixture-types';
import type { MepSystemEntity } from '../../../../bim/types/mep-system-types';
import type { RecognitionModel } from '../../../recognition/recognition-types';

let counter = 0;
function demand(service: WeakCircuitService, x: number, y: number, spaceId?: string): TerminalDemand<WeakCircuitService> {
  const n = counter++;
  return {
    terminalId: `t${n}`,
    entityId: `e${n}`,
    connectorId: 'c1',
    terminalKind: 'data-outlet',
    service,
    load: 1,
    point: { x, y },
    ...(spaceId ? { spaceId } : {}),
  };
}

function dataOutlet(id: string, x: number, y: number): MepFixtureEntity {
  const params = buildDefaultMepFixtureParams({ x, y }, { kind: 'data-outlet' });
  return { id, type: 'mep-fixture', layerId: 'electrical', params } as MepFixtureEntity;
}

function commsRack(id: string, x: number, y: number): Entity {
  const params = buildDefaultElectricalPanelParams({ x, y }, { kind: 'comms-rack' });
  return { id, type: 'electrical-panel', layerId: 'electrical', params } as unknown as Entity;
}

function powerPanel(id: string, x: number, y: number): Entity {
  const params = buildDefaultElectricalPanelParams({ x, y }, { kind: 'distribution-board' });
  return { id, type: 'electrical-panel', layerId: 'electrical', params } as unknown as Entity;
}

function model(entities: readonly Entity[], storeyId = 'floor-1'): RecognitionModel {
  const elements = electricalTerminalRecognizer.recognize({ entities, storeyId, sceneUnits: 'mm', spaces: [] });
  return { spaces: [], elements, storeyId };
}

beforeEach(() => {
  counter = 0;
});

describe('buildWeakDemandModel', () => {
  it('assigns 1 port per data outlet, derives the data service from the connector', () => {
    const m = model([dataOutlet('do1', 0, 0), dataOutlet('do2', 1, 0)]);
    const demands = buildWeakDemandModel(m, ISO11801_DEMAND_STANDARD).demands;
    expect(demands).toHaveLength(2);
    expect(demands[0].service).toBe('data');
    expect(demands[0].load).toBe(1);
  });

  it('skips power/lighting terminals (strong current)', () => {
    const m = model([
      { id: 'lf', type: 'mep-fixture', layerId: 'l', params: buildDefaultMepFixtureParams({ x: 0, y: 0 }, { kind: 'light-fixture' }) } as MepFixtureEntity,
    ]);
    expect(buildWeakDemandModel(m, ISO11801_DEMAND_STANDARD).demands).toHaveLength(0);
  });
});

describe('groupIntoCircuits (shared brain, weak rules)', () => {
  it('bin-packs at the 24-port budget (25 outlets → 24 + 1)', () => {
    const demands = Array.from({ length: 25 }, (_, i) => demand('data', i, 0));
    const groups = groupIntoCircuits(demands, ISO11801_GROUPING_STANDARD);
    expect(groups.map((g) => g.members.length)).toEqual([24, 1]);
  });

  it('keeps data and controls on separate channels', () => {
    const groups = groupIntoCircuits([demand('data', 0, 0), demand('controls', 1, 0)], ISO11801_GROUPING_STANDARD);
    expect(groups).toHaveLength(2);
    expect(new Set(groups.map((g) => g.service))).toEqual(new Set(['data', 'controls']));
  });
});

describe('sizeWeakChannel', () => {
  function group(points: { x: number; y: number }[]): WeakCircuitGroup {
    return {
      service: 'data',
      rule: ISO11801_GROUPING_STANDARD.rules.data,
      members: points.map((_, i) => ({ entityId: `e${i}`, connectorId: 'c1' })),
      points,
      connectedLoad: points.length,
    };
  }

  it('flags a channel longer than the 90 m permanent link', () => {
    const sizing = sizeWeakChannel(group([{ x: 100000, y: 0 }]), { x: 0, y: 0 }, 0.001, ISO11801_SIZING_STANDARD);
    expect(sizing.cableType).toBe('Cat6');
    expect(sizing.channelLengthM).toBeCloseTo(100, 4);
    expect(sizing.channelLengthExceeded).toBe(true);
  });

  it('passes a short channel', () => {
    const sizing = sizeWeakChannel(group([{ x: 30000, y: 0 }]), { x: 0, y: 0 }, 0.001, ISO11801_SIZING_STANDARD);
    expect(sizing.channelLengthExceeded).toBe(false);
  });
});

describe('designElectricalWeak', () => {
  it('produces a data channel from a comms-rack + data outlets', () => {
    const entities = [commsRack('r1', 0, 0), dataOutlet('do1', 1000, 0), dataOutlet('do2', 2000, 0)];
    const proposal = designElectricalWeak(model(entities), entities, [], 'mm');
    expect(proposal.channels).toHaveLength(1);
    expect(proposal.channels[0].classification).toBe('data');
    expect(proposal.channels[0].members).toHaveLength(2);
    expect(proposal.channels[0].sourceEntityId).toBe('r1');
  });

  it('warns + emits nothing when only a power panel is present (no comms-rack)', () => {
    const entities = [powerPanel('p1', 0, 0), dataOutlet('do1', 1000, 0)];
    const proposal = designElectricalWeak(model(entities), entities, [], 'mm');
    expect(proposal.channels).toHaveLength(0);
    expect(proposal.warnings[0]).toContain('comms-rack');
  });

  it('skips outlets already wired to a weak channel (non-destructive)', () => {
    const entities = [commsRack('r1', 0, 0), dataOutlet('do1', 1000, 0), dataOutlet('do2', 2000, 0)];
    const existing: MepSystemEntity[] = [
      {
        id: 'sys1',
        params: {
          systemType: 'electrical-circuit',
          systemClassification: 'data',
          name: 'Manual',
          sourceEntityId: 'r1',
          sourceConnectorId: 'c1',
          members: [{ entityId: 'do1', connectorId: 'c1' }],
        },
      },
    ];
    const proposal = designElectricalWeak(model(entities), entities, existing, 'mm');
    expect(proposal.skippedAlreadyCircuited).toBe(1);
    expect(proposal.channels).toHaveLength(1);
    expect(proposal.channels[0].members).toEqual([{ entityId: 'do2', connectorId: 'c1' }]);
  });
});
