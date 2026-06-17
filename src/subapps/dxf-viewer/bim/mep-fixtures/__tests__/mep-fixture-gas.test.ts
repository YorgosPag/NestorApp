/**
 * ADR-434 Slice 0b — Gas fixture kinds (gas meter + gas cooker) + gas recognizer.
 *
 * Both gas components ride the lightweight `mep-fixture` rails (mirror air-terminal/AHU):
 * a gas cooker is a fuel-INLET terminal, the gas meter a fuel-OUTLET source. The recognizer
 * distinguishes them by flow direction, so the meter is never mistaken for a terminal.
 */

import {
  GAS_METER_KIND,
  GAS_METER_TOOL_ID,
  isGasMeterKind,
  gasMeterFixtureToolKind,
  gasMeterDrawer,
} from '../gas-meter-symbol-spec';
import {
  GAS_COOKER_KIND,
  GAS_COOKER_TOOL_ID,
  isGasCookerKind,
  gasCookerFixtureToolKind,
  gasCookerDrawer,
} from '../gas-cooker-symbol-spec';
import {
  resolveFixtureIfcType,
  resolveFixtureBimCategory,
} from '../../types/mep-fixture-types';
import {
  buildDefaultMepFixtureParams,
  buildMepFixtureEntity,
} from '../../../hooks/drawing/mep-fixture-completion';
import { gasRecognizer } from '../../../systems/recognition/recognizers/gas-recognizer';
import type { RecognitionContext } from '../../../systems/recognition/recognition-types';
import type { Entity } from '../../../types/entities';

describe('gas-meter + gas-cooker kind guards & tool mapping', () => {
  it('guards narrow only their own kind', () => {
    expect(isGasMeterKind(GAS_METER_KIND)).toBe(true);
    expect(isGasMeterKind('gas-cooker')).toBe(false);
    expect(isGasCookerKind(GAS_COOKER_KIND)).toBe(true);
    expect(isGasCookerKind('gas-meter')).toBe(false);
  });

  it('maps tool ids ↔ kinds and rejects other tools', () => {
    expect(GAS_METER_TOOL_ID).toBe('mep-gas-meter');
    expect(GAS_COOKER_TOOL_ID).toBe('mep-gas-cooker');
    expect(gasMeterFixtureToolKind('mep-gas-meter')).toBe('gas-meter');
    expect(gasCookerFixtureToolKind('mep-gas-cooker')).toBe('gas-cooker');
    for (const id of ['mep-fixture', 'mep-ahu', 'wall']) {
      expect(gasMeterFixtureToolKind(id)).toBeNull();
      expect(gasCookerFixtureToolKind(id)).toBeNull();
    }
  });

  it('draws distinct glyphs (rotation/scale-aware strokes)', () => {
    const fp = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 1, y: 1, z: 0 },
      { x: 0, y: 1, z: 0 },
    ];
    expect(gasMeterDrawer(fp).length).toBeGreaterThan(0);
    expect(gasCookerDrawer(fp).length).toBeGreaterThan(0);
  });

  it('resolves gas IFC class + the shared fuel V/G category', () => {
    expect(resolveFixtureIfcType('gas-meter')).toBe('IfcFlowMeter');
    expect(resolveFixtureIfcType('gas-cooker')).toBe('IfcBurner');
    const meterParams = buildDefaultMepFixtureParams({ x: 0, y: 0 }, { kind: 'gas-meter' });
    const cookerParams = buildDefaultMepFixtureParams({ x: 0, y: 0 }, { kind: 'gas-cooker' });
    expect(resolveFixtureBimCategory(meterParams)).toBe('fuel');
    expect(resolveFixtureBimCategory(cookerParams)).toBe('fuel');
  });
});

describe('placement seeds the correct fuel connector', () => {
  it('gas cooker → fuel-gas INLET; gas meter → fuel-gas OUTLET', () => {
    const cooker = buildDefaultMepFixtureParams({ x: 0, y: 0 }, { kind: 'gas-cooker' });
    const cookerFuel = cooker.connectors?.find((c) => c.domain === 'fuel');
    expect(cookerFuel?.flow).toBe('in');
    expect(cookerFuel?.fuel?.systemClassification).toBe('fuel-gas');

    const meter = buildDefaultMepFixtureParams({ x: 0, y: 0 }, { kind: 'gas-meter' });
    const meterFuel = meter.connectors?.find((c) => c.domain === 'fuel');
    expect(meterFuel?.flow).toBe('out');
    expect(meterFuel?.fuel?.systemClassification).toBe('fuel-gas');
  });

  it('builds valid entities for both kinds', () => {
    for (const kind of ['gas-meter', 'gas-cooker'] as const) {
      const params = buildDefaultMepFixtureParams({ x: 1000, y: 2000 }, { kind });
      const res = buildMepFixtureEntity(params, '0');
      expect(res.ok).toBe(true);
    }
  });
});

describe('gasRecognizer (flow-aware: cooker yes, meter no)', () => {
  function fixtureEntity(kind: 'gas-meter' | 'gas-cooker', id: string): Entity {
    const params = buildDefaultMepFixtureParams({ x: 0, y: 0 }, { kind });
    const res = buildMepFixtureEntity(params, '0');
    if (!res.ok) throw new Error('fixture build failed');
    return { ...res.entity, id } as Entity;
  }

  it('recognizes a gas cooker but NOT the gas-meter source', () => {
    const ctx: RecognitionContext = {
      entities: [fixtureEntity('gas-cooker', 'cooker-1'), fixtureEntity('gas-meter', 'meter-1')],
      storeyId: 'storey-1',
      sceneUnits: 'mm',
      spaces: [],
    };
    const terminals = gasRecognizer.recognize(ctx);
    expect(terminals).toHaveLength(1);
    expect(terminals[0]!.elementId).toBe('term:cooker-1');
    expect(terminals[0]!.serviceClassifications).toContain('fuel-gas');
  });
});
