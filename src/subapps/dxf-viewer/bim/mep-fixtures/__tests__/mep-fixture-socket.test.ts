/**
 * ADR-430 Slice 0 — connectable electrical socket (πρίζα / power outlet).
 *
 * Verifies the SSoT wiring that turns the socket into a connectable `mep-fixture`
 * kind: the kind guard, IFC/category resolvers, the `'power'` connector builder,
 * kind-aware default params (wall-mount footprint + power-in connector), the 2D
 * socket glyph, the tool-id mapping, the Zod round-trip, AND the electrical-strong
 * terminal recognizer (luminaire + socket → recognized terminals). Regression checks
 * keep the light-fixture / sanitary kinds unchanged.
 */

import {
  resolveFixtureBimCategory,
  resolveFixtureIfcType,
  type MepFixtureEntity,
  type MepFixtureParams,
} from '../../types/mep-fixture-types';
import {
  SOCKET_KIND,
  SOCKET_TOOL_ID,
  DEFAULT_SOCKET_SIZE_MM,
  SOCKET_MOUNTING_ELEVATION_MM,
  isSocketKind,
  socketFixtureToolKind,
  socketDrawer,
} from '../socket-symbol-spec';
import {
  buildDefaultPowerConnector,
  FIXTURE_POWER_CONNECTOR_ID,
} from '../../types/mep-connector-types';
import { buildDefaultMepFixtureParams } from '../../../hooks/drawing/mep-fixture-completion';
import { computeMepFixtureGeometry } from '../mep-fixture-geometry';
import { buildFixtureSymbol } from '../mep-fixture-symbol';
import { MepFixtureKindSchema, MepFixtureParamsSchema } from '../../types/mep-fixture.schemas';
import { electricalTerminalRecognizer } from '../../../systems/recognition/recognizers/electrical-terminal-recognizer';
import type { Point3D } from '../../types/bim-base';
import type { Entity } from '../../../types/entities';

/** A connectable electrical fixture at (x, y) — full params incl. its connector. */
function fixture(id: string, kind: MepFixtureParams['kind'], x: number, y: number): MepFixtureEntity {
  const params = buildDefaultMepFixtureParams({ x, y }, { kind });
  return { id, type: 'mep-fixture', layerId: 'electrical', params } as MepFixtureEntity;
}

describe('ADR-430 Slice 0 — electrical socket kind', () => {
  describe('kind guard', () => {
    it('isSocketKind matches only the socket literal', () => {
      expect(isSocketKind(SOCKET_KIND)).toBe(true);
      expect(isSocketKind('socket')).toBe(true);
      expect(isSocketKind('light-fixture')).toBe(false);
      expect(isSocketKind('wc')).toBe(false);
      expect(isSocketKind('floor-drain')).toBe(false);
    });
  });

  describe('IFC + V/G category resolvers', () => {
    it('a socket is an IfcOutlet; other kinds keep their IFC class', () => {
      expect(resolveFixtureIfcType('socket')).toBe('IfcOutlet');
      // regression
      expect(resolveFixtureIfcType('light-fixture')).toBe('IfcLightFixture');
      expect(resolveFixtureIfcType('wc')).toBe('IfcSanitaryTerminal');
      expect(resolveFixtureIfcType('washing-machine')).toBe('IfcElectricAppliance');
    });

    it("a socket reuses the electrical 'light-fixture' V/G category", () => {
      expect(resolveFixtureBimCategory({ kind: 'socket' } as MepFixtureParams)).toBe('light-fixture');
      // regression
      expect(resolveFixtureBimCategory({ kind: 'light-fixture' } as MepFixtureParams)).toBe('light-fixture');
      expect(resolveFixtureBimCategory({ kind: 'floor-drain' } as MepFixtureParams)).toBe('drain-pipe');
    });
  });

  describe('buildDefaultPowerConnector', () => {
    it("is a single power-in electrical connector classified 'power'", () => {
      const c = buildDefaultPowerConnector();
      expect(c.connectorId).toBe(FIXTURE_POWER_CONNECTOR_ID);
      expect(c.domain).toBe('electrical');
      expect(c.flow).toBe('in');
      expect(c.electrical?.systemClassification).toBe('power');
    });
  });

  describe('buildDefaultMepFixtureParams — socket', () => {
    it('uses the wall-mount socket defaults + a power connector', () => {
      const params = buildDefaultMepFixtureParams({ x: 5, y: 7 }, { kind: 'socket' });
      expect(params.kind).toBe('socket');
      expect(params.shape).toBe('rectangular');
      expect(params.width).toBe(DEFAULT_SOCKET_SIZE_MM);
      expect(params.length).toBe(DEFAULT_SOCKET_SIZE_MM);
      expect(params.mountingElevationMm).toBe(SOCKET_MOUNTING_ELEVATION_MM);
      expect(params.position).toEqual({ x: 5, y: 7, z: 0 });
      const connectors = params.connectors ?? [];
      expect(connectors).toHaveLength(1);
      expect(connectors[0].domain).toBe('electrical');
      expect(connectors[0].flow).toBe('in');
      expect(connectors[0].electrical?.systemClassification).toBe('power');
    });

    it('overrides still win over the socket defaults', () => {
      const params = buildDefaultMepFixtureParams({ x: 0, y: 0 }, { kind: 'socket', width: 120, rotation: 45 });
      expect(params.width).toBe(120);
      expect(params.rotation).toBe(45);
    });
  });

  describe('2D socket glyph', () => {
    const FOOTPRINT: Point3D[] = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 1, y: 1, z: 0 },
      { x: 0, y: 1, z: 0 },
    ];

    it('socketDrawer emits non-empty strokes (face + two pins)', () => {
      const strokes = socketDrawer(FOOTPRINT);
      expect(strokes.length).toBe(3);
      expect(strokes.every((s) => s.length >= 2)).toBe(true);
    });

    it('buildFixtureSymbol routes a socket to the socket glyph (not the luminaire X)', () => {
      const params = buildDefaultMepFixtureParams({ x: 0, y: 0 }, { kind: 'socket' });
      const geometry = computeMepFixtureGeometry(params);
      const symbol = buildFixtureSymbol(params, geometry);
      // the socket glyph has 3 strokes; the luminaire "X" has exactly 2.
      expect(symbol.strokes.length).toBe(3);
    });
  });

  describe('tool-id ↔ kind mapping', () => {
    it('maps mep-socket ↔ socket and rejects other tools', () => {
      expect(SOCKET_TOOL_ID).toBe('mep-socket');
      expect(socketFixtureToolKind('mep-socket')).toBe('socket');
      for (const id of ['mep-fixture', 'mep-wc', 'mep-pipe', 'wall']) {
        expect(socketFixtureToolKind(id)).toBeNull();
      }
    });
  });

  describe('Zod schema round-trip', () => {
    it('accepts the socket kind literal + a full socket params object', () => {
      expect(MepFixtureKindSchema.parse('socket')).toBe('socket');
      const params = buildDefaultMepFixtureParams({ x: 1, y: 2 }, { kind: 'socket' });
      const parsed = MepFixtureParamsSchema.parse(params);
      expect(parsed.kind).toBe('socket');
      expect(parsed.connectors?.[0]?.electrical?.systemClassification).toBe('power');
    });
  });

  describe('electrical-strong terminal recognizer', () => {
    const ctx = {
      entities: [
        fixture('lf1', 'light-fixture', 1000, 1000),
        fixture('sk1', 'socket', 2000, 1000),
      ] as Entity[],
      storeyId: 'floor-1',
      sceneUnits: 'mm' as const,
      spaces: [],
    };

    it('recognizes luminaires + sockets as Tier-1 terminals (confidence 1)', () => {
      const terminals = electricalTerminalRecognizer.recognize(ctx);
      expect(terminals).toHaveLength(2);
      for (const t of terminals) {
        expect(t.category).toBe('mep-terminal');
        expect(t.tier).toBe('bim-entity');
        expect(t.confidence).toBe(1);
      }
    });

    it('derives the service classification from the electrical connector', () => {
      const byKind = new Map(
        electricalTerminalRecognizer.recognize(ctx).map((t) => [t.terminalKind, t]),
      );
      expect(byKind.get('light-fixture')!.serviceClassifications).toEqual(['lighting']);
      expect(byKind.get('socket')!.serviceClassifications).toEqual(['power']);
    });

    it('ignores entities without an electrical connector', () => {
      const wall = { id: 'w1', type: 'wall', layerId: 'walls', params: {} } as unknown as Entity;
      const terminals = electricalTerminalRecognizer.recognize({ ...ctx, entities: [wall] });
      expect(terminals).toHaveLength(0);
    });
  });
});
