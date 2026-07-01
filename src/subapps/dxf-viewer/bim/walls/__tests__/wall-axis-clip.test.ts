/**
 * ADR-509 §axis-clip — wall axis clipping στην παρειά κολώνας.
 *
 * Επικυρώνει ότι ο άξονας (dashed centerline) κόβεται ΕΞΩ από τα column footprints:
 * ο τοίχος «σταματά» στην παρειά αντί να διαπερνά το σώμα (Revit/AutoCAD parity).
 */
import { clipPolylineOutsidePolygons } from '../wall-axis-clip';
import type { Pt2 } from '../../geometry/shared/segment-polygon-coverage';

/** Τετράγωνο footprint κεντραρισμένο στο (cx,cy) με half-size `h`. */
const square = (cx: number, cy: number, h: number): Pt2[] => [
  { x: cx - h, y: cy - h },
  { x: cx + h, y: cy - h },
  { x: cx + h, y: cy + h },
  { x: cx - h, y: cy + h },
];

const closeTo = (a: Pt2, b: Pt2): boolean =>
  Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;

describe('clipPolylineOutsidePolygons', () => {
  const axis: Pt2[] = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  ];

  it('χωρίς polygons → επιστρέφει τον άξονα αυτούσιο (ένα run)', () => {
    const runs = clipPolylineOutsidePolygons(axis, []);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);
  });

  it('κολώνα στη μέση → κόβει σε 2 runs (πριν + μετά την παρειά)', () => {
    const runs = clipPolylineOutsidePolygons(axis, [square(50, 0, 10)]);
    expect(runs).toHaveLength(2);
    expect(closeTo(runs[0][0], { x: 0, y: 0 })).toBe(true);
    expect(closeTo(runs[0][1], { x: 40, y: 0 })).toBe(true);
    expect(closeTo(runs[1][0], { x: 60, y: 0 })).toBe(true);
    expect(closeTo(runs[1][1], { x: 100, y: 0 })).toBe(true);
  });

  it('κολώνα εκτός άξονα → αμετάβλητος (ένα run)', () => {
    const runs = clipPolylineOutsidePolygons(axis, [square(50, 500, 10)]);
    expect(runs).toHaveLength(1);
    expect(closeTo(runs[0][0], { x: 0, y: 0 })).toBe(true);
    expect(closeTo(runs[0][1], { x: 100, y: 0 })).toBe(true);
  });

  it('άξονας ΟΛΟΣ μέσα στην κολώνα → κανένα run', () => {
    const runs = clipPolylineOutsidePolygons(axis, [square(50, 0, 200)]);
    expect(runs).toHaveLength(0);
  });

  it('άξονας ξεκινά έξω, τελειώνει μέσα → ένα run (το εκτεθειμένο κομμάτι)', () => {
    // Κολώνα καλύπτει το δεξί άκρο (κέντρο 100, half 30 → κόβει [70,100]).
    const runs = clipPolylineOutsidePolygons(axis, [square(100, 0, 30)]);
    expect(runs).toHaveLength(1);
    expect(closeTo(runs[0][0], { x: 0, y: 0 })).toBe(true);
    expect(closeTo(runs[0][1], { x: 70, y: 0 })).toBe(true);
  });

  it('δύο κολώνες στον ίδιο άξονα → 3 runs', () => {
    const runs = clipPolylineOutsidePolygons(axis, [square(30, 0, 5), square(70, 0, 5)]);
    expect(runs).toHaveLength(3);
    expect(closeTo(runs[0][1], { x: 25, y: 0 })).toBe(true);
    expect(closeTo(runs[1][0], { x: 35, y: 0 })).toBe(true);
    expect(closeTo(runs[1][1], { x: 65, y: 0 })).toBe(true);
    expect(closeTo(runs[2][0], { x: 75, y: 0 })).toBe(true);
  });

  it('multi-segment polyline χωρίς polygons → αλυσιδώνεται σε ΕΝΑ run (dash continuity)', () => {
    const poly: Pt2[] = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 },
    ];
    const runs = clipPolylineOutsidePolygons(poly, [square(200, 200, 5)]);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toHaveLength(3);
    expect(closeTo(runs[0][0], poly[0])).toBe(true);
    expect(closeTo(runs[0][2], poly[2])).toBe(true);
  });

  it('polyline < 2 σημεία → κανένα run', () => {
    expect(clipPolylineOutsidePolygons([{ x: 0, y: 0 }], [square(0, 0, 5)])).toHaveLength(0);
  });
});
