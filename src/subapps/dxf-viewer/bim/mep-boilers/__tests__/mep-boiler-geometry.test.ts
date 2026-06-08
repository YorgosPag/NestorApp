/**
 * ADR-408 Εύρος Β #2 — Heating boiler geometry + validation + connector layout.
 *
 * Pins: footprint is a centred rotatable rectangle (mirror of the radiator), area
 * is in m², validation rejects degenerate dims, and the connector layout produces
 * exactly 2 connectors with REVERSED flow vs the radiator — a supply outlet (+X,
 * flow:out, hydronic-supply → sources the network) + a return inlet (−X, flow:in,
 * hydronic-return).
 */

import {
  buildBoilerConnectors,
  computeMepBoilerGeometry,
  validateMepBoilerParams,
} from '../mep-boiler-geometry';
import type { MepBoilerParams } from '../../types/mep-boiler-types';

function params(overrides: Partial<MepBoilerParams> = {}): MepBoilerParams {
  return {
    kind: 'wall-boiler',
    shape: 'rectangular',
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    width: 450,
    length: 350,
    bodyHeightMm: 700,
    mountingElevationMm: 1200,
    connectorDiameterMm: 22,
    systemClassification: 'hydronic-supply',
    sceneUnits: 'mm',
    ...overrides,
  };
}

describe('computeMepBoilerGeometry', () => {
  it('builds a centred rectangular footprint (4 verts) in canvas units', () => {
    const geo = computeMepBoilerGeometry(params());
    expect(geo.footprint.vertices).toHaveLength(4);
    // width 450 → half-width 225 (mm-scene s=1).
    const xs = geo.footprint.vertices.map((v) => v.x);
    expect(Math.max(...xs)).toBeCloseTo(225, 6);
    expect(Math.min(...xs)).toBeCloseTo(-225, 6);
  });

  it('area is in m² (450mm × 350mm = 0.1575 m²)', () => {
    expect(computeMepBoilerGeometry(params()).area).toBeCloseTo(0.1575, 6);
  });

  it('height mirrors bodyHeightMm', () => {
    expect(computeMepBoilerGeometry(params({ bodyHeightMm: 700 })).height).toBe(700);
  });

  it('rotates the footprint about the insertion point', () => {
    const geo = computeMepBoilerGeometry(params({ rotation: 90 }));
    // After 90° the body width (450) now spans Y; X spans the depth (350).
    const xs = geo.footprint.vertices.map((v) => v.x);
    expect(Math.max(...xs)).toBeCloseTo(175, 6);
  });
});

describe('validateMepBoilerParams', () => {
  it('passes for valid params', () => {
    expect(validateMepBoilerParams(params()).hardErrors).toHaveLength(0);
  });

  it('rejects non-positive width', () => {
    expect(validateMepBoilerParams(params({ width: 0 })).hardErrors).toContain(
      'mepBoiler.validation.hardErrors.nonPositiveWidth',
    );
  });

  it('rejects a too-small dimension', () => {
    expect(validateMepBoilerParams(params({ length: 5 })).hardErrors).toContain(
      'mepBoiler.validation.hardErrors.dimensionTooSmall',
    );
  });

  it('rejects zero body height', () => {
    expect(validateMepBoilerParams(params({ bodyHeightMm: 0 })).hardErrors).toContain(
      'mepBoiler.validation.hardErrors.nonPositiveBodyHeight',
    );
  });
});

describe('buildBoilerConnectors', () => {
  it('produces exactly 2 pipe connectors (supply + return)', () => {
    const connectors = buildBoilerConnectors(params());
    expect(connectors).toHaveLength(2);
    expect(connectors.every((c) => c.domain === 'pipe')).toBe(true);
  });

  it('supply outlet at +X, flow:out, hydronic-supply (sources the network)', () => {
    const supply = buildBoilerConnectors(params()).find((c) => c.connectorId === 'boiler-supply')!;
    expect(supply.flow).toBe('out');
    expect(supply.localPosition.x).toBeCloseTo(225, 6); // +half-width
    expect(supply.localPosition.y).toBeCloseTo(0, 6);
    expect(supply.pipe?.systemClassification).toBe('hydronic-supply');
    expect(supply.pipe?.diameterMm).toBe(22);
  });

  it('return inlet at −X, flow:in, hydronic-return', () => {
    const ret = buildBoilerConnectors(params()).find((c) => c.connectorId === 'boiler-return')!;
    expect(ret.flow).toBe('in');
    expect(ret.localPosition.x).toBeCloseTo(-225, 6); // −half-width
    expect(ret.localPosition.y).toBeCloseTo(0, 6);
    expect(ret.pipe?.systemClassification).toBe('hydronic-return');
  });

  it('scales connector x-offsets with width', () => {
    const connectors = buildBoilerConnectors(params({ width: 600 }));
    const xs = connectors
      .filter((c) => c.connectorId !== 'boiler-dhw')
      .map((c) => c.localPosition.x)
      .sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(-300, 6);
    expect(xs[1]).toBeCloseTo(300, 6);
  });

  // ─── COMBI boiler — DHW cold inlet + hot outlet (ADR-408 Εύρος Β combi) ──────────

  it('omits the DHW connectors when producesDhw is absent/false (2 connectors)', () => {
    expect(buildBoilerConnectors(params())).toHaveLength(2);
    expect(buildBoilerConnectors(params({ producesDhw: false }))).toHaveLength(2);
    const ids = buildBoilerConnectors(params()).map((c) => c.connectorId);
    expect(ids).not.toContain('boiler-dhw-hot');
    expect(ids).not.toContain('boiler-dhw-cold');
  });

  it('appends BOTH DHW connectors when producesDhw (4 connectors, combi water path)', () => {
    const connectors = buildBoilerConnectors(params({ producesDhw: true }));
    expect(connectors).toHaveLength(4);
    const hot = connectors.find((c) => c.connectorId === 'boiler-dhw-hot')!;
    const cold = connectors.find((c) => c.connectorId === 'boiler-dhw-cold')!;
    // hot outlet → sources the DHW network.
    expect(hot.flow).toBe('out');
    expect(hot.pipe?.systemClassification).toBe('domestic-hot-water');
    // cold inlet → member of the cold-water network (combi takes cold, makes hot).
    expect(cold.flow).toBe('in');
    expect(cold.pipe?.systemClassification).toBe('domestic-cold-water');
  });

  it('places DHW hot at +X/+Y and cold at −X/+Y, all four corners distinct', () => {
    const connectors = buildBoilerConnectors(params({ producesDhw: true }));
    const hot = connectors.find((c) => c.connectorId === 'boiler-dhw-hot')!;
    const cold = connectors.find((c) => c.connectorId === 'boiler-dhw-cold')!;
    // width 450 → ±225 ; length 350 → +175 (mm-scene s=1).
    expect(hot.localPosition.x).toBeCloseTo(225, 6);
    expect(hot.localPosition.y).toBeCloseTo(175, 6);
    expect(cold.localPosition.x).toBeCloseTo(-225, 6);
    expect(cold.localPosition.y).toBeCloseTo(175, 6);
    // all four connector positions are distinct.
    const keys = new Set(connectors.map((c) => `${c.localPosition.x},${c.localPosition.y}`));
    expect(keys.size).toBe(4);
  });

  it('uses the dedicated DHW diameter when set, else falls back to connectorDiameterMm', () => {
    const overridden = buildBoilerConnectors(params({ producesDhw: true, dhwConnectorDiameterMm: 15 }));
    expect(overridden.find((c) => c.connectorId === 'boiler-dhw-hot')!.pipe?.diameterMm).toBe(15);
    expect(overridden.find((c) => c.connectorId === 'boiler-dhw-cold')!.pipe?.diameterMm).toBe(15);
    // fallback: no dhwConnectorDiameterMm → uses the hydronic connectorDiameterMm (22).
    const fallback = buildBoilerConnectors(params({ producesDhw: true }));
    expect(fallback.find((c) => c.connectorId === 'boiler-dhw-hot')!.pipe?.diameterMm).toBe(22);
  });
});
