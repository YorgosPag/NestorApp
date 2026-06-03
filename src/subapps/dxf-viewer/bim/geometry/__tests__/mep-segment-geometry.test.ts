/**
 * ADR-408 Φ8 — MEP segment geometry SSoT tests.
 *
 * Covers the pure `computeMepSegmentGeometry` / `validateMepSegmentParams` plus
 * the shared round-profile helpers. Mirrors the beam-geometry test shape.
 */

import { computeMepSegmentGeometry, validateMepSegmentParams } from '../mep-segment-geometry';
import {
  buildRoundProfile,
  roundCrossSectionAreaMm2,
  annulusCrossSectionAreaMm2,
  roundPerimeterMm,
  rectPerimeterMm,
} from '../shared/round-profile';
import type { MepSegmentParams } from '../../types/mep-segment-types';

function rectDuct(overrides: Partial<MepSegmentParams> = {}): MepSegmentParams {
  return {
    domain: 'duct',
    sectionKind: 'rectangular',
    startPoint: { x: 0, y: 0, z: 0 },
    endPoint: { x: 2000, y: 0, z: 0 }, // 2000 mm-scene units along X
    width: 400,
    height: 200,
    centerlineElevationMm: 2800,
    sceneUnits: 'mm',
    ...overrides,
  };
}

function roundPipe(overrides: Partial<MepSegmentParams> = {}): MepSegmentParams {
  return {
    domain: 'pipe',
    sectionKind: 'round',
    startPoint: { x: 0, y: 0, z: 0 },
    endPoint: { x: 0, y: 1000, z: 0 },
    diameter: 50,
    centerlineElevationMm: 1500,
    sceneUnits: 'mm',
    ...overrides,
  };
}

describe('round-profile SSoT', () => {
  it('builds a closed N-gon centred on origin', () => {
    const verts = buildRoundProfile(100, 1, 16);
    expect(verts).toHaveLength(16);
    // radius = 50 in output units
    expect(Math.hypot(verts[0].x, verts[0].y)).toBeCloseTo(50, 5);
  });

  it('round cross-section area = π r²', () => {
    expect(roundCrossSectionAreaMm2(100)).toBeCloseTo(Math.PI * 50 * 50, 3);
  });

  it('annulus area uses the wall thickness when valid, else solid', () => {
    const solid = Math.PI * 25 * 25;
    expect(annulusCrossSectionAreaMm2(50)).toBeCloseTo(solid, 3);
    // 50 OD, 3 mm wall → ri = 22
    expect(annulusCrossSectionAreaMm2(50, 3)).toBeCloseTo(Math.PI * (25 * 25 - 22 * 22), 3);
    // degenerate wall ≥ radius → solid fallback
    expect(annulusCrossSectionAreaMm2(50, 999)).toBeCloseTo(solid, 3);
  });

  it('perimeters', () => {
    expect(roundPerimeterMm(100)).toBeCloseTo(Math.PI * 100, 5);
    expect(rectPerimeterMm(400, 200)).toBe(1200);
  });
});

describe('computeMepSegmentGeometry — rectangular duct', () => {
  const geo = computeMepSegmentGeometry(rectDuct());

  it('axis + outline', () => {
    expect(geo.axisPolyline.points).toHaveLength(2);
    expect(geo.outline.vertices.length).toBeGreaterThanOrEqual(4);
  });

  it('length in metres (2000 mm-scene → 2 m)', () => {
    expect(geo.length).toBeCloseTo(2, 5);
  });

  it('cross-section area = w·h in m²', () => {
    expect(geo.crossSectionAreaM2).toBeCloseTo((400 * 200) * 1e-6, 6);
  });

  it('surface area = perimeter × length', () => {
    expect(geo.surfaceAreaM2).toBeCloseTo(rectPerimeterMm(400, 200) * 1e-3 * 2, 5);
  });

  it('volume = section area × length', () => {
    expect(geo.volume).toBeCloseTo((400 * 200) * 1e-6 * 2, 6);
  });

  it('bbox z centred on centreline ± height/2', () => {
    expect(geo.bbox.min.z).toBeCloseTo((2800 - 100) / 1000, 5);
    expect(geo.bbox.max.z).toBeCloseTo((2800 + 100) / 1000, 5);
  });
});

describe('computeMepSegmentGeometry — round pipe + unit parity', () => {
  it('round section area = π r²', () => {
    const geo = computeMepSegmentGeometry(roundPipe());
    expect(geo.crossSectionAreaM2).toBeCloseTo(Math.PI * 25 * 25 * 1e-6, 8);
  });

  it('metre-scene parity: 2 m run === 2000 mm-scene run length', () => {
    const mmGeo = computeMepSegmentGeometry(rectDuct());
    const mGeo = computeMepSegmentGeometry(
      rectDuct({ endPoint: { x: 2, y: 0, z: 0 }, sceneUnits: 'm' }),
    );
    expect(mGeo.length).toBeCloseTo(mmGeo.length, 5);
  });
});

describe('validateMepSegmentParams', () => {
  it('accepts a normal duct', () => {
    expect(validateMepSegmentParams(rectDuct()).errors).toHaveLength(0);
  });

  it('rejects a degenerate-length run', () => {
    const res = validateMepSegmentParams(rectDuct({ endPoint: { x: 5, y: 0, z: 0 } }));
    expect(res.errors).toContain('mepSegment.tooShort');
  });

  it('rejects a too-small section', () => {
    const res = validateMepSegmentParams(rectDuct({ width: 1, height: 1 }));
    expect(res.errors).toContain('mepSegment.sectionTooSmall');
  });
});
