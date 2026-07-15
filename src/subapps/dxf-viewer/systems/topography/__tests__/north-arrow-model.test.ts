/**
 * ADR-656 M12 — north-arrow-model angle tests.
 */

import { northAngleDeg, surveyCentroidEN, svgRotationDeg } from '../north-arrow-model';
import { geographicToGrid } from '../../geo-referencing/egsa87-projection';
import type { GeoReference } from '../../geo-referencing/geo-transform';
import type { TopoPoint } from '../topo-types';

const p = (x: number, y: number): TopoPoint => ({ x, y, z: 0 });

describe('surveyCentroidEN', () => {
  it('averages the survey points (ΕΓΣΑ world mm)', () => {
    expect(surveyCentroidEN([p(0, 0), p(200, 100), p(400, 200)])).toEqual({ E: 200, N: 100 });
  });
  it('returns null for an empty survey', () => {
    expect(surveyCentroidEN([])).toBeNull();
  });
});

describe('northAngleDeg', () => {
  const noGeo: GeoReference | null = null;

  it('Grid North with no geo-reference points straight up (90°)', () => {
    expect(northAngleDeg('grid', noGeo, { E: 0, N: 0 })).toBe(90);
  });

  it('Grid North rotates with the geo-reference (rotationDeg=30 → 60°)', () => {
    const geo: GeoReference = { originWorld: { x: 0, y: 0 }, rotationDeg: 30 };
    expect(northAngleDeg('grid', geo, { E: 0, N: 0 })).toBe(60);
  });

  it('True North on the central meridian equals Grid North (γ≈0)', () => {
    const g = geographicToGrid(38, 24); // λ=24° → central meridian
    const centroid = { E: g.E * 1000, N: g.N * 1000 };
    expect(northAngleDeg('true', noGeo, centroid)).toBeCloseTo(90, 4);
  });

  it('True North east of the central meridian tilts past 90° by γ (~1.23° at 38°/26°)', () => {
    const g = geographicToGrid(38, 26);
    const centroid = { E: g.E * 1000, N: g.N * 1000 };
    const expected = 90 + 2 * Math.sin(38 * Math.PI / 180);
    expect(northAngleDeg('true', noGeo, centroid)).toBeCloseTo(expected, 2);
  });

  it('True North with no centroid falls back to Grid North (never a fabricated angle)', () => {
    expect(northAngleDeg('true', noGeo, null)).toBe(90);
  });
});

describe('svgRotationDeg', () => {
  it('maps straight-up (90°) to zero rotation', () => {
    expect(svgRotationDeg(90)).toBe(0);
  });
  it('maps a westward tilt (>90°) to a counter-clockwise (negative) SVG rotation', () => {
    expect(svgRotationDeg(91.23)).toBeCloseTo(-1.23, 5);
  });
});
