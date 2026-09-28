/**
 * ADR-884 Φ2στ-γ Γ3 — Douglas–Peucker σε κλειστό δακτύλιο (δύο αλυσίδες), ΕΝΑ σπίτι για `geo-simplify` και
 * `mesh-silhouette`.
 */

import { distanceToSegment } from '../planar-polygon';
import { closedRingKeepMask, simplifyClosedRing, simplifyPolyline } from '../douglas-peucker';
import { isPointInPolygon, simplifyPolygon } from '@core/polygon-system/utils/polygon-utils';
import type { UniversalPolygon } from '@core/polygon-system/types';

/** Ορθογώνιο 10×6 με πυκνές κορυφές και θόρυβο ±0,02 στις ακμές. */
function noisyRectangle(): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  const wobble = (i: number): number => (i % 2 === 0 ? 0.02 : -0.02);
  for (let i = 0; i < 10; i++) pts.push({ x: i, y: wobble(i) });
  for (let i = 0; i < 6; i++) pts.push({ x: 10 + wobble(i), y: i });
  for (let i = 10; i > 0; i--) pts.push({ x: i, y: 6 + wobble(i) });
  for (let i = 6; i > 0; i--) pts.push({ x: wobble(i), y: i });
  return pts;
}

describe('douglas-peucker (κλειστός δακτύλιος)', () => {
  it('θορυβώδες ορθογώνιο ⇒ ακριβώς οι 4 γωνίες', () => {
    const out = simplifyClosedRing(noisyRectangle(), 0.1);
    expect(out).toHaveLength(4);
  });

  it('ΕΓΓΥΗΣΗ: κάθε κορυφή που φεύγει απέχει ≤ ανοχή από το απλοποιημένο σύνορο', () => {
    const ring = noisyRectangle();
    const keep = closedRingKeepMask(ring, 0.1);
    const kept = ring.filter((_, i) => keep[i]);
    for (const p of ring) {
      const nearest = Math.min(...kept.map((a, i) => distanceToSegment(p, a, kept[(i + 1) % kept.length])));
      expect(nearest).toBeLessThanOrEqual(0.1 + 1e-12);
    }
  });

  it('η ακμή «τελευταία → πρώτη» απλοποιείται κι αυτή (δύο αλυσίδες, όχι πρώτη–τελευταία ως άκρα)', () => {
    // Η πρώτη κορυφή στη ΜΕΣΗ της κάτω ακμής: με «πρώτη–τελευταία» ως άκρα θα έμενε σαν γωνία.
    const ring = [{ x: 5, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 6 }, { x: 0, y: 6 }, { x: 0, y: 0 }, { x: 2, y: 0 }];
    const out = simplifyClosedRing(ring, 0.01);
    expect(out.filter((p) => p.y === 0 && p.x > 0 && p.x < 10)).toHaveLength(1); // μόνο η σταθερή πρώτη
    expect(out).toHaveLength(5);
  });

  it('ανοιχτή γραμμή: τα άκρα μένουν πάντα · το polygon-system καλεί το SSoT (κλειστό = δακτύλιος)', () => {
    const line = [{ x: 0, y: 0 }, { x: 5, y: 0.01 }, { x: 10, y: 0 }, { x: 10, y: 6 }];
    expect(simplifyPolyline(line, 0.1)).toEqual([line[0], line[2], line[3]]);
    const polygon = (points: { x: number; y: number }[], isClosed: boolean): UniversalPolygon => ({
      id: 'p', type: 'simple', points, isClosed,
      style: { strokeColor: 'x', fillColor: 'x', strokeWidth: 1, fillOpacity: 1, strokeOpacity: 1 },
    });
    const closed = simplifyPolygon(polygon(noisyRectangle(), true), 0.1);
    expect(closed.points).toHaveLength(4);
    expect(simplifyPolygon(polygon(line, false), 0.1).points).toHaveLength(3);
    expect(isPointInPolygon({ x: 5, y: 3 }, polygon(closed.points, true))).toBe(true);
    expect(isPointInPolygon({ x: 5, y: 3 }, polygon(closed.points, false))).toBe(false);
  });

  it('μηδενική ανοχή ή < 3 κορυφές ⇒ όλες μένουν', () => {
    const ring = noisyRectangle();
    expect(simplifyClosedRing(ring, 0)).toHaveLength(ring.length);
    expect(closedRingKeepMask(ring.slice(0, 2), 1)).toEqual([true, true]);
  });
});
