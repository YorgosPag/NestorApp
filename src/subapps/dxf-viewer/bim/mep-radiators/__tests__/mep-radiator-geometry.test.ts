/**
 * ADR-408 Εύρος Β #1 — Heating radiator geometry + validation + connector layout.
 *
 * Pins: footprint is a centred rotatable rectangle (mirror of the manifold), area
 * is in m², validation rejects degenerate dims, and the connector layout produces
 * exactly 2 connectors — a supply inlet (−X, hydronic-supply) + a return outlet
 * (+X, hydronic-return) so the radiator joins both networks at once.
 */

import {
  buildRadiatorConnectors,
  computeMepRadiatorGeometry,
  validateMepRadiatorParams,
} from '../mep-radiator-geometry';
import type { MepRadiatorParams } from '../../types/mep-radiator-types';

function params(overrides: Partial<MepRadiatorParams> = {}): MepRadiatorParams {
  return {
    kind: 'panel-radiator',
    shape: 'rectangular',
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    width: 1000,
    length: 100,
    bodyHeightMm: 600,
    mountingElevationMm: 450,
    connectorDiameterMm: 15,
    sceneUnits: 'mm',
    ...overrides,
  };
}

describe('computeMepRadiatorGeometry', () => {
  it('builds a centred rectangular footprint (4 verts) in canvas units', () => {
    const geo = computeMepRadiatorGeometry(params());
    expect(geo.footprint.vertices).toHaveLength(4);
    // width 1000 → half-width 500 (mm-scene s=1).
    const xs = geo.footprint.vertices.map((v) => v.x);
    expect(Math.max(...xs)).toBeCloseTo(500, 6);
    expect(Math.min(...xs)).toBeCloseTo(-500, 6);
  });

  it('area is in m² (1000mm × 100mm = 0.1 m²)', () => {
    expect(computeMepRadiatorGeometry(params()).area).toBeCloseTo(0.1, 6);
  });

  it('height mirrors bodyHeightMm', () => {
    expect(computeMepRadiatorGeometry(params({ bodyHeightMm: 600 })).height).toBe(600);
  });

  it('rotates the footprint about the insertion point', () => {
    const geo = computeMepRadiatorGeometry(params({ rotation: 90 }));
    // After 90° the body length (width 1000) now spans Y; X spans the depth (100).
    const xs = geo.footprint.vertices.map((v) => v.x);
    expect(Math.max(...xs)).toBeCloseTo(50, 6);
  });
});

describe('validateMepRadiatorParams', () => {
  it('passes for valid params', () => {
    expect(validateMepRadiatorParams(params()).hardErrors).toHaveLength(0);
  });

  it('rejects non-positive width', () => {
    expect(validateMepRadiatorParams(params({ width: 0 })).hardErrors).toContain(
      'mepRadiator.validation.hardErrors.nonPositiveWidth',
    );
  });

  it('rejects a too-small dimension', () => {
    expect(validateMepRadiatorParams(params({ length: 5 })).hardErrors).toContain(
      'mepRadiator.validation.hardErrors.dimensionTooSmall',
    );
  });

  it('rejects zero body height', () => {
    expect(validateMepRadiatorParams(params({ bodyHeightMm: 0 })).hardErrors).toContain(
      'mepRadiator.validation.hardErrors.nonPositiveBodyHeight',
    );
  });
});

describe('buildRadiatorConnectors', () => {
  it('produces exactly 2 pipe connectors (supply + return)', () => {
    const connectors = buildRadiatorConnectors(params());
    expect(connectors).toHaveLength(2);
    expect(connectors.every((c) => c.domain === 'pipe')).toBe(true);
  });

  it('supply inlet at −X, flow:in, hydronic-supply', () => {
    const supply = buildRadiatorConnectors(params()).find((c) => c.connectorId === 'rad-supply')!;
    expect(supply.flow).toBe('in');
    expect(supply.localPosition.x).toBeCloseTo(-500, 6); // −half-width
    expect(supply.localPosition.y).toBeCloseTo(0, 6);
    expect(supply.pipe?.systemClassification).toBe('hydronic-supply');
    expect(supply.pipe?.diameterMm).toBe(15);
  });

  it('return outlet at +X, flow:out, hydronic-return', () => {
    const ret = buildRadiatorConnectors(params()).find((c) => c.connectorId === 'rad-return')!;
    expect(ret.flow).toBe('out');
    expect(ret.localPosition.x).toBeCloseTo(500, 6); // +half-width
    expect(ret.localPosition.y).toBeCloseTo(0, 6);
    expect(ret.pipe?.systemClassification).toBe('hydronic-return');
  });

  it('scales connector x-offsets with width', () => {
    const connectors = buildRadiatorConnectors(params({ width: 600 }));
    const xs = connectors.map((c) => c.localPosition.x).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(-300, 6);
    expect(xs[1]).toBeCloseTo(300, 6);
  });
});
