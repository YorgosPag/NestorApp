/**
 * `minPolygonInteriorAngleDeg` — SSoT για την ελάχιστη γωνία κορυφής πολυγώνου
 * (ADR-449 free-reshape acute-sliver guard· REUSE angleBetweenVectors + radToDeg).
 */

import { minPolygonInteriorAngleDeg } from '../polygon-utils';

describe('minPolygonInteriorAngleDeg', () => {
  it('τετράγωνο → 90°', () => {
    const sq = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
    expect(minPolygonInteriorAngleDeg(sq)).toBeCloseTo(90, 3);
  });

  it('αιχμηρή σφήνα (τρίγωνο) → πολύ μικρή γωνία (< 5°)', () => {
    const sliver = [{ x: -200, y: -10 }, { x: 200, y: 0 }, { x: -200, y: 10 }];
    expect(minPolygonInteriorAngleDeg(sliver)).toBeLessThan(5);
  });

  it('reflex γωνία «Γ» (L-shape) → ελάχιστη = 90° (η 270° μετριέται ως 90°)', () => {
    // 6-vertex L· όλες οι γωνίες είναι 90° ή 270° → min = 90.
    const L = [
      { x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 60 },
      { x: 60, y: 60 }, { x: 60, y: 200 }, { x: 0, y: 200 },
    ];
    expect(minPolygonInteriorAngleDeg(L)).toBeCloseTo(90, 3);
  });

  it('< 3 κορυφές → 180 (no-op)', () => {
    expect(minPolygonInteriorAngleDeg([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(180);
  });
});
