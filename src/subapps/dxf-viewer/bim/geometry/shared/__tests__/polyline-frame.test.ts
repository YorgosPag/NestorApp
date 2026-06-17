/**
 * ADR-471 Slice 2 — tests για τον polyline arc-length frame sampler (geometry SSoT).
 *
 * Καλύπτει: μήκος, point/tangent/normal σε ευθεία & τεθλασμένη, clamp στα άκρα,
 * εκφυλισμένες ακμές, και τη θεμελιώδη αρχή world(u,v) = point + v·normal.
 */

import { polylineLength, samplePolylineFrame } from '../polyline-frame';

const EPS = 1e-9;

describe('polylineLength', () => {
  it('επιστρέφει 0 για <2 σημεία', () => {
    expect(polylineLength([])).toBe(0);
    expect(polylineLength([{ x: 5, y: 5 }])).toBe(0);
  });

  it('αθροίζει τις ευκλείδειες ακμές', () => {
    expect(polylineLength([{ x: 0, y: 0 }, { x: 3, y: 4 }])).toBeCloseTo(5);
    expect(polylineLength([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }])).toBeCloseTo(20);
  });
});

describe('samplePolylineFrame', () => {
  it('null για <2 σημεία', () => {
    expect(samplePolylineFrame([], 0)).toBeNull();
    expect(samplePolylineFrame([{ x: 1, y: 1 }], 1)).toBeNull();
  });

  it('ευθεία οριζόντια: σημείο γραμμικής παρεμβολής + tangent +x + normal +y', () => {
    const line = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
    const f = samplePolylineFrame(line, 25);
    expect(f).not.toBeNull();
    expect(f!.point.x).toBeCloseTo(25);
    expect(f!.point.y).toBeCloseTo(0);
    expect(f!.tangent.x).toBeCloseTo(1);
    expect(f!.tangent.y).toBeCloseTo(0);
    // CCW 90° του (1,0) = (0,1)
    expect(f!.normal.x).toBeCloseTo(0);
    expect(f!.normal.y).toBeCloseTo(1);
  });

  it('μοναδιαίος tangent & normal (κάθετα μεταξύ τους) σε λοξή ακμή', () => {
    const f = samplePolylineFrame([{ x: 0, y: 0 }, { x: 3, y: 4 }], 2.5)!;
    expect(Math.hypot(f.tangent.x, f.tangent.y)).toBeCloseTo(1);
    expect(Math.hypot(f.normal.x, f.normal.y)).toBeCloseTo(1);
    // dot(tangent, normal) = 0
    expect(f.tangent.x * f.normal.x + f.tangent.y * f.normal.y).toBeLessThan(1e-9);
    // tangent = (0.6, 0.8) → point στο 2.5 = (1.5, 2.0)
    expect(f.point.x).toBeCloseTo(1.5);
    expect(f.point.y).toBeCloseTo(2.0);
  });

  it('clamp: distance ≤ 0 → πρώτο σημείο· distance ≥ μήκος → τελευταίο', () => {
    const line = [{ x: 10, y: 0 }, { x: 20, y: 0 }];
    expect(samplePolylineFrame(line, -5)!.point.x).toBeCloseTo(10);
    expect(samplePolylineFrame(line, 999)!.point.x).toBeCloseTo(20);
  });

  it('τεθλασμένη: επιλέγει τη σωστή ακμή & tangent στροφή', () => {
    // L-σχήμα: 10 κατά +x, μετά 10 κατά +y. Συνολικό μήκος 20.
    const path = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    // d=5 → πρώτη ακμή, tangent +x
    const a = samplePolylineFrame(path, 5)!;
    expect(a.point.x).toBeCloseTo(5);
    expect(a.point.y).toBeCloseTo(0);
    expect(a.tangent.x).toBeCloseTo(1);
    // d=15 → δεύτερη ακμή (5 μέσα), tangent +y, σημείο (10,5)
    const b = samplePolylineFrame(path, 15)!;
    expect(b.point.x).toBeCloseTo(10);
    expect(b.point.y).toBeCloseTo(5);
    expect(b.tangent.x).toBeCloseTo(0);
    expect(b.tangent.y).toBeCloseTo(1);
    // normal = CCW 90° του (0,1) = (-1, 0)
    expect(b.normal.x).toBeCloseTo(-1);
    expect(b.normal.y).toBeCloseTo(0);
  });

  it('world(u,v) = point + v·normal (η αρχή που τρέφει 2Δ/3Δ rebar)', () => {
    const line = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
    const f = samplePolylineFrame(line, 40)!;
    const v = 7;
    const world = { x: f.point.x + v * f.normal.x, y: f.point.y + v * f.normal.y };
    // εγκάρσια μετατόπιση 7 κάθετα σε οριζόντια ευθεία → (40, 7)
    expect(world.x).toBeCloseTo(40);
    expect(world.y).toBeCloseTo(7);
  });

  it('εκφυλισμένη ακμή (διπλό σημείο) δεν σπάει — κρατά πεπερασμένο tangent', () => {
    const path = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }];
    const f = samplePolylineFrame(path, 5)!;
    expect(Number.isFinite(f.tangent.x)).toBe(true);
    expect(Number.isFinite(f.tangent.y)).toBe(true);
    expect(Math.abs(f.tangent.x) + Math.abs(f.tangent.y)).toBeGreaterThan(EPS);
  });
});
