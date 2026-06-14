/**
 * ADR-449 #2/#C — wall-end ↔ column pull-back (3Δ z-fight fix, μηδέν geometry μέσα στην
 * κολόνα → δεν διαρρέει στο cut-plane fast-path) pure SSoT test.
 */

import { pullBackStraightWallEndsFromColumns } from '../wall-column-pullback-3d';
import type { Point3D } from '../../../bim/types/bim-base';

const p = (x: number, y: number): Point3D => ({ x, y, z: 0 });

// Ίσιος τοίχος κατά +X, πάχος 1 (outer@y=−0.5, inner@y=+0.5), axis κατά x=0..10.
const GEO = {
  outerEdge: { points: [p(0, -0.5), p(10, -0.5)] },
  innerEdge: { points: [p(0, 0.5), p(10, 0.5)] },
  axisPolyline: { points: [p(0, 0), p(10, 0)] },
};
const START = p(0, 0);
const END = p(10, 0);

// Κολόνα ΔΥΤΙΚΑ της start: ανατολική παρειά x=0 → η start (0,0) κουμπώνει flush.
const COL_AT_START: Point3D[] = [p(-1, -1), p(0, -1), p(0, 1), p(-1, 1)];
// Κολόνα ΑΝΑΤΟΛΙΚΑ της end: δυτική παρειά x=10 → η end (10,0) κουμπώνει flush.
const COL_AT_END: Point3D[] = [p(10, -1), p(11, -1), p(11, 1), p(10, 1)];

const PULLBACK = 0.5;
const TOL = 0.01;

describe('pullBackStraightWallEndsFromColumns', () => {
  it('start κουμπώνει σε κολόνα → start-side υποχωρεί ΜΑΚΡΙΑ της (+axis), end αμετάβλητο', () => {
    const r = pullBackStraightWallEndsFromColumns(GEO, START, END, [COL_AT_START], PULLBACK, TOL);
    expect(r).not.toBeNull();
    // start μετατοπίζεται κατά +x·0.5 → x=+0.5 (ΕΞΩ από την κολόνα [-1,0] → μηδέν geometry μέσα).
    expect(r!.start.x).toBeCloseTo(0.5, 9);
    expect(r!.outer[0].x).toBeCloseTo(0.5, 9);
    expect(r!.inner[0].x).toBeCloseTo(0.5, 9);
    expect(r!.axis[0].x).toBeCloseTo(0.5, 9);
    // end side αμετάβλητο.
    expect(r!.end.x).toBe(10);
    expect(r!.outer[1].x).toBe(10);
  });

  it('καμία άκρη δεν κουμπώνει → null (no-op, ο caller κρατά το αρχικό wall)', () => {
    const far: Point3D[] = [p(5, 5), p(6, 5), p(6, 6), p(5, 6)];
    expect(pullBackStraightWallEndsFromColumns(GEO, START, END, [far], PULLBACK, TOL)).toBeNull();
  });

  it('και οι δύο άκρες κουμπώνουν → υποχωρούν και οι δύο προς το κέντρο (ο τοίχος κονταίνει)', () => {
    const r = pullBackStraightWallEndsFromColumns(GEO, START, END, [COL_AT_START, COL_AT_END], PULLBACK, TOL);
    expect(r).not.toBeNull();
    expect(r!.start.x).toBeCloseTo(0.5, 9); // +axis (μέσα)
    expect(r!.end.x).toBeCloseTo(9.5, 9); // −axis (μέσα)
    expect(r!.axis[1].x).toBeCloseTo(9.5, 9);
  });

  it('κενή λίστα κολόνων ή μηδενικό pull-back → null', () => {
    expect(pullBackStraightWallEndsFromColumns(GEO, START, END, [], PULLBACK, TOL)).toBeNull();
    expect(pullBackStraightWallEndsFromColumns(GEO, START, END, [COL_AT_START], 0, TOL)).toBeNull();
  });

  it('εκφυλισμένος τοίχος (μηδενικό μήκος) → null', () => {
    const zero = { ...GEO, axisPolyline: { points: [p(0, 0), p(0, 0)] } };
    expect(pullBackStraightWallEndsFromColumns(zero, p(0, 0), p(0, 0), [COL_AT_START], PULLBACK, TOL)).toBeNull();
  });
});
