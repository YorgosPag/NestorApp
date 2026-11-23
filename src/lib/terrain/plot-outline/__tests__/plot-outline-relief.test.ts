/**
 * ADR-920 §14.11 Π6 + Π7 — the outline against the relief.
 *
 *   Κ  coverage (Π6, WORLD mm, the real TIN engine): inside ⇒ covered · half out ⇒ partial ≈ ½ · elsewhere ⇒ disjoint
 *   Ν  drape (Π7, snapshot frame): a ring on the relief is ONE closed run at the surface's exact heights; a ring that
 *      leaves the relief breaks there — nothing is drawn, and no height is invented, outside it
 */

import type { PlanarPoint } from '@/lib/geometry/planar-polygon';

import { terrainInspectIndexOf } from '../../inspect/terrain-inspect-index';
import type { ListingTerrainSnapshot } from '../../publication/listing-terrain-types';
import type { TopoPoint } from '../../terrain-types';
import { buildTin } from '../../tin-builder';
import { plotOutlineCoverage } from '../plot-outline-coverage';
import { drapePlotOutline } from '../plot-outline-drape';

const M = 1000;
/** ΕΓΣΑ-sized origin, so the test runs at the magnitudes the product does. */
const E0 = 384_500 * M;
const N0 = 4_201_200 * M;

/** Survey points every 5 m over 0..20 m, a plane rising to the east. WORLD mm. */
function reliefPoints(): TopoPoint[] {
  const points: TopoPoint[] = [];
  for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) points.push({ x: E0 + i * 5 * M, y: N0 + j * 5 * M, z: (100 + i * 0.5) * M });
  return points;
}

const square = (x0: number, y0: number, size: number): PlanarPoint[] =>
  [{ x: x0, y: y0 }, { x: x0 + size, y: y0 }, { x: x0 + size, y: y0 + size }, { x: x0, y: y0 + size }];

describe('Κ — coverage (Π6)', () => {
  const relief = buildTin(reliefPoints());

  it('an outline inside the relief is covered', () => {
    const c = plotOutlineCoverage(relief, square(E0 + 5 * M, N0 + 5 * M, 10 * M));
    expect(c.verdict).toBe('covered');
    expect(c.outlineAreaM2).toBeCloseTo(100, 6);
    expect(c.coveredFraction).toBeGreaterThanOrEqual(0.999);
  });

  it('an outline half outside is partial, and says how much', () => {
    const c = plotOutlineCoverage(relief, square(E0 + 10 * M, N0, 20 * M)); // x 10..30 × y 0..20 over a 0..20 m relief
    expect(c.verdict).toBe('partial');
    expect(c.coveredFraction).toBeCloseTo(0.5, 6);
  });

  it('an outline somewhere else (another system / another place) is disjoint — never shifted', () => {
    const c = plotOutlineCoverage(relief, square(1_000 * M, 2_000 * M, 30 * M));
    expect(c).toMatchObject({ verdict: 'disjoint', coveredAreaM2: 0, coveredFraction: 0 });
  });
});

/** A published snapshot: a (2·5+1)² grid, 1 m spacing, centred on 0, ground z = 100 + 0.1·x. */
function snapshot(): ListingTerrainSnapshot {
  const n = 11;
  const positions: number[] = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) positions.push(i - 5, j - 5, 100 + 0.1 * (i - 5));
  const triangles: number[] = [];
  for (let j = 0; j + 1 < n; j++) {
    for (let i = 0; i + 1 < n; i++) {
      const a = j * n + i;
      triangles.push(a, a + 1, a + n + 1, a, a + n + 1, a + n);
    }
  }
  return {
    version: 2,
    mesh: { positions, triangles, slopeClass: new Array(triangles.length / 3).fill(1) },
    contours: [],
    contourIntervalM: 0.5,
    contourMajorEvery: 5,
    slopeBandsPct: [5, 15, 25],
    boundary: null,
    stats: { planAreaM2: 100, minElevationM: 99.5, maxElevationM: 100.5, reliefM: 1, meanSlopePct: 10, maxSlopePct: 10, downslopeAzimuthDeg: 270 },
    envelope: null,
    envelopeOmission: null,
    plotOutline: null,
    plotOutlineOmission: null,
  };
}

describe('Ν — drape (Π7)', () => {
  const index = terrainInspectIndexOf(snapshot());

  it('a ring on the relief is one closed run, every point on the surface', () => {
    const draped = drapePlotOutline(index, [{ x: -2.5, y: -2.5 }, { x: 2.5, y: -2.5 }, { x: 2.5, y: 2.5 }, { x: -2.5, y: 2.5 }]);
    expect(draped.runs).toHaveLength(1);
    const [run] = draped.runs;
    const [first, last] = [run[0], run[run.length - 1]];
    expect(last.x).toBeCloseTo(first.x, 9);
    expect(last.y).toBeCloseTo(first.y, 9);
    expect(run.length).toBeGreaterThan(5); // cut at every triangle edge, not just the four corners
    for (const p of run) expect(p.z).toBeCloseTo(100 + 0.1 * p.x, 9);
    expect(draped.drapedFraction).toBeCloseTo(1, 9);
  });

  it('a ring that leaves the relief is broken there, and nothing is drawn outside it', () => {
    const draped = drapePlotOutline(index, [{ x: 0, y: -2 }, { x: 9, y: -2 }, { x: 9, y: 2 }, { x: 0, y: 2 }]);
    expect(draped.runs).toHaveLength(1); // one stretch on the relief: x 0..5 below, across the start, x 5..0 above
    for (const p of draped.runs[0]) expect(p.x).toBeLessThanOrEqual(5 + 1e-9);
    expect(draped.drapedFraction).toBeGreaterThan(0.3);
    expect(draped.drapedFraction).toBeLessThan(0.7);
  });
});
