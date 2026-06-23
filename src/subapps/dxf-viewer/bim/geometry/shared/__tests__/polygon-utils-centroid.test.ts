/**
 * polygonAreaCentroid — true area centroid (shoelace) vs vertex-mean.
 * Κρίσιμο για κοίλα/μη-συμμετρικά αποτυπώματα (L/T/U) όπου ο μέσος όρος κορυφών
 * ≠ κέντρο μάζας (π.χ. τοποθέτηση θεμελίου κάτω από το load resultant).
 */

import { polygonAreaCentroid, polygonCentroid } from '../polygon-utils';

type V = { x: number; y: number; z: number };
const v = (x: number, y: number): V => ({ x, y, z: 0 });

describe('polygonAreaCentroid', () => {
  it('square → ίδιο με το γεωμετρικό κέντρο (= vertex-mean)', () => {
    const sq = [v(0, 0), v(100, 0), v(100, 100), v(0, 100)];
    const c = polygonAreaCentroid(sq);
    expect(c.x).toBeCloseTo(50);
    expect(c.y).toBeCloseTo(50);
    // Για συμμετρικό ορθογώνιο area-centroid == vertex-mean.
    const vm = polygonCentroid(sq);
    expect(c.x).toBeCloseTo(vm.x);
    expect(c.y).toBeCloseTo(vm.y);
  });

  it('triangle → centroid στο 1/3 (όχι vertex-mean… που τυχαίνει ίδιο για τρίγωνο)', () => {
    const tri = [v(0, 0), v(90, 0), v(0, 90)];
    const c = polygonAreaCentroid(tri);
    expect(c.x).toBeCloseTo(30);
    expect(c.y).toBeCloseTo(30);
  });

  it('L-shape → area-centroid ≠ vertex-mean (μετατοπισμένο προς τη μάζα)', () => {
    // L: κάτω βραχίονας x[651,1651] y[250,500] + αριστ. βραχίονας x[651,901] y[500,1250].
    const l = [
      v(651.4, 250), v(1651.4, 250), v(1651.4, 500),
      v(901.4, 500), v(901.4, 1250), v(651.4, 1250),
    ];
    const area = polygonAreaCentroid(l);
    const vm = polygonCentroid(l);
    // Αναλυτικά (δύο ορθογώνια): area-centroid ≈ (990.7, 589.3).
    expect(area.x).toBeCloseTo(990.7, 0);
    expect(area.y).toBeCloseTo(589.3, 0);
    // Vertex-mean = (1068.07, 666.67) — σαφώς διαφορετικό.
    expect(vm.x).toBeCloseTo(1068.07, 1);
    expect(vm.y).toBeCloseTo(666.67, 1);
    expect(Math.abs(area.x - vm.x)).toBeGreaterThan(50);
    expect(Math.abs(area.y - vm.y)).toBeGreaterThan(50);
  });

  it('winding-invariant (CW footprint → ίδιο centroid με CCW)', () => {
    const ccw = [v(0, 0), v(100, 0), v(100, 40), v(0, 40)];
    const cw = [...ccw].reverse();
    const a = polygonAreaCentroid(ccw);
    const b = polygonAreaCentroid(cw);
    expect(a.x).toBeCloseTo(b.x);
    expect(a.y).toBeCloseTo(b.y);
  });

  it('degenerate (< 3 κορυφές ή μηδενικό εμβαδόν) → fallback στον vertex-mean', () => {
    const seg = [v(0, 0), v(10, 0)];
    expect(polygonAreaCentroid(seg)).toEqual(polygonCentroid(seg));
    // Collinear (μηδενικό εμβαδόν) → fallback.
    const collinear = [v(0, 0), v(10, 0), v(20, 0)];
    const c = polygonAreaCentroid(collinear);
    expect(c).toEqual(polygonCentroid(collinear));
  });
});
