/**
 * ADR-718 — η κοπή του αναγλύφου στο όριο του οικοπέδου.
 *
 * Οι δύο υποσχέσεις που δόθηκαν στον χρήστη είναι **ιδιότητες**, όχι δείγματα, και ελέγχονται ως
 * τέτοιες (μνήμη: «λύσε την ΚΛΑΣΗ, όχι το δείγμα»):
 *
 *   1. «Το λοφάκι των 2m παραμένει 2m» ⇒ για **κάθε** σημείο μέσα στο όριο, το υψόμετρο πριν και
 *      μετά ταυτίζεται. Δειγματοληπτείται πλέγμα, όχι μία βολική κορυφή.
 *   2. «Ποτέ μεγέθυνση» ⇒ για **κάθε** όριο (μεγαλύτερο, μικρότερο, αλλού), το εμβαδόν δεν
 *      ξεπερνά ποτέ το αρχικό.
 *
 * Το φορτίο-κλειδί είναι η περίπτωση «δεξιόστροφα τρίγωνα»: χωρίς το CCW re-winding του κόφτη το
 * S-H απορρίπτει κάθε σημείο και η επιφάνεια **αδειάζει σιωπηλά**. Παίρνει δική της περίπτωση.
 */

import { clipTinToBoundary } from '../tin-clip-to-boundary';
import { buildTin } from '../tin-builder';
import { createTinSampler } from '../tin-sampler';
import type { Point2D } from '../../../rendering/types/Types';
import type { TinSurface, TopoPoint } from '../topo-types';

const M = 1000; // canonical mm ανά μέτρο

/** Το άθροισμα των εμβαδών των τριγώνων σε mm² — κλειστός τύπος, όχι επανάληψη του κώδικα. */
function planArea(surface: TinSurface): number {
  let total = 0;
  for (const [i, j, k] of surface.triangles) {
    const [ax, ay] = surface.positions[i]!;
    const [bx, by] = surface.positions[j]!;
    const [cx, cy] = surface.positions[k]!;
    total += Math.abs((bx - ax) * (cy - ay) - (cx - ax) * (by - ay)) / 2;
  }
  return total;
}

/** Ορθογώνιο δακτύλιος CCW σε WORLD mm. */
function rect(minX: number, minY: number, maxX: number, maxY: number): Point2D[] {
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
}

/**
 * Πλέγμα 20 m × 20 m με **λοφάκι** στο κέντρο — μη επίπεδο και μη γραμμικό, ώστε η ισότητα
 * υψομέτρων να μη μπορεί να περάσει κατά τύχη. `originMm` σπρώχνει το κτήμα σε ΕΓΣΑ μεγέθη.
 */
function hillTin(originMm = 0): TinSurface {
  const points: TopoPoint[] = [];
  for (let gx = 0; gx <= 10; gx++) {
    for (let gy = 0; gy <= 10; gy++) {
      const x = gx * 2 * M;
      const y = gy * 2 * M;
      const dx = (x - 10 * M) / (10 * M);
      const dy = (y - 10 * M) / (10 * M);
      const hill = 2 * M * Math.max(0, 1 - (dx * dx + dy * dy)); // κορυφή 2.00 m στο κέντρο
      points.push({ x: x + originMm, y: y + originMm, z: 1 * M + hill });
    }
  }
  return buildTin(points);
}

describe('clipTinToBoundary — τα υψόμετρα δεν αλλοιώνονται', () => {
  it('κάθε σημείο μέσα στο όριο κρατά ΤΟ ΙΔΙΟ υψόμετρο μετά την κοπή', () => {
    const full = hillTin();
    const boundary = rect(6 * M, 6 * M, 14 * M, 14 * M);
    const cropped = clipTinToBoundary(full, boundary);

    const before = createTinSampler(full);
    const after = createTinSampler(cropped);

    let checked = 0;
    for (let x = 7 * M; x <= 13 * M; x += 1 * M) {
      for (let y = 7 * M; y <= 13 * M; y += 1 * M) {
        const zBefore = before.zAtMm(x, y);
        const zAfter = after.zAtMm(x, y);
        expect(zBefore).not.toBeNull();
        expect(zAfter).not.toBeNull();
        // Χιλιοστό ανοχής σε canonical mm — δηλαδή ένα μικρό, όχι «περίπου ίδιο ανάγλυφο».
        expect(zAfter!).toBeCloseTo(zBefore!, 3);
        checked++;
      }
    }
    expect(checked).toBe(49); // το πλέγμα όντως εκτελέστηκε, δεν πέρασε κενό
  });

  it('κρατά το ίδιο υψόμετρο και όταν το κτήμα ζει σε ΕΓΣΑ μεγέθη (world → local)', () => {
    const originMm = 320_000 * M; // ~320 km, η τάξη του ΕΓΣΑ'87 σε canonical mm
    const full = hillTin(originMm);
    const cropped = clipTinToBoundary(
      full,
      rect(6 * M + originMm, 6 * M + originMm, 14 * M + originMm, 14 * M + originMm),
    );

    const before = createTinSampler(full);
    const after = createTinSampler(cropped);
    const probeX = 10 * M + originMm;
    const probeY = 10 * M + originMm;

    expect(after.zAtMm(probeX, probeY)).toBeCloseTo(before.zAtMm(probeX, probeY)!, 3);
    expect(cropped.origin).toEqual(full.origin); // το πλαίσιο δεν μετακινείται
  });
});

describe('clipTinToBoundary — ποτέ μεγέθυνση', () => {
  const full = hillTin();
  const fullArea = planArea(full);

  it.each([
    ['πολύ μεγαλύτερο από την επιφάνεια', rect(-100 * M, -100 * M, 120 * M, 120 * M)],
    ['ακριβώς η επιφάνεια', rect(0, 0, 20 * M, 20 * M)],
    ['μισό', rect(0, 0, 10 * M, 20 * M)],
    ['μικρό στο κέντρο', rect(8 * M, 8 * M, 12 * M, 12 * M)],
    ['μερικώς εκτός', rect(15 * M, 15 * M, 60 * M, 60 * M)],
  ])('όριο %s → εμβαδόν ≤ αρχικό', (_label, boundary) => {
    expect(planArea(clipTinToBoundary(full, boundary))).toBeLessThanOrEqual(fullArea * (1 + 1e-9));
  });

  it('όριο μεγαλύτερο από την επιφάνεια δεν προσθέτει ΤΙΠΟΤΑ — το εμβαδόν μένει ακέραιο', () => {
    const cropped = clipTinToBoundary(full, rect(-100 * M, -100 * M, 120 * M, 120 * M));
    expect(planArea(cropped)).toBeCloseTo(fullArea, 3);
  });

  it('το μισό οικόπεδο δίνει το μισό εμβαδόν — 20×20 m ⇒ 200 m²', () => {
    const cropped = clipTinToBoundary(full, rect(0, 0, 10 * M, 20 * M));
    expect(planArea(cropped) / (M * M)).toBeCloseTo(200, 6);
  });
});

describe('clipTinToBoundary — σχήμα ορίου', () => {
  const full = hillTin();

  it('Γ-σχήμα (μη κυρτό) οικόπεδο κόβεται σωστά — 20×20 μείον τεταρτημόριο 10×10 ⇒ 300 m²', () => {
    const lShape: Point2D[] = [
      { x: 0, y: 0 },
      { x: 20 * M, y: 0 },
      { x: 20 * M, y: 10 * M },
      { x: 10 * M, y: 10 * M },
      { x: 10 * M, y: 20 * M },
      { x: 0, y: 20 * M },
    ];
    expect(planArea(clipTinToBoundary(full, lShape)) / (M * M)).toBeCloseTo(300, 6);
  });

  it('δεξιόστροφο όριο δίνει το ΙΔΙΟ αποτέλεσμα με το αριστερόστροφο', () => {
    const ccw = rect(5 * M, 5 * M, 15 * M, 15 * M);
    const cw = [...ccw].reverse();
    expect(planArea(clipTinToBoundary(full, cw))).toBeCloseTo(planArea(clipTinToBoundary(full, ccw)), 3);
  });

  it('ΔΕΞΙΟΣΤΡΟΦΑ τρίγωνα στην TIN δεν αδειάζουν την επιφάνεια (το σιωπηλό S-H σφάλμα)', () => {
    const flipped: TinSurface = {
      ...full,
      triangles: full.triangles.map(([i, j, k]) => [i, k, j] as [number, number, number]),
    };
    const cropped = clipTinToBoundary(flipped, rect(5 * M, 5 * M, 15 * M, 15 * M));
    expect(cropped.triangles.length).toBeGreaterThan(0);
    expect(planArea(cropped) / (M * M)).toBeCloseTo(100, 6);
  });
});

describe('clipTinToBoundary — εκφυλισμένες εισόδους', () => {
  const full = hillTin();

  it.each([
    ['όριο εντελώς αλλού', rect(500 * M, 500 * M, 600 * M, 600 * M)],
    ['όριο με 2 κορυφές', [{ x: 0, y: 0 }, { x: 10 * M, y: 10 * M }]],
    ['κενό όριο', [] as Point2D[]],
  ])('%s → ΚΕΝΗ επιφάνεια, ποτέ η ακομμάτιαστη', (_label, boundary) => {
    const cropped = clipTinToBoundary(full, boundary);
    expect(cropped.triangles).toHaveLength(0);
    expect(cropped.positions).toHaveLength(0);
    expect(cropped.origin).toEqual(full.origin);
  });

  it('κενή επιφάνεια μένει κενή', () => {
    const empty = buildTin([]);
    expect(clipTinToBoundary(empty, rect(0, 0, 10 * M, 10 * M)).triangles).toHaveLength(0);
  });
});

describe('clipTinToBoundary — τα δεδομένα του τοπογράφου μένουν ανέπαφα', () => {
  it('η αρχική επιφάνεια δεν μεταλλάσσεται από την κοπή (η επαναφορά είναι δωρεάν)', () => {
    const full = hillTin();
    const snapshot = {
      positions: full.positions.length,
      triangles: full.triangles.length,
      bounds: { ...full.bounds },
    };

    clipTinToBoundary(full, rect(8 * M, 8 * M, 12 * M, 12 * M));

    expect(full.positions).toHaveLength(snapshot.positions);
    expect(full.triangles).toHaveLength(snapshot.triangles);
    expect(full.bounds).toEqual(snapshot.bounds);
  });
});
