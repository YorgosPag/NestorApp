/**
 * ADR-929 §6.16 #8 — το `EdgeSourceIndex` είναι **φίλτρο**: το `rectEdgeSourceIds` πάνω του πρέπει να δίνει ΤΟ ΙΔΙΟ
 * αποτέλεσμα (ids, σειρά, ανά ακμή) με τη γραμμική σάρωση όλων των τμημάτων — και στα τρία στάδια (ταύτιση άκρων ·
 * συγγραμμικά κομμάτια · πλησιέστερο στο μέσο), και στις οριακές αποστάσεις γύρω από την ανοχή.
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { DetectedRectangle, RegionLineSeg } from '../wall-in-region';
import { rectEdgeSourceIds } from '../same-color-rects';
import { EdgeSourceIndex } from '../edge-source-index';

const TOL = 5;

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rect(x: number, y: number, w: number, h: number): DetectedRectangle {
  const polygon: [Point2D, Point2D, Point2D, Point2D] = [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
  return { polygon, longSide: Math.max(w, h), shortSide: Math.min(w, h), area: w * h };
}

const seg = (id: string, x1: number, y1: number, x2: number, y2: number): RegionLineSeg => ({ id, start: { x: x1, y: y1 }, end: { x: x2, y: y2 } });

/** Ένα σχέδιο με ακμές ορθογωνίων σε όλες τις μορφές: ακριβείς, σπασμένες σε κομμάτια, μετατοπισμένες γύρω από το `tol`. */
function randomScene(seed: number): { segments: RegionLineSeg[]; rects: DetectedRectangle[] } {
  const r = rng(seed);
  const segments: RegionLineSeg[] = [];
  const rects: DetectedRectangle[] = [];
  const jitter = () => (r() - 0.5) * 2.4 * TOL; // ±1,2·tol: και μέσα και έξω από την ανοχή
  for (let k = 0; k < 40; k++) {
    const rc = rect(Math.round(r() * 3000), Math.round(r() * 3000), 10 + r() * 600, 10 + r() * 600);
    rects.push(rc);
    for (let e = 0; e < 4; e++) {
      const a = rc.polygon[e];
      const b = rc.polygon[(e + 1) % 4];
      const mode = r();
      const id = `s${k}-${e}`;
      if (mode < 0.35) segments.push(seg(id, a.x + jitter(), a.y + jitter(), b.x + jitter(), b.y + jitter()));
      else if (mode < 0.7) {
        const t = 0.2 + r() * 0.6; // σπασμένη παρειά (κόμβος Τ)
        const m = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        segments.push(seg(`${id}a`, a.x, a.y + jitter(), m.x, m.y + jitter()), seg(`${id}b`, m.x + jitter(), m.y, b.x, b.y));
      } else if (mode < 0.85) segments.push(seg(id, (a.x + b.x) / 2 + jitter(), (a.y + b.y) / 2 + jitter(), (a.x + b.x) / 2 + 3, (a.y + b.y) / 2 + 3));
    }
  }
  for (let n = 0; n < 300; n++) {
    const x = r() * 3600;
    const y = r() * 3600;
    segments.push(seg(`noise${n}`, x, y, x + (r() - 0.5) * 900, y + (r() - 0.5) * 900));
  }
  return { segments, rects };
}

describe('EdgeSourceIndex — ίδιο αποτέλεσμα με τη γραμμική σάρωση', () => {
  it.each(Array.from({ length: 30 }, (_, seed) => seed))('σπόρος %i', (seed) => {
    const { segments, rects } = randomScene(seed);
    const index = new EdgeSourceIndex(segments, TOL);
    for (const rc of rects) expect(rectEdgeSourceIds(rc, index, TOL)).toStrictEqual(rectEdgeSourceIds(rc, segments, TOL));
  });

  it('κάθε στάδιο βρίσκει κάτι στα τυχαία σχέδια (αλλιώς η ισοδυναμία δεν λέει τίποτα)', () => {
    const { segments, rects } = randomScene(7);
    const counts = rects.flatMap((rc) => rectEdgeSourceIds(rc, segments, TOL)).map((ids) => ids.length);
    expect(counts.some((n) => n === 0)).toBe(true);
    expect(counts.some((n) => n === 1)).toBe(true);
    expect(counts.some((n) => n >= 2)).toBe(true);
  });

  it('ισοβαθμία «πλησιέστερου στο μέσο» ⇒ το πρώτο κατά την αρχική σειρά, όπως η σάρωση', () => {
    const rc = rect(0, 0, 100, 50);
    // Δύο κοντά τμήματα σε ίση απόσταση από το μέσο της κάτω ακμής, κανένα δεν ταιριάζει άκρα ή συγγραμμικότητα.
    const segments = [seg('far', 900, 900, 950, 950), seg('second', 50, 3, 50, 4), seg('first', 50, -3, 50, -4)];
    const index = new EdgeSourceIndex(segments, TOL);
    expect(rectEdgeSourceIds(rc, index, TOL)).toStrictEqual(rectEdgeSourceIds(rc, segments, TOL));
    expect(rectEdgeSourceIds(rc, index, TOL)[0]).toStrictEqual(['second']);
  });

  it('ανοχή μηδέν ή χωρίς τμήματα ⇒ γραμμική σάρωση, χωρίς σφάλμα', () => {
    const rc = rect(0, 0, 100, 50);
    const segments = [seg('a', 0, 0, 100, 0)];
    expect(rectEdgeSourceIds(rc, new EdgeSourceIndex(segments, 0), 0)).toStrictEqual(rectEdgeSourceIds(rc, segments, 0));
    expect(rectEdgeSourceIds(rc, new EdgeSourceIndex([], TOL), TOL)).toStrictEqual([[], [], [], []]);
  });

  it('ένα μόνο οριζόντιο τμήμα (μηδενικό ύψος ορίων) ⇒ ευρετήριο έγκυρο', () => {
    const segments = [seg('only', 0, 0, 100, 0)];
    const index = new EdgeSourceIndex(segments, TOL);
    expect(index.candidates({ x: 0, y: 0 }, { x: 100, y: 0 })).toStrictEqual(segments);
  });
});
