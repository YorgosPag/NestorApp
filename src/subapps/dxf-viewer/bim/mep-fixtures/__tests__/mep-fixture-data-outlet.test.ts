/**
 * ADR-431 Slice 0 — connectable structured-cabling data outlet (πρίζα δικτύου / RJ45)
 * + comms-rack source (weak-current kind of the electrical panel).
 *
 * Verifies the SSoT wiring that turns the data outlet into a connectable `mep-fixture`
 * kind: the kind guard, IFC/category resolvers, the `'data'` connector builder,
 * kind-aware default params (wall-mount footprint + data-in connector), the 2D data
 * glyph, the tool-id mapping, the Zod round-trip, AND the (already service-agnostic)
 * electrical terminal recognizer picking it up as a `'data'` terminal. The comms-rack
 * leg checks the `'data'` out connector + the kind-aware panel params/symbol. Regression
 * checks keep the socket / light-fixture / distribution-board paths unchanged.
 */

import {
  resolveFixtureBimCategory,
  resolveFixtureIfcType,
  type MepFixtureEntity,
  type MepFixtureParams,
} from '../../types/mep-fixture-types';
import {
  DATA_OUTLET_KIND,
  DATA_OUTLET_TOOL_ID,
  DEFAULT_DATA_OUTLET_SIZE_MM,
  DATA_OUTLET_MOUNTING_ELEVATION_MM,
  isDataOutletKind,
  dataOutletFixtureToolKind,
  dataOutletDrawer,
} from '../data-outlet-symbol-spec';
import {
  buildDefaultDataConnector,
  buildDefaultCommsRackOutgoingConnector,
  FIXTURE_POWER_CONNECTOR_ID,
  PANEL_OUT_CONNECTOR_ID,
} from '../../types/mep-connector-types';
import { buildDefaultMepFixtureParams } from '../../../hooks/drawing/mep-fixture-completion';
import { buildDefaultElectricalPanelParams } from '../../../hooks/drawing/electrical-panel-completion';
import { computeMepFixtureGeometry } from '../mep-fixture-geometry';
import { computeElectricalPanelGeometry } from '../../electrical-panels/electrical-panel-geometry';
import { buildFixtureSymbol } from '../mep-fixture-symbol';
import { buildPanelSymbol } from '../../electrical-panels/electrical-panel-symbol';
import { MepFixtureKindSchema, MepFixtureParamsSchema } from '../../types/mep-fixture.schemas';
import { ElectricalPanelKindSchema } from '../../types/electrical-panel.schemas';
import { electricalTerminalRecognizer } from '../../../systems/recognition/recognizers/electrical-terminal-recognizer';
import { seedDefaultConnectors } from '../../mep-systems/mep-connector-seed';
import type { Point3D } from '../../types/bim-base';
import type { Entity } from '../../../types/entities';

function fixture(id: string, kind: MepFixtureParams['kind'], x: number, y: number): MepFixtureEntity {
  const params = buildDefaultMepFixtureParams({ x, y }, { kind });
  return { id, type: 'mep-fixture', layerId: 'electrical', params } as MepFixtureEntity;
}

describe('ADR-431 Slice 0 — data outlet kind', () => {
  describe('kind guard', () => {
    it('isDataOutletKind matches only the data-outlet literal', () => {
      expect(isDataOutletKind(DATA_OUTLET_KIND)).toBe(true);
      expect(isDataOutletKind('data-outlet')).toBe(true);
      expect(isDataOutletKind('socket')).toBe(false);
      expect(isDataOutletKind('light-fixture')).toBe(false);
    });
  });

  describe('IFC + V/G category resolvers', () => {
    it('a data outlet is an IfcOutlet; other kinds keep their IFC class', () => {
      expect(resolveFixtureIfcType('data-outlet')).toBe('IfcOutlet');
      // regression
      expect(resolveFixtureIfcType('socket')).toBe('IfcOutlet');
      expect(resolveFixtureIfcType('light-fixture')).toBe('IfcLightFixture');
    });

    it("a data outlet reuses the electrical 'light-fixture' V/G category", () => {
      expect(resolveFixtureBimCategory({ kind: 'data-outlet' } as MepFixtureParams)).toBe('light-fixture');
    });
  });

  describe('buildDefaultDataConnector', () => {
    it("is a single data-in electrical connector classified 'data'", () => {
      const c = buildDefaultDataConnector();
      expect(c.connectorId).toBe(FIXTURE_POWER_CONNECTOR_ID);
      expect(c.domain).toBe('electrical');
      expect(c.flow).toBe('in');
      expect(c.electrical?.systemClassification).toBe('data');
    });
  });

  describe('buildDefaultMepFixtureParams — data outlet', () => {
    it('uses the wall-mount data-outlet defaults + a data connector', () => {
      const params = buildDefaultMepFixtureParams({ x: 5, y: 7 }, { kind: 'data-outlet' });
      expect(params.kind).toBe('data-outlet');
      expect(params.shape).toBe('rectangular');
      expect(params.width).toBe(DEFAULT_DATA_OUTLET_SIZE_MM);
      expect(params.mountingElevationMm).toBe(DATA_OUTLET_MOUNTING_ELEVATION_MM);
      const connectors = params.connectors ?? [];
      expect(connectors).toHaveLength(1);
      expect(connectors[0].electrical?.systemClassification).toBe('data');
    });
  });

  describe('2D data-outlet glyph', () => {
    const FOOTPRINT: Point3D[] = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 1, y: 1, z: 0 },
      { x: 0, y: 1, z: 0 },
    ];

    it('dataOutletDrawer emits the 3-segment triangle glyph', () => {
      const strokes = dataOutletDrawer(FOOTPRINT);
      expect(strokes.length).toBe(3);
      expect(strokes.every((s) => s.length >= 2)).toBe(true);
    });

    it('buildFixtureSymbol routes a data outlet to its glyph', () => {
      const params = buildDefaultMepFixtureParams({ x: 0, y: 0 }, { kind: 'data-outlet' });
      const geometry = computeMepFixtureGeometry(params);
      const symbol = buildFixtureSymbol(params, geometry);
      expect(symbol.strokes.length).toBe(3);
    });
  });

  describe('tool-id ↔ kind mapping', () => {
    it('maps mep-data-outlet ↔ data-outlet and rejects other tools', () => {
      expect(DATA_OUTLET_TOOL_ID).toBe('mep-data-outlet');
      expect(dataOutletFixtureToolKind('mep-data-outlet')).toBe('data-outlet');
      for (const id of ['mep-socket', 'mep-fixture', 'wall']) {
        expect(dataOutletFixtureToolKind(id)).toBeNull();
      }
    });
  });

  describe('Zod schema round-trip', () => {
    it('accepts the data-outlet kind literal + a full params object', () => {
      expect(MepFixtureKindSchema.parse('data-outlet')).toBe('data-outlet');
      const params = buildDefaultMepFixtureParams({ x: 1, y: 2 }, { kind: 'data-outlet' });
      const parsed = MepFixtureParamsSchema.parse(params);
      expect(parsed.kind).toBe('data-outlet');
      expect(parsed.connectors?.[0]?.electrical?.systemClassification).toBe('data');
    });
  });

  describe('connector seeding (legacy back-fill)', () => {
    it('re-materialises a data connector for a connector-less data outlet', () => {
      const bare = { id: 'do1', type: 'mep-fixture', layerId: 'l', params: { kind: 'data-outlet', position: { x: 0, y: 0, z: 0 }, rotation: 0, width: 80, length: 80, bodyHeightMm: 40, mountingElevationMm: 300, shape: 'rectangular' } } as unknown as Entity;
      const seeded = seedDefaultConnectors(bare) as MepFixtureEntity;
      expect(seeded.params.connectors?.[0]?.electrical?.systemClassification).toBe('data');
    });
  });

  describe('electrical terminal recognizer (service-agnostic)', () => {
    it('recognizes a data outlet as a Tier-1 data terminal', () => {
      const ctx = {
        entities: [fixture('do1', 'data-outlet', 2000, 1000)] as Entity[],
        storeyId: 'floor-1',
        sceneUnits: 'mm' as const,
        spaces: [],
      };
      const terminals = electricalTerminalRecognizer.recognize(ctx);
      expect(terminals).toHaveLength(1);
      expect(terminals[0].serviceClassifications).toEqual(['data']);
    });
  });
});

describe('ADR-431 Slice 0 — comms-rack source kind', () => {
  it('buildDefaultCommsRackOutgoingConnector is a data-out connector', () => {
    const c = buildDefaultCommsRackOutgoingConnector();
    expect(c.connectorId).toBe(PANEL_OUT_CONNECTOR_ID);
    expect(c.domain).toBe('electrical');
    expect(c.flow).toBe('out');
    expect(c.electrical?.systemClassification).toBe('data');
  });

  it('ElectricalPanelKindSchema accepts both kinds', () => {
    expect(ElectricalPanelKindSchema.parse('comms-rack')).toBe('comms-rack');
    expect(ElectricalPanelKindSchema.parse('distribution-board')).toBe('distribution-board');
  });

  it('a comms-rack panel carries a data-out connector; a board keeps power-out', () => {
    const rack = buildDefaultElectricalPanelParams({ x: 1, y: 1 }, { kind: 'comms-rack' });
    expect(rack.kind).toBe('comms-rack');
    expect(rack.connectors?.[0]?.electrical?.systemClassification).toBe('data');
    const board = buildDefaultElectricalPanelParams({ x: 1, y: 1 }, { kind: 'distribution-board' });
    expect(board.connectors?.[0]?.electrical?.systemClassification).toBe('power');
  });

  it('the comms-rack symbol differs from the board breaker rows', () => {
    const rack = buildDefaultElectricalPanelParams({ x: 0, y: 0 }, { kind: 'comms-rack' });
    const board = buildDefaultElectricalPanelParams({ x: 0, y: 0 }, { kind: 'distribution-board' });
    const rackStrokes = buildPanelSymbol(rack, computeElectricalPanelGeometry(rack)).strokes.length;
    const boardStrokes = buildPanelSymbol(board, computeElectricalPanelGeometry(board)).strokes.length;
    expect(boardStrokes).toBe(3);
    expect(rackStrokes).toBeGreaterThan(3);
  });
});
