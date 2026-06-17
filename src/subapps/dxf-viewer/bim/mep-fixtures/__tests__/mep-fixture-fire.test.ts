/**
 * ADR-433 Slice 0b — Fire-protection fixture kinds (sprinkler + fire riser) + recognizer.
 *
 * Both fire components ride the lightweight `mep-fixture` rails (mirror air-terminal/AHU):
 * a sprinkler head is a fire-sprinkler pipe-INLET terminal, the fire riser a fire-sprinkler
 * pipe-OUTLET source. The recognizer distinguishes them by flow direction, so the riser is
 * never mistaken for a terminal. Unlike the HVAC duct, the fire pipe carries the
 * `fire-sprinkler` classification on the connector itself.
 */

import {
  SPRINKLER_KIND,
  SPRINKLER_TOOL_ID,
  isSprinklerKind,
  sprinklerFixtureToolKind,
  sprinklerDrawer,
} from '../sprinkler-symbol-spec';
import {
  FIRE_RISER_KIND,
  FIRE_RISER_TOOL_ID,
  isFireRiserKind,
  fireRiserFixtureToolKind,
  fireRiserDrawer,
} from '../fire-riser-symbol-spec';
import {
  resolveFixtureIfcType,
  resolveFixtureBimCategory,
} from '../../types/mep-fixture-types';
import {
  buildDefaultMepFixtureParams,
  buildMepFixtureEntity,
} from '../../../hooks/drawing/mep-fixture-completion';
import { sprinklerRecognizer } from '../../../systems/recognition/recognizers/sprinkler-recognizer';
import type { RecognitionContext } from '../../../systems/recognition/recognition-types';
import type { Entity } from '../../../types/entities';

describe('sprinkler + fire-riser kind guards & tool mapping', () => {
  it('guards narrow only their own kind', () => {
    expect(isSprinklerKind(SPRINKLER_KIND)).toBe(true);
    expect(isSprinklerKind('fire-riser')).toBe(false);
    expect(isFireRiserKind(FIRE_RISER_KIND)).toBe(true);
    expect(isFireRiserKind('sprinkler')).toBe(false);
  });

  it('maps tool ids ↔ kinds and rejects other tools', () => {
    expect(SPRINKLER_TOOL_ID).toBe('mep-sprinkler');
    expect(FIRE_RISER_TOOL_ID).toBe('mep-fire-riser');
    expect(sprinklerFixtureToolKind('mep-sprinkler')).toBe('sprinkler');
    expect(fireRiserFixtureToolKind('mep-fire-riser')).toBe('fire-riser');
    for (const id of ['mep-fixture', 'mep-air-terminal', 'wall']) {
      expect(sprinklerFixtureToolKind(id)).toBeNull();
      expect(fireRiserFixtureToolKind(id)).toBeNull();
    }
  });

  it('draws distinct glyphs (rotation/scale-aware strokes)', () => {
    const fp = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 1, y: 1, z: 0 },
      { x: 0, y: 1, z: 0 },
    ];
    expect(sprinklerDrawer(fp).length).toBeGreaterThan(0);
    expect(fireRiserDrawer(fp).length).toBeGreaterThan(0);
  });

  it('resolves fire IFC class + the shared pipe V/G category', () => {
    expect(resolveFixtureIfcType('sprinkler')).toBe('IfcFireSuppressionTerminal');
    expect(resolveFixtureIfcType('fire-riser')).toBe('IfcFlowController');
    const skParams = buildDefaultMepFixtureParams({ x: 0, y: 0 }, { kind: 'sprinkler' });
    const frParams = buildDefaultMepFixtureParams({ x: 0, y: 0 }, { kind: 'fire-riser' });
    expect(resolveFixtureBimCategory(skParams)).toBe('pipe');
    expect(resolveFixtureBimCategory(frParams)).toBe('pipe');
  });
});

describe('placement seeds the correct fire-sprinkler connector', () => {
  it('sprinkler → fire-sprinkler pipe INLET; riser → fire-sprinkler pipe OUTLET', () => {
    const sk = buildDefaultMepFixtureParams({ x: 0, y: 0 }, { kind: 'sprinkler' });
    const skPipe = sk.connectors?.find((c) => c.domain === 'pipe');
    expect(skPipe?.flow).toBe('in');
    expect(skPipe?.pipe?.systemClassification).toBe('fire-sprinkler');

    const fr = buildDefaultMepFixtureParams({ x: 0, y: 0 }, { kind: 'fire-riser' });
    const frPipe = fr.connectors?.find((c) => c.domain === 'pipe');
    expect(frPipe?.flow).toBe('out');
    expect(frPipe?.pipe?.systemClassification).toBe('fire-sprinkler');
  });

  it('builds valid entities for both kinds', () => {
    for (const kind of ['sprinkler', 'fire-riser'] as const) {
      const params = buildDefaultMepFixtureParams({ x: 1000, y: 2000 }, { kind });
      const res = buildMepFixtureEntity(params, '0');
      expect(res.ok).toBe(true);
    }
  });
});

describe('sprinklerRecognizer (flow-aware: terminal yes, riser no)', () => {
  function fixtureEntity(kind: 'sprinkler' | 'fire-riser', id: string): Entity {
    const params = buildDefaultMepFixtureParams({ x: 0, y: 0 }, { kind });
    const res = buildMepFixtureEntity(params, '0');
    if (!res.ok) throw new Error('fixture build failed');
    return { ...res.entity, id } as Entity;
  }

  it('recognizes a sprinkler head but NOT the fire-riser source', () => {
    const ctx: RecognitionContext = {
      entities: [fixtureEntity('sprinkler', 'sk-1'), fixtureEntity('fire-riser', 'fr-1')],
      storeyId: 'storey-1',
      sceneUnits: 'mm',
      spaces: [],
    };
    const terminals = sprinklerRecognizer.recognize(ctx);
    expect(terminals).toHaveLength(1);
    expect(terminals[0]!.elementId).toBe('term:sk-1');
    expect(terminals[0]!.serviceClassifications).toContain('fire-sprinkler');
  });
});
