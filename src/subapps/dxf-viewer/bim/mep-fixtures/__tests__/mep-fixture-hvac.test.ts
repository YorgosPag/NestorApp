/**
 * ADR-432 Slice 0b — HVAC fixture kinds (air terminal + AHU) + air-terminal recognizer.
 *
 * Both HVAC components ride the lightweight `mep-fixture` rails (mirror socket/data-outlet):
 * a supply diffuser is a duct-INLET terminal, the AHU a duct-OUTLET source. The recognizer
 * distinguishes them by flow direction, so the AHU is never mistaken for a terminal.
 */

import {
  AIR_TERMINAL_KIND,
  AIR_TERMINAL_TOOL_ID,
  isAirTerminalKind,
  airTerminalFixtureToolKind,
  airTerminalDrawer,
} from '../air-terminal-symbol-spec';
import {
  AHU_KIND,
  AHU_TOOL_ID,
  isAhuKind,
  ahuFixtureToolKind,
  ahuDrawer,
} from '../ahu-symbol-spec';
import {
  resolveFixtureIfcType,
  resolveFixtureBimCategory,
} from '../../types/mep-fixture-types';
import {
  buildDefaultMepFixtureParams,
  buildMepFixtureEntity,
} from '../../../hooks/drawing/mep-fixture-completion';
import { airTerminalRecognizer } from '../../../systems/recognition/recognizers/air-terminal-recognizer';
import type { RecognitionContext } from '../../../systems/recognition/recognition-types';
import type { Entity } from '../../../types/entities';

describe('air-terminal + AHU kind guards & tool mapping', () => {
  it('guards narrow only their own kind', () => {
    expect(isAirTerminalKind(AIR_TERMINAL_KIND)).toBe(true);
    expect(isAirTerminalKind('ahu')).toBe(false);
    expect(isAhuKind(AHU_KIND)).toBe(true);
    expect(isAhuKind('air-terminal')).toBe(false);
  });

  it('maps tool ids ↔ kinds and rejects other tools', () => {
    expect(AIR_TERMINAL_TOOL_ID).toBe('mep-air-terminal');
    expect(AHU_TOOL_ID).toBe('mep-ahu');
    expect(airTerminalFixtureToolKind('mep-air-terminal')).toBe('air-terminal');
    expect(ahuFixtureToolKind('mep-ahu')).toBe('ahu');
    for (const id of ['mep-fixture', 'mep-socket', 'wall']) {
      expect(airTerminalFixtureToolKind(id)).toBeNull();
      expect(ahuFixtureToolKind(id)).toBeNull();
    }
  });

  it('draws distinct glyphs (rotation/scale-aware strokes)', () => {
    const fp = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 1, y: 1, z: 0 },
      { x: 0, y: 1, z: 0 },
    ];
    expect(airTerminalDrawer(fp).length).toBeGreaterThan(0);
    expect(ahuDrawer(fp).length).toBeGreaterThan(0);
  });

  it('resolves HVAC IFC class + the shared duct V/G category', () => {
    expect(resolveFixtureIfcType('air-terminal')).toBe('IfcAirTerminal');
    expect(resolveFixtureIfcType('ahu')).toBe('IfcUnitaryEquipment');
    const atParams = buildDefaultMepFixtureParams({ x: 0, y: 0 }, { kind: 'air-terminal' });
    const ahuParams = buildDefaultMepFixtureParams({ x: 0, y: 0 }, { kind: 'ahu' });
    expect(resolveFixtureBimCategory(atParams)).toBe('duct');
    expect(resolveFixtureBimCategory(ahuParams)).toBe('duct');
  });
});

describe('placement seeds the correct duct connector', () => {
  it('air terminal → supply-air duct INLET; AHU → supply-air duct OUTLET', () => {
    const at = buildDefaultMepFixtureParams({ x: 0, y: 0 }, { kind: 'air-terminal' });
    const atDuct = at.connectors?.find((c) => c.domain === 'duct');
    expect(atDuct?.flow).toBe('in');
    expect(atDuct?.duct?.systemClassification).toBe('supply-air');

    const ahu = buildDefaultMepFixtureParams({ x: 0, y: 0 }, { kind: 'ahu' });
    const ahuDuct = ahu.connectors?.find((c) => c.domain === 'duct');
    expect(ahuDuct?.flow).toBe('out');
    expect(ahuDuct?.duct?.systemClassification).toBe('supply-air');
  });

  it('builds valid entities for both kinds', () => {
    for (const kind of ['air-terminal', 'ahu'] as const) {
      const params = buildDefaultMepFixtureParams({ x: 1000, y: 2000 }, { kind });
      const res = buildMepFixtureEntity(params, '0');
      expect(res.ok).toBe(true);
    }
  });
});

describe('airTerminalRecognizer (flow-aware: terminal yes, AHU no)', () => {
  function fixtureEntity(kind: 'air-terminal' | 'ahu', id: string): Entity {
    const params = buildDefaultMepFixtureParams({ x: 0, y: 0 }, { kind });
    const res = buildMepFixtureEntity(params, '0');
    if (!res.ok) throw new Error('fixture build failed');
    return { ...res.entity, id } as Entity;
  }

  it('recognizes a supply diffuser but NOT the AHU source', () => {
    const ctx: RecognitionContext = {
      entities: [fixtureEntity('air-terminal', 'at-1'), fixtureEntity('ahu', 'ahu-1')],
      storeyId: 'storey-1',
      sceneUnits: 'mm',
      spaces: [],
    };
    const terminals = airTerminalRecognizer.recognize(ctx);
    expect(terminals).toHaveLength(1);
    expect(terminals[0]!.elementId).toBe('term:at-1');
    expect(terminals[0]!.serviceClassifications).toContain('supply-air');
  });
});
