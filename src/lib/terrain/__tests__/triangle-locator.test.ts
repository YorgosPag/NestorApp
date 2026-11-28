/**
 * ADR-920 §14.12 Β3.1 — ο εντοπιστής τριγώνων απέναντι στον ΟΡΙΣΜΟ του: «το πρώτο τρίγωνο, με τη σειρά του πλέγματος, που
 * κρατά το σημείο», με τα βαρυκεντρικά βάρη της αρχικής διατύπωσης — πράξη προς πράξη. Ο επίπεδος πίνακας και οι κάδοι
 * CSR είναι αποθήκευση· οι αριθμοί που παίρνει κάθε αναγνώστης (όγκοι, επιθεώρηση, προφίλ, ψηφιδωτής) δεν αλλάζουν.
 */

import { createTriangleHitSink, createTriangleLocator, type TriangleHit } from '../triangle-locator';

type Plan = readonly (readonly [number, number])[];
type Triangles = readonly (readonly [number, number, number])[];

const EPSILON = 1e-9;

/** Η αρχική διατύπωση των βαρών — ο ορισμός, γραμμένος ανεξάρτητα από το αρχείο που ελέγχεται. */
function weightsIn(xy: Plan, [i, j, k]: readonly [number, number, number], t: number, x: number, y: number): TriangleHit | null {
  const [ax, ay] = xy[i];
  const [bx, by] = xy[j];
  const [cx, cy] = xy[k];
  const denominator = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
  if (Math.abs(denominator) < EPSILON) return null;
  const wa = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / denominator;
  const wb = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / denominator;
  const wc = 1 - wa - wb;
  return wa < -EPSILON || wb < -EPSILON || wc < -EPSILON ? null : { triangle: t, wa, wb, wc };
}

/** Εξαντλητικά, με τη σειρά του πλέγματος. */
function firstHolding(xy: Plan, triangles: Triangles, x: number, y: number): TriangleHit | null {
  for (let t = 0; t < triangles.length; t++) {
    const hit = weightsIn(xy, triangles[t], t, x, y);
    if (hit !== null) return hit;
  }
  return null;
}

/** Κάνναβος `n × n` κελιών πλευράς `step`, κάθε κελί δύο τρίγωνα, με κορυφές ελαφρά μετατοπισμένες (όχι ομοιόμορφο). */
function meshOf(n: number, step: number): { xy: Plan; triangles: Triangles } {
  const xy: [number, number][] = [];
  for (let r = 0; r <= n; r++) {
    for (let c = 0; c <= n; c++) {
      const inner = r > 0 && r < n && c > 0 && c < n;
      const wobble = inner ? 0.15 * step * Math.sin(r * 12.9898 + c * 78.233) : 0;
      xy.push([c * step + wobble, r * step - wobble * 0.5]);
    }
  }
  const triangles: [number, number, number][] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const a = r * (n + 1) + c;
      triangles.push([a, a + 1, a + n + 2], [a, a + n + 2, a + n + 1]);
    }
  }
  return { xy, triangles };
}

describe('createTriangleLocator', () => {
  const { xy, triangles } = meshOf(24, 2.5);
  const locator = createTriangleLocator(xy, triangles);
  /** Σημεία μέσα, έξω, πάνω σε κορυφές και πάνω σε κοινές ακμές. */
  const points: [number, number][] = [];
  for (let i = 0; i < 1500; i++) points.push([-5 + 70 * ((i * Math.SQRT2) % 1), -5 + 70 * ((i * Math.E) % 1)]);
  for (const [x, y] of xy.slice(0, 200)) points.push([x, y]);
  for (let i = 0; i + 1 < 200; i++) points.push([(xy[i][0] + xy[i + 1][0]) / 2, (xy[i][1] + xy[i + 1][1]) / 2]);

  it('ίδιο τρίγωνο και ΙΔΙΑ βάρη (bit προς bit) με την εξαντλητική αναζήτηση της αρχικής διατύπωσης', () => {
    let inside = 0;
    let outside = 0;
    for (const [x, y] of points) {
      const truth = firstHolding(xy, triangles, x, y);
      expect(locator.locate(x, y)).toEqual(truth);
      if (truth === null) outside++; else inside++;
    }
    expect(inside).toBeGreaterThan(500);
    expect(outside).toBeGreaterThan(50);
  });

  it('τα βάρη αναπαράγουν το σημείο', () => {
    for (const [x, y] of points) {
      const hit = locator.locate(x, y);
      if (hit === null) continue;
      const [i, j, k] = triangles[hit.triangle];
      expect(hit.wa * xy[i][0] + hit.wb * xy[j][0] + hit.wc * xy[k][0]).toBeCloseTo(x, 9);
      expect(hit.wa * xy[i][1] + hit.wb * xy[j][1] + hit.wc * xy[k][1]).toBeCloseTo(y, 9);
    }
  });

  it('`locateInto` είναι η ίδια ερώτηση· έξω από το πλέγμα αφήνει το `sink` ανέγγιχτο', () => {
    const sink = createTriangleHitSink();
    for (const [x, y] of points) {
      const hit = locator.locate(x, y);
      const before = { ...sink };
      expect(locator.locateInto(sink, x, y)).toBe(hit !== null);
      expect(sink).toEqual(hit ?? before);
    }
  });

  it('κενό πλέγμα και εκφυλισμένο τρίγωνο: καμία απάντηση, ποτέ σφάλμα', () => {
    const empty = createTriangleLocator([], []);
    expect(empty.locate(0, 0)).toBeNull();
    expect(empty.locateInto(createTriangleHitSink(), 0, 0)).toBe(false);
    const sliver = createTriangleLocator([[0, 0], [1, 0], [2, 0]], [[0, 1, 2]]);
    expect(sliver.locate(1, 0)).toBeNull();
  });
});
