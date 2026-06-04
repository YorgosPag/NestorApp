/**
 * ADR-408 Φ12 — Plumbing manifold geometry + validation + connector layout.
 *
 * Pins: footprint is a centred rotatable rectangle (mirror of the electrical
 * panel), area is in m², validation rejects degenerate dims / zero outlets, and
 * the connector layout produces 1 inlet (−X end) + N outlets (+Y front edge).
 */

import {
  buildMepManifoldConnectors,
  clampOutletCount,
  computeMepManifoldGeometry,
  validateMepManifoldParams,
} from '../mep-manifold-geometry';
import {
  DEFAULT_MANIFOLD_OUTLET_COUNT,
  MAX_MANIFOLD_OUTLET_COUNT,
  type MepManifoldParams,
} from '../../types/mep-manifold-types';

function params(overrides: Partial<MepManifoldParams> = {}): MepManifoldParams {
  return {
    kind: 'floor-manifold',
    shape: 'rectangular',
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    width: 400,
    length: 80,
    bodyHeightMm: 60,
    mountingElevationMm: 400,
    outletCount: 4,
    inletDiameterMm: 25,
    outletDiameterMm: 16,
    sceneUnits: 'mm',
    ...overrides,
  };
}

describe('computeMepManifoldGeometry', () => {
  it('builds a centred rectangular footprint (4 verts) in canvas units', () => {
    const geo = computeMepManifoldGeometry(params());
    expect(geo.footprint.vertices).toHaveLength(4);
    // width 400 → half-width 200 (mm-scene s=1).
    const xs = geo.footprint.vertices.map((v) => v.x);
    expect(Math.max(...xs)).toBeCloseTo(200, 6);
    expect(Math.min(...xs)).toBeCloseTo(-200, 6);
  });

  it('area is in m² (400mm × 80mm = 0.032 m²)', () => {
    const geo = computeMepManifoldGeometry(params());
    expect(geo.area).toBeCloseTo(0.032, 6);
  });

  it('height mirrors bodyHeightMm', () => {
    expect(computeMepManifoldGeometry(params({ bodyHeightMm: 60 })).height).toBe(60);
  });
});

describe('validateMepManifoldParams', () => {
  it('passes for valid params', () => {
    expect(validateMepManifoldParams(params()).hardErrors).toHaveLength(0);
  });

  it('rejects non-positive width', () => {
    expect(validateMepManifoldParams(params({ width: 0 })).hardErrors).toContain(
      'mepManifold.validation.hardErrors.nonPositiveWidth',
    );
  });

  it('rejects a too-small dimension', () => {
    expect(validateMepManifoldParams(params({ length: 5 })).hardErrors).toContain(
      'mepManifold.validation.hardErrors.dimensionTooSmall',
    );
  });

  it('rejects zero body height', () => {
    expect(validateMepManifoldParams(params({ bodyHeightMm: 0 })).hardErrors).toContain(
      'mepManifold.validation.hardErrors.nonPositiveBodyHeight',
    );
  });
});

describe('clampOutletCount', () => {
  it('clamps to [1, MAX]', () => {
    expect(clampOutletCount(0)).toBe(1);
    expect(clampOutletCount(999)).toBe(MAX_MANIFOLD_OUTLET_COUNT);
    expect(clampOutletCount(4)).toBe(4);
  });

  it('rounds + handles non-finite', () => {
    expect(clampOutletCount(3.6)).toBe(4);
    expect(clampOutletCount(Number.NaN)).toBe(1);
  });
});

describe('buildMepManifoldConnectors', () => {
  it('produces 1 inlet + N outlets', () => {
    const connectors = buildMepManifoldConnectors(params({ outletCount: 4 }));
    expect(connectors).toHaveLength(1 + 4);
    const inlets = connectors.filter((c) => c.flow === 'in');
    const outlets = connectors.filter((c) => c.flow === 'out');
    expect(inlets).toHaveLength(1);
    expect(outlets).toHaveLength(4);
    expect(connectors.every((c) => c.domain === 'pipe')).toBe(true);
  });

  it('defaults the count when unspecified via DEFAULT', () => {
    const connectors = buildMepManifoldConnectors(params({ outletCount: DEFAULT_MANIFOLD_OUTLET_COUNT }));
    expect(connectors.filter((c) => c.flow === 'out')).toHaveLength(DEFAULT_MANIFOLD_OUTLET_COUNT);
  });

  it('places the inlet at the −X short end (local frame)', () => {
    const [inlet] = buildMepManifoldConnectors(params());
    expect(inlet.flow).toBe('in');
    expect(inlet.localPosition.x).toBeCloseTo(-200, 6); // −half-width
    expect(inlet.localPosition.y).toBeCloseTo(0, 6);
  });

  it('spreads outlets along the +Y front edge', () => {
    const outlets = buildMepManifoldConnectors(params({ outletCount: 3 })).filter((c) => c.flow === 'out');
    // length 80 → +Y front edge at +40 (mm-scene).
    expect(outlets.every((c) => Math.abs((c.localPosition.y ?? 0) - 40) < 1e-6)).toBe(true);
    // x strictly increasing within the bar (−200 … +200).
    const xs = outlets.map((c) => c.localPosition.x);
    expect(xs[0]).toBeLessThan(xs[1]);
    expect(xs[1]).toBeLessThan(xs[2]);
    expect(Math.min(...xs)).toBeGreaterThan(-200);
    expect(Math.max(...xs)).toBeLessThan(200);
  });

  it('assigns host-local connector ids (inlet + indexed outlets)', () => {
    const connectors = buildMepManifoldConnectors(params({ outletCount: 2 }));
    expect(connectors[0].connectorId).toBe('m-in');
    expect(connectors[1].connectorId).toBe('m-out-0');
    expect(connectors[2].connectorId).toBe('m-out-1');
  });
});

describe('buildMepManifoldConnectors — ADR-408 Φ14 drainage collector (φρεάτιο)', () => {
  function drain(overrides: Partial<MepManifoldParams> = {}): MepManifoldParams {
    return params({ kind: 'drainage-collector', ...overrides });
  }

  it('MIRRORS the water manifold: N inlets + 1 outlet (roles flipped)', () => {
    const connectors = buildMepManifoldConnectors(drain({ outletCount: 4 }));
    expect(connectors).toHaveLength(1 + 4);
    expect(connectors.filter((c) => c.flow === 'in')).toHaveLength(4);
    expect(connectors.filter((c) => c.flow === 'out')).toHaveLength(1);
    expect(connectors.every((c) => c.domain === 'pipe')).toBe(true);
  });

  it('puts the single sewer outlet at the −X end, branch inlets along +Y', () => {
    const connectors = buildMepManifoldConnectors(drain({ outletCount: 3 }));
    const outlet = connectors.find((c) => c.flow === 'out')!;
    expect(outlet.connectorId).toBe('m-out-0');
    expect(outlet.localPosition.x).toBeCloseTo(-200, 6);
    const inlets = connectors.filter((c) => c.flow === 'in');
    expect(inlets.map((c) => c.connectorId)).toEqual(['m-in-0', 'm-in-1', 'm-in-2']);
    expect(inlets.every((c) => Math.abs((c.localPosition.y ?? 0) - 40) < 1e-6)).toBe(true);
  });

  it('defaults every connector to the sanitary-drainage classification', () => {
    const connectors = buildMepManifoldConnectors(drain());
    expect(connectors.every((c) => c.pipe?.systemClassification === 'sanitary-drainage')).toBe(true);
  });
});
