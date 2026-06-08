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

  // ─── COMBI boiler — DHW hot outlet (ADR-408 Εύρος Β combi) ──────────────────────

  it('omits the DHW connector when producesDhw is absent/false (2 connectors)', () => {
    expect(buildBoilerConnectors(params())).toHaveLength(2);
    expect(buildBoilerConnectors(params({ producesDhw: false }))).toHaveLength(2);
    expect(
      buildBoilerConnectors(params()).some((c) => c.connectorId === 'boiler-dhw'),
    ).toBe(false);
  });

  it('appends a DHW hot outlet when producesDhw (3 connectors, combi)', () => {
    const connectors = buildBoilerConnectors(params({ producesDhw: true }));
    expect(connectors).toHaveLength(3);
    const dhw = connectors.find((c) => c.connectorId === 'boiler-dhw')!;
    expect(dhw.domain).toBe('pipe');
    expect(dhw.flow).toBe('out');
    expect(dhw.pipe?.systemClassification).toBe('domestic-hot-water');
    expect(dhw.pipe?.diameterMm).toBe(22);
  });

  it('places the DHW outlet at +X / +Y, distinct from the supply outlet', () => {
    const connectors = buildBoilerConnectors(params({ producesDhw: true }));
    const supply = connectors.find((c) => c.connectorId === 'boiler-supply')!;
    const dhw = connectors.find((c) => c.connectorId === 'boiler-dhw')!;
    // width 450 → +half-width 225 ; length 350 → +half-length 175 (mm-scene s=1).
    expect(dhw.localPosition.x).toBeCloseTo(225, 6);
    expect(dhw.localPosition.y).toBeCloseTo(175, 6);
    // never coincides with the supply outlet {x:225, y:0}.
    const dx = dhw.localPosition.x - supply.localPosition.x;
    const dy = dhw.localPosition.y - supply.localPosition.y;
    expect(dx * dx + dy * dy).toBeGreaterThan(0);
  });
});
