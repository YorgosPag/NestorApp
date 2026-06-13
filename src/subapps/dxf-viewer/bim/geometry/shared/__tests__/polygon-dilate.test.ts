/**
 * ADR-449 Slice 6 — dilatePolygonOutward unit tests.
 *
 * Επαληθεύει: outward offset ορθογωνίου ακριβώς κατά `d` σε κάθε παρειά· winding-
 * agnostic (CW & CCW ίδιο αποτέλεσμα)· d≤0 / <3 κορυφές = no-op αντίγραφο· το κέντρο
 * παραμένει σταθερό (συμμετρική μεγέθυνση).
 */

import { dilatePolygonOutward } from '../polygon-dilate';
import type { Pt2 } from '../segment-polygon-coverage';

/** Bounding box helper. */
function bbox(poly: Pt2[]) {
  const xs = poly.map((p) => p.x);
  const ys = poly.map((p) => p.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

// 100×100 τετράγωνο κεντραρισμένο στο (0,0), CCW.
const SQUARE_CCW: Pt2[] = [
  { x: -50, y: -50 },
  { x: 50, y: -50 },
  { x: 50, y: 50 },
  { x: -50, y: 50 },
];

describe('dilatePolygonOutward (ADR-449 Slice 6)', () => {
  it('ορθογώνιο: κάθε παρειά μετατοπίζεται ΑΚΡΙΒΩΣ κατά d προς τα έξω', () => {
    const out = dilatePolygonOutward(SQUARE_CCW, 10);
    const b = bbox(out);
    expect(b.minX).toBeCloseTo(-60, 6);
    expect(b.maxX).toBeCloseTo(60, 6);
    expect(b.minY).toBeCloseTo(-60, 6);
    expect(b.maxY).toBeCloseTo(60, 6);
  });

  it('winding-agnostic: CW δίνει ίδιο bbox με CCW', () => {
    const cw = [...SQUARE_CCW].reverse();
    const bCw = bbox(dilatePolygonOutward(cw, 10));
    const bCcw = bbox(dilatePolygonOutward(SQUARE_CCW, 10));
    expect(bCw.minX).toBeCloseTo(bCcw.minX, 6);
    expect(bCw.maxX).toBeCloseTo(bCcw.maxX, 6);
  });

  it('d = 0 → no-op (ίδιες κορυφές)', () => {
    const out = dilatePolygonOutward(SQUARE_CCW, 0);
    expect(out).toEqual(SQUARE_CCW);
  });

  it('d < 0 → no-op (δεν συρρικνώνει)', () => {
    expect(dilatePolygonOutward(SQUARE_CCW, -5)).toEqual(SQUARE_CCW);
  });

  it('<3 κορυφές → αμετάβλητο αντίγραφο', () => {
    const seg: Pt2[] = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
    expect(dilatePolygonOutward(seg, 10)).toEqual(seg);
  });

  it('μη-τετράγωνο ορθογώνιο (επιμήκη δοκάρι): offset d σε όλες τις πλευρές', () => {
    const rect: Pt2[] = [
      { x: 0, y: -25 },
      { x: 300, y: -25 },
      { x: 300, y: 25 },
      { x: 0, y: 25 },
    ];
    const b = bbox(dilatePolygonOutward(rect, 8));
    expect(b.minX).toBeCloseTo(-8, 6);
    expect(b.maxX).toBeCloseTo(308, 6);
    expect(b.minY).toBeCloseTo(-33, 6);
    expect(b.maxY).toBeCloseTo(33, 6);
  });
});
