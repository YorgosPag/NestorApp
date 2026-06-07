/**
 * ADR-408 Φ14 — Floor drain (σιφώνι/στόμιο δαπέδου) SSoT unit tests.
 *
 * Covers the kind-aware extensions of the `mep-fixture` family that turn it into a
 * sanitary-drainage terminal: IFC class + V/G category resolvers, the single
 * drainage outlet connector, the kind-aware default params, and the grating grid
 * 2D symbol. Light-fixture behaviour MUST stay unchanged (regression).
 */

import {
  resolveFixtureBimCategory,
  resolveFixtureIfcType,
  type MepFixtureParams,
} from '../../types/mep-fixture-types';
import {
  buildFloorDrainConnector,
  FLOOR_DRAIN_CONNECTOR_ID,
} from '../../types/mep-connector-types';
import { buildDefaultMepFixtureParams } from '../../../hooks/drawing/mep-fixture-completion';
import { buildFixtureSymbol } from '../mep-fixture-symbol';
import { computeMepFixtureGeometry } from '../mep-fixture-geometry';
import { createMepFixture } from '@/services/factories/mep-fixture.factory';

describe('resolveFixtureIfcType', () => {
  it('floor-drain → IfcSanitaryTerminal (Revit Plumbing Fixture)', () => {
    expect(resolveFixtureIfcType('floor-drain')).toBe('IfcSanitaryTerminal');
  });
  it('light-fixture → IfcLightFixture (regression)', () => {
    expect(resolveFixtureIfcType('light-fixture')).toBe('IfcLightFixture');
  });
});

describe('resolveFixtureBimCategory', () => {
  const base: MepFixtureParams = {
    kind: 'light-fixture',
    shape: 'rectangular',
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    width: 600,
    length: 600,
    bodyHeightMm: 80,
    mountingElevationMm: 2700,
    sceneUnits: 'mm',
  };

  it('floor-drain → drain-pipe (hides with the «Αποχέτευση» toggle)', () => {
    expect(resolveFixtureBimCategory({ ...base, kind: 'floor-drain' })).toBe('drain-pipe');
  });
  it('light-fixture → light-fixture (regression)', () => {
    expect(resolveFixtureBimCategory(base)).toBe('light-fixture');
  });
});

describe('buildFloorDrainConnector', () => {
  it('single sanitary-drainage outlet (flow out, domain pipe)', () => {
    const c = buildFloorDrainConnector({ x: 0, y: 0, z: 0 }, 50);
    expect(c.connectorId).toBe(FLOOR_DRAIN_CONNECTOR_ID);
    expect(c.domain).toBe('pipe');
    expect(c.flow).toBe('out');
    expect(c.pipe?.systemClassification).toBe('sanitary-drainage');
    expect(c.pipe?.diameterMm).toBe(50);
  });
});

describe('buildDefaultMepFixtureParams — floor-drain', () => {
  it('square floor-level defaults + single sanitary-drainage outlet connector', () => {
    const p = buildDefaultMepFixtureParams({ x: 10, y: 20 }, { kind: 'floor-drain' }, 'mm');
    expect(p.kind).toBe('floor-drain');
    expect(p.shape).toBe('rectangular');
    expect(p.width).toBe(150);
    expect(p.length).toBe(150);
    expect(p.bodyHeightMm).toBe(100);
    // Floor-level (flush with FFL), NOT the ceiling-relative light-fixture default.
    expect(p.mountingElevationMm).toBe(0);
    expect(p.connectors).toHaveLength(1);
    const c = p.connectors![0]!;
    expect(c.connectorId).toBe(FLOOR_DRAIN_CONNECTOR_ID);
    expect(c.domain).toBe('pipe');
    expect(c.flow).toBe('out');
    expect(c.pipe?.systemClassification).toBe('sanitary-drainage');
  });

  it('light-fixture path stays unchanged (regression)', () => {
    const p = buildDefaultMepFixtureParams({ x: 0, y: 0 }, { kind: 'light-fixture' }, 'mm');
    expect(p.kind).toBe('light-fixture');
    expect(p.width).toBe(600);
    expect(p.mountingElevationMm).toBe(2700);
    expect(p.connectors).toHaveLength(1);
    expect(p.connectors![0]!.domain).toBe('electrical');
  });
});

describe('buildFixtureSymbol — floor-drain', () => {
  it('emits a grating GRID (more strokes than the luminaire 2-stroke "X")', () => {
    const p = buildDefaultMepFixtureParams({ x: 0, y: 0 }, { kind: 'floor-drain' }, 'mm');
    const sym = buildFixtureSymbol(p, computeMepFixtureGeometry(p));
    expect(sym.outline).toHaveLength(4);
    // grid = two orthogonal grating passes → well more than 2 strokes.
    expect(sym.strokes.length).toBeGreaterThan(2);
    for (const s of sym.strokes) expect(s.length).toBeGreaterThanOrEqual(2);
  });
});

describe('createMepFixture — floor-drain IFC class', () => {
  it('factory stamps ifcType IfcSanitaryTerminal from kind', () => {
    const params = buildDefaultMepFixtureParams({ x: 0, y: 0 }, { kind: 'floor-drain' }, 'mm');
    const geometry = computeMepFixtureGeometry(params);
    const entity = createMepFixture({ params, geometry, layerId: 'L0' });
    expect(entity.type).toBe('mep-fixture');
    expect(entity.kind).toBe('floor-drain');
    expect(entity.ifcType).toBe('IfcSanitaryTerminal');
  });
});
