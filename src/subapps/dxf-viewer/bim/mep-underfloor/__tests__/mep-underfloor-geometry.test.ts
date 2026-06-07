/**
 * ADR-408 Εύρος Β #3 — Underfloor (radiant floor) geometry + connector layout.
 *
 * Pins: the serpentine field stays inside the footprint, total pipe length grows as
 * spacing tightens (both patterns), area is in m², the two connectors sit at the
 * entry ~spacing/2 apart, and a room smaller than 2× the clearance degenerates to a
 * zero-length loop without throwing.
 */

import {
  buildUnderfloorConnectors,
  computeMepUnderfloorGeometry,
  validateMepUnderfloorParams,
} from '../mep-underfloor-geometry';
import type {
  MepUnderfloorParams,
  MepUnderfloorPattern,
} from '../../types/mep-underfloor-types';
import { pointInPolygon } from '../../geometry/shared/polygon-utils';
import type { Point3D } from '../../types/bim-base';

/** 5000 × 4000 mm rectangle, CCW. */
const RECT: Point3D[] = [
  { x: 0, y: 0, z: 0 },
  { x: 5000, y: 0, z: 0 },
  { x: 5000, y: 4000, z: 0 },
  { x: 0, y: 4000, z: 0 },
];

function params(overrides: Partial<MepUnderfloorParams> = {}): MepUnderfloorParams {
  return {
    kind: 'hydronic-loop',
    footprint: { vertices: RECT },
    pipeSpacingMm: 150,
    edgeClearanceMm: 100,
    patternType: 'boustrophedon',
    screedOffsetMm: 50,
    connectorDiameterMm: 16,
    sceneUnits: 'mm',
    ...overrides,
  };
}

describe('computeMepUnderfloorGeometry', () => {
  it('area is in m² (5m × 4m = 20 m²)', () => {
    expect(computeMepUnderfloorGeometry(params()).areaM2).toBeCloseTo(20, 6);
  });

  it.each<MepUnderfloorPattern>(['boustrophedon', 'counterflow-spiral'])(
    'produces a positive pipe length (%s)',
    (patternType) => {
      expect(computeMepUnderfloorGeometry(params({ patternType })).totalLengthM).toBeGreaterThan(0);
    },
  );

  it.each<MepUnderfloorPattern>(['boustrophedon', 'counterflow-spiral'])(
    'pipe length grows as spacing tightens (%s)',
    (patternType) => {
      const tight = computeMepUnderfloorGeometry(params({ patternType, pipeSpacingMm: 100 })).totalLengthM;
      const wide = computeMepUnderfloorGeometry(params({ patternType, pipeSpacingMm: 250 })).totalLengthM;
      expect(tight).toBeGreaterThan(wide);
    },
  );

  it.each<MepUnderfloorPattern>(['boustrophedon', 'counterflow-spiral'])(
    'keeps every loop vertex inside the footprint (%s)',
    (patternType) => {
      const geo = computeMepUnderfloorGeometry(params({ patternType }));
      for (const v of geo.loopPath) {
        expect(pointInPolygon(v, RECT)).toBe(true);
      }
    },
  );

  it('places the two connectors near the entry edge, ~spacing/2 apart', () => {
    const geo = computeMepUnderfloorGeometry(params({ pipeSpacingMm: 200, entrySide: 0 }));
    const d = Math.hypot(
      geo.supplyConnectorLocal.x - geo.returnConnectorLocal.x,
      geo.supplyConnectorLocal.y - geo.returnConnectorLocal.y,
    );
    expect(d).toBeCloseTo(100, 6); // 2 × (spacing/4)
    // entrySide 0 is the bottom edge (y=0) → both connectors on it.
    expect(geo.supplyConnectorLocal.y).toBeCloseTo(0, 6);
    expect(geo.returnConnectorLocal.y).toBeCloseTo(0, 6);
  });

  it('degenerates to a zero-length loop when the room is smaller than 2× clearance', () => {
    const tiny: Point3D[] = [
      { x: 0, y: 0, z: 0 },
      { x: 150, y: 0, z: 0 },
      { x: 150, y: 150, z: 0 },
      { x: 0, y: 150, z: 0 },
    ];
    const geo = computeMepUnderfloorGeometry(params({ footprint: { vertices: tiny }, edgeClearanceMm: 100 }));
    expect(geo.totalLengthM).toBe(0);
    expect(geo.loopPath.length).toBeLessThanOrEqual(2);
  });

  it('handles a CW footprint by normalising winding', () => {
    const cw = [...RECT].reverse();
    expect(computeMepUnderfloorGeometry(params({ footprint: { vertices: cw } })).totalLengthM).toBeGreaterThan(0);
  });
});

describe('buildUnderfloorConnectors', () => {
  it('builds exactly 2 connectors — supply inlet + return outlet (hydronic)', () => {
    const [supply, ret] = buildUnderfloorConnectors(params());
    expect(supply.connectorId).toBe('uf-supply');
    expect(supply.flow).toBe('in');
    expect(supply.pipe?.systemClassification).toBe('hydronic-supply');
    expect(ret.connectorId).toBe('uf-return');
    expect(ret.flow).toBe('out');
    expect(ret.pipe?.systemClassification).toBe('hydronic-return');
  });
});

describe('validateMepUnderfloorParams', () => {
  it('rejects a sub-minimum spacing', () => {
    expect(validateMepUnderfloorParams(params({ pipeSpacingMm: 10 })).hardErrors).toContain(
      'mepUnderfloor.validation.hardErrors.spacingTooSmall',
    );
  });

  it('accepts a valid loop', () => {
    expect(validateMepUnderfloorParams(params()).hardErrors).toHaveLength(0);
  });
});
