/**
 * ADR-884 Φ2στ-γ Γ3 — ορθογώνια έλξη περιγράμματος: γωνίες 90° σε στραμμένη κάτοψη, λοξοί τοίχοι μένουν λοξοί,
 * δίχτυ ασφαλείας (ποτέ «ωραιότερο αλλά λάθος»).
 */

import { polygonArea, type PlanarPoint } from '../planar-polygon';
import { DEFAULT_ORTHOGONAL_SNAP, dominantAxis, snapRingOrthogonal } from '../orthogonal-snap';

const deg = (d: number): number => (d * Math.PI) / 180;

function rotate(points: readonly PlanarPoint[], angle: number): PlanarPoint[] {
  const c = Math.cos(angle), s = Math.sin(angle);
  return points.map((p) => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c }));
}

/** Γωνία (μοίρες) στην κορυφή i. */
function cornerDeg(ring: readonly PlanarPoint[], i: number): number {
  const a = ring[(i + ring.length - 1) % ring.length], b = ring[i], c = ring[(i + 1) % ring.length];
  const v1 = { x: a.x - b.x, y: a.y - b.y }, v2 = { x: c.x - b.x, y: c.y - b.y };
  const cos = (v1.x * v2.x + v1.y * v2.y) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y));
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

// Ορθογώνιο 10×6 με ακμές λίγο στραβές (≈ 1–3°) — όπως βγαίνει από pixel.
const WONKY = [{ x: 0, y: 0 }, { x: 10, y: 0.3 }, { x: 10.2, y: 6 }, { x: 0.1, y: 5.8 }];

describe('orthogonal-snap', () => {
  it('κυρίαρχος άξονας: στραμμένη κάτοψη 20° ⇒ 20°', () => {
    expect(dominantAxis(rotate(WONKY, deg(20)))).toBeCloseTo(deg(20), 1);
  });

  it('στραβό ορθογώνιο (και στραμμένο) ⇒ 4 ορθές γωνίες', () => {
    for (const angle of [0, 20, 63]) {
      const out = snapRingOrthogonal(rotate(WONKY, deg(angle)));
      expect(out).not.toBeNull();
      expect(out).toHaveLength(4);
      for (let i = 0; i < 4; i++) expect(cornerDeg(out as PlanarPoint[], i)).toBeCloseTo(90, 6);
    }
  });

  it('σχήμα Γ: 6 κορυφές, όλες 90° (κυρτές και κοίλες)', () => {
    const L = [{ x: 0, y: 0 }, { x: 8, y: 0.1 }, { x: 8, y: 3 }, { x: 3.1, y: 3 }, { x: 3, y: 7 }, { x: 0, y: 7.1 }];
    const out = snapRingOrthogonal(L) as PlanarPoint[];
    expect(out).toHaveLength(6);
    for (let i = 0; i < 6; i++) expect(cornerDeg(out, i)).toBeCloseTo(90, 6);
  });

  it('λοξός τοίχος 45° ΔΕΝ ισιώνεται ψεύτικα', () => {
    const chamfer = [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 4 }, { x: 4, y: 8 }, { x: 0, y: 8 }];
    const out = snapRingOrthogonal(chamfer) as PlanarPoint[];
    expect(out).toHaveLength(5);
    expect(cornerDeg(out, 2)).toBeCloseTo(135, 6);
  });

  it('μετατόπιση προς τα έξω: εμβαδόν μεγαλώνει ≈ περίμετρος × μετατόπιση, σε ΟΠΟΙΑ φορά κι αν δοθεί', () => {
    const rect = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 6 }, { x: 0, y: 6 }];
    for (const ring of [rect, [...rect].reverse()]) {
      const out = snapRingOrthogonal(ring, { ...DEFAULT_ORTHOGONAL_SNAP, outset: 0.5 }) as PlanarPoint[];
      expect(polygonArea(out)).toBeCloseTo(11 * 7, 9);
    }
  });

  it('δίχτυ ασφαλείας: όταν η έλξη αλλάζει πολύ το σχήμα ⇒ null (ο καλών κρατά το αρχικό)', () => {
    // Πεπλατυσμένο τρίγωνο: οι δύο μακριές ακμές (±8,5°) θα γίνονταν ΜΙΑ οριζόντια — δεν είναι πια σχήμα.
    const flat = [{ x: 0, y: 0 }, { x: 10, y: 1.5 }, { x: 0, y: 3 }];
    expect(snapRingOrthogonal(flat)).toBeNull();
    expect(snapRingOrthogonal(flat.slice(0, 2))).toBeNull();
  });
});
