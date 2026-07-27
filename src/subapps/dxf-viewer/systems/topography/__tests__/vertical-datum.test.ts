/**
 * ADR-650 M10c — the project vertical datum resolver. Ground truth by hand: the datum under a
 * point is exactly the barycentric ground elevation there (the value the surface IS), and off the
 * surface it is the mid-height, so an un-surveyed building origin centres the hill instead of
 * floating it.
 */

import {
  resolveVerticalDatumMm,
  surfaceElevationAtWorldYMm,
  TERRAIN_DISPLAY_DROP_MM,
} from '../vertical-datum';
import type { TinSurface } from '../topo-types';

const SIDE_MM = 10_000;

/** 10 m × 10 m, two CCW triangles, elevations from `zAt` (WORLD mm). */
function squareTin(zAt: (x: number, y: number) => number): TinSurface {
  const positions: [number, number][] = [
    [0, 0],
    [SIDE_MM, 0],
    [SIDE_MM, SIDE_MM],
    [0, SIDE_MM],
  ];
  const elevations = positions.map(([x, y]) => zAt(x, y));
  return {
    positions,
    elevations,
    triangles: [
      [0, 1, 2],
      [0, 2, 3],
    ],
    origin: { x: 0, y: 0 },
    bounds: {
      minX: 0,
      minY: 0,
      maxX: SIDE_MM,
      maxY: SIDE_MM,
      minZ: Math.min(...elevations),
      maxZ: Math.max(...elevations),
    },
    flatTriangleCount: 0,
  };
}

const EMPTY_TIN: TinSurface = {
  positions: [],
  elevations: [],
  triangles: [],
  origin: { x: 0, y: 0 },
  bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0, minZ: 0, maxZ: 0 },
  flatTriangleCount: 0,
};

describe('resolveVerticalDatumMm', () => {
  it('flat ground → datum is that constant elevation under the origin', () => {
    const tin = squareTin(() => 106_000); // +106.00 m everywhere (a floating ΕΓΣΑ survey)
    expect(resolveVerticalDatumMm(tin, 5000, 5000)).toBeCloseTo(106_000, 3);
  });

  it('sloping ground → datum is the exact barycentric elevation at the origin, not an average', () => {
    const tin = squareTin((x) => 100_000 + x); // +1 mm per mm of x: 100 000..110 000
    // At x = 2500 the ground is 102 500; the datum must read the ground THERE, not the mean.
    expect(resolveVerticalDatumMm(tin, 2500, 5000)).toBeCloseTo(102_500, 3);
  });

  it('origin OUTSIDE the surveyed area → mid-height (centre the hill, do not float it)', () => {
    const tin = squareTin((x) => 100_000 + x); // minZ 100 000, maxZ 110 000 → mid 105 000
    expect(resolveVerticalDatumMm(tin, -50_000, -50_000)).toBeCloseTo(105_000, 3);
  });

  it('empty surface → 0 (no datum to acquire)', () => {
    expect(resolveVerticalDatumMm(EMPTY_TIN, 0, 0)).toBe(0);
  });
});

/**
 * ADR-665 M2.3 — η ΑΝΤΙΣΤΡΟΦΗ του κατακόρυφου display frame.
 *
 * Ο ευθύς δρόμος έχει ΔΥΟ σκαλοπάτια: το datum (στον converter του TIN) και το display drop
 * (στην έδραση του topo root). Το δεύτερο είναι αυτό που ξεχνιέται — και η παράλειψή του δεν
 * φαίνεται ως σφάλμα αριθμού αλλά ως cap ξεκολλημένος 5 cm από την ακμή της τομής, δηλαδή ως
 * «χαλασμένο render». Γι' αυτό εδώ υπάρχει τεστ που σκάει αν κάποιος βγάλει το drop από τον τύπο.
 */
describe('surfaceElevationAtWorldYMm — ADR-665 M2.3', () => {
  /**
   * Ο ΕΥΘΥΣ δρόμος, γραμμένος ανεξάρτητα εδώ: ακριβώς ό,τι κάνουν ο converter του αναγλύφου
   * (υψόμετρο − datum, mm → m) και η έδραση του topo root (μετατόπιση κατά το drop).
   */
  const renderedWorldY = (elevMm: number, datumMm: number): number =>
    (elevMm - datumMm) / 1000 - TERRAIN_DISPLAY_DROP_MM / 1000;

  it('ROUND-TRIP: υψόμετρο → world Y → υψόμετρο, με datum ≠ 0', () => {
    const datumMm = 106_000;
    for (const elevMm of [0, 106_000, 107_250, 99_000, -3_000]) {
      expect(surfaceElevationAtWorldYMm(renderedWorldY(elevMm, datumMm), datumMm))
        .toBeCloseTo(elevMm, 6);
    }
  });

  it('ROUND-TRIP και με datum = 0 (μη γεωαναφερμένο έργο)', () => {
    expect(surfaceElevationAtWorldYMm(renderedWorldY(2_500, 0), 0)).toBeCloseTo(2_500, 6);
  });

  it('το DISPLAY DROP ΣΥΜΜΕΤΕΧΕΙ — χωρίς αυτό η στάθμη πέφτει λάθος κατά ακριβώς το drop', () => {
    const withoutDrop = 0 * 1000 + 106_000; // ο ίδιος τύπος ΧΩΡΙΣ τον όρο του drop
    expect(surfaceElevationAtWorldYMm(0, 106_000) - withoutDrop)
      .toBeCloseTo(TERRAIN_DISPLAY_DROP_MM, 9);
  });

  it('η στάθμη ανεβαίνει γραμμικά με το world Y (1 m → 1000 mm)', () => {
    expect(surfaceElevationAtWorldYMm(1, 0) - surfaceElevationAtWorldYMm(0, 0))
      .toBeCloseTo(1000, 9);
  });
});
