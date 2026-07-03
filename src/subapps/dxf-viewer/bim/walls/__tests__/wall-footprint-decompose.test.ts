/**
 * ADR-363 — spec tests για `decomposeWallsFromFootprint` (pure geometry).
 *
 * Κωδικοποιούν την ΣΩΣΤΗ αποσύνθεση αποτυπώματος τοίχων σε μεμονωμένους τοίχους
 * (ζεύγη αντικριστών παρειών· κοπή σε κόμβους/αλλαγές πάχους· μακρύτερος κερδίζει
 * τον κόμβο) — σε αντιδιαστολή με το slab-sweep που έκοβε λάθος κατά μήκος.
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { DetectedRectangle } from '../wall-in-region';
import { decomposeWallsFromFootprint } from '../wall-footprint-decompose';

const TOL = 5;

/** {shortSide, longSide} στρογγυλεμένα, ταξινομημένα (order-independent). */
function sortedPairs(rects: readonly DetectedRectangle[]): number[][] {
  return rects
    .map((r) => {
      const a = Math.round(r.shortSide);
      const b = Math.round(r.longSide);
      return a <= b ? [a, b] : [b, a];
    })
    .sort((p, q) => p[0] - q[0] || p[1] - q[1]);
}

describe('decomposeWallsFromFootprint', () => {
  it('CASE 1 — ομοιόμορφο ορθογώνιο → 1 τοίχος (πάχος 300, μήκος 2000)', () => {
    const poly: Point2D[] = [
      { x: 0, y: 0 },
      { x: 2000, y: 0 },
      { x: 2000, y: 300 },
      { x: 0, y: 300 },
    ];
    const walls = decomposeWallsFromFootprint(poly, TOL);
    expect(walls).toHaveLength(1);
    expect(sortedPairs(walls)).toEqual([[300, 2000]]);
  });

  it('CASE 2 — διαφορετικό πάχος σε σειρά, κοινή κάτω παρειά → 2 τοίχοι (ΟΧΙ strip-split)', () => {
    const poly: Point2D[] = [
      { x: 0, y: 0 },
      { x: 2700, y: 0 },
      { x: 2700, y: 100 },
      { x: 1750, y: 100 },
      { x: 1750, y: 150 },
      { x: 0, y: 150 },
    ];
    const walls = decomposeWallsFromFootprint(poly, TOL);
    expect(walls).toHaveLength(2);
    // {πάχος 150, μήκος 1750} + {πάχος 100, μήκος 950}
    expect(sortedPairs(walls)).toEqual([
      [100, 950],
      [150, 1750],
    ]);
  });

  it('CASE 3 — offset-T: ο μακρύτερος οριζόντιος κρατά τον κόμβο, το stub σταματά στην παρειά', () => {
    const poly: Point2D[] = [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000, y: -400 },
      { x: 1450, y: -400 },
      { x: 1450, y: 0 },
      { x: 2700, y: 0 },
      { x: 2700, y: 200 },
      { x: 0, y: 200 },
    ];
    const walls = decomposeWallsFromFootprint(poly, TOL);
    expect(walls).toHaveLength(2);
    // {πάχος 200, μήκος 2700} (πλήρης οριζόντιος) + {πάχος 450, μήκος 400} (stub y:-400→0)
    expect(sortedPairs(walls)).toEqual([
      [200, 2700],
      [400, 450],
    ]);
  });

  it('CASE 4 — κανονικό T (κεντραρισμένο stub): ο κόμβος ανήκει στον οριζόντιο', () => {
    const poly: Point2D[] = [
      { x: 0, y: 0 },
      { x: 3000, y: 0 },
      { x: 3000, y: 300 },
      { x: 1650, y: 300 },
      { x: 1650, y: 1200 },
      { x: 1350, y: 1200 },
      { x: 1350, y: 300 },
      { x: 0, y: 300 },
    ];
    const walls = decomposeWallsFromFootprint(poly, TOL);
    expect(walls).toHaveLength(2);
    // {πάχος 300, μήκος 3000} + {πάχος 300, μήκος 900} (stub y:300→1200)
    expect(sortedPairs(walls)).toEqual([
      [300, 900],
      [300, 3000],
    ]);
  });

  it('μη-ορθογωνικό πολύγωνο (γωνίες ≠ 90°) → []', () => {
    const poly: Point2D[] = [
      { x: 0, y: 0 },
      { x: 2000, y: 0 },
      { x: 1000, y: 800 },
    ];
    expect(decomposeWallsFromFootprint(poly, TOL)).toEqual([]);
  });
});
