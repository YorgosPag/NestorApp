/**
 * ADR-408 DHW — Domestic hot water heater geometry + validation + connector layout.
 *
 * Pins: footprint is a centred rotatable rectangle (mirror of the boiler), area
 * is in m², validation rejects degenerate dims, and the connector layout produces
 * exactly 2 connectors with DHW-specific flow vs the boiler — a cold inlet (−X,
 * flow:in, domestic-cold-water → member of the cold-water network) + a hot outlet
 * (+X, flow:out, domestic-hot-water → sources the DHW network).
 */

import {
  buildWaterHeaterConnectors,
  computeMepWaterHeaterGeometry,
  validateMepWaterHeaterParams,
} from '../mep-water-heater-geometry';
import type { MepWaterHeaterParams } from '../../types/mep-water-heater-types';

function params(overrides: Partial<MepWaterHeaterParams> = {}): MepWaterHeaterParams {
  return {
    kind: 'electric-water-heater',
    shape: 'rectangular',
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    width: 500,
    length: 500,
    bodyHeightMm: 900,
    mountingElevationMm: 1500,
    connectorDiameterMm: 22,
    systemClassification: 'domestic-hot-water',
    sceneUnits: 'mm',
    ...overrides,
  };
}

describe('computeMepWaterHeaterGeometry', () => {
  it('builds a centred rectangular footprint (4 verts) in canvas units', () => {
    const geo = computeMepWaterHeaterGeometry(params());
    expect(geo.footprint.vertices).toHaveLength(4);
    // width 500 → half-width 250 (mm-scene s=1).
    const xs = geo.footprint.vertices.map((v) => v.x);
    expect(Math.max(...xs)).toBeCloseTo(250, 6);
    expect(Math.min(...xs)).toBeCloseTo(-250, 6);
  });

  it('area is in m² (500mm × 500mm = 0.25 m²)', () => {
    expect(computeMepWaterHeaterGeometry(params()).area).toBeCloseTo(0.25, 6);
  });

  it('height mirrors bodyHeightMm', () => {
    expect(computeMepWaterHeaterGeometry(params({ bodyHeightMm: 900 })).height).toBe(900);
  });

  it('rotates the footprint about the insertion point', () => {
    const geo = computeMepWaterHeaterGeometry(params({ rotation: 90 }));
    // After 90° the body width (500) now spans Y; X spans the depth (500).
    const xs = geo.footprint.vertices.map((v) => v.x);
    expect(Math.max(...xs)).toBeCloseTo(250, 6);
  });
});

describe('validateMepWaterHeaterParams', () => {
  it('passes for valid params', () => {
    expect(validateMepWaterHeaterParams(params()).hardErrors).toHaveLength(0);
  });

  it('rejects non-positive width', () => {
    expect(validateMepWaterHeaterParams(params({ width: 0 })).hardErrors).toContain(
      'mepWaterHeater.validation.hardErrors.nonPositiveWidth',
    );
  });

  it('rejects a too-small dimension', () => {
    expect(validateMepWaterHeaterParams(params({ length: 5 })).hardErrors).toContain(
      'mepWaterHeater.validation.hardErrors.dimensionTooSmall',
    );
  });

  it('rejects zero body height', () => {
    expect(validateMepWaterHeaterParams(params({ bodyHeightMm: 0 })).hardErrors).toContain(
      'mepWaterHeater.validation.hardErrors.nonPositiveBodyHeight',
    );
  });
});

describe('buildWaterHeaterConnectors', () => {
  it('produces exactly 2 pipe connectors (cold inlet + hot outlet)', () => {
    const connectors = buildWaterHeaterConnectors(params());
    expect(connectors).toHaveLength(2);
    expect(connectors.every((c) => c.domain === 'pipe')).toBe(true);
  });

  it('cold inlet at −X, flow:in, domestic-cold-water (member of cold network)', () => {
    const cold = buildWaterHeaterConnectors(params()).find((c) => c.connectorId === 'wh-cold')!;
    expect(cold.flow).toBe('in');
    expect(cold.localPosition.x).toBeCloseTo(-250, 6); // −half-width
    expect(cold.localPosition.y).toBeCloseTo(0, 6);
    expect(cold.pipe?.systemClassification).toBe('domestic-cold-water');
    expect(cold.pipe?.diameterMm).toBe(22);
  });

  it('hot outlet at +X, flow:out, domestic-hot-water (sources the DHW network)', () => {
    const hot = buildWaterHeaterConnectors(params()).find((c) => c.connectorId === 'wh-hot')!;
    expect(hot.flow).toBe('out');
    expect(hot.localPosition.x).toBeCloseTo(250, 6); // +half-width
    expect(hot.localPosition.y).toBeCloseTo(0, 6);
    expect(hot.pipe?.systemClassification).toBe('domestic-hot-water');
    expect(hot.pipe?.diameterMm).toBe(22);
  });

  it('scales connector x-offsets with width', () => {
    const connectors = buildWaterHeaterConnectors(params({ width: 600 }));
    const xs = connectors.map((c) => c.localPosition.x).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(-300, 6);
    expect(xs[1]).toBeCloseTo(300, 6);
  });
});
