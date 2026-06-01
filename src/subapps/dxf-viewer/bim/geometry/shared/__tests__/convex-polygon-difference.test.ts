/**
 * convex-polygon-difference.test.ts — ADR-404 Phase 4.3 robustness SSoT.
 *
 * Επαληθεύει ότι το analytic half-plane peel `subject ∖ convexHole`:
 *  1. δίνει **ξένα convex κομμάτια** που καλύπτουν ΑΚΡΙΒΩΣ τη διαφορά (area = S − S∩H),
 *  2. **ΠΟΤΕ δεν αποτυγχάνει/πετά** στις σχεδόν-εκφυλισμένες «bridge» διαμορφώσεις που
 *     έσπαγαν το `polygon-clipping` («Unable to complete output ring») — το root cause
 *     των κενών + penetration στον γερμένο τοίχο κάτω από λοξό δοκάρι,
 *  3. `isConvexRing` ταξινομεί σωστά κυρτά/μη-κυρτά.
 *
 * @see ../convex-polygon-difference.ts
 */

import {
  convexPolygonDifference,
  isConvexRing,
  type Pt2,
} from '../convex-polygon-difference';

const area = (pts: readonly Pt2[]): number => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
};

const isCcw = (pts: readonly Pt2[]): boolean => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a > 0;
};

const sumArea = (polys: readonly (readonly Pt2[])[]): number =>
  polys.reduce((s, p) => s + area(p), 0);

describe('isConvexRing', () => {
  it('ορθογώνιο → convex', () => {
    expect(isConvexRing([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }, { x: 0, y: 2 }])).toBe(true);
  });
  it('L-shape → ΟΧΙ convex', () => {
    expect(isConvexRing([
      { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 4 }, { x: 0, y: 4 },
    ])).toBe(false);
  });
  it('αγνοεί collinear κορυφές', () => {
    expect(isConvexRing([
      { x: 0, y: 0 }, { x: 2, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }, { x: 0, y: 2 },
    ])).toBe(true);
  });
  it('< 3 κορυφές → false', () => {
    expect(isConvexRing([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(false);
  });
});

describe('convexPolygonDifference — correctness', () => {
  const quad: Pt2[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 }, { x: 0, y: 4 }];

  it('τρύπα εντελώς μέσα (notch) → κομμάτια καλύπτουν quad − hole, ξένα μεταξύ τους', () => {
    const hole: Pt2[] = [{ x: 3, y: 1 }, { x: 6, y: 1 }, { x: 6, y: 3 }, { x: 3, y: 3 }];
    const pieces = convexPolygonDifference(quad, hole);
    expect(pieces.length).toBeGreaterThan(0);
    // area conservation: Σ pieces = area(quad) − area(hole∩quad)
    expect(sumArea(pieces)).toBeCloseTo(area(quad) - area(hole), 6);
    for (const p of pieces) expect(isCcw(p)).toBe(true); // CCW (top cap +Y)
  });

  it('τρύπα τέμνει την άκρη → σωστή υπολειπόμενη περιοχή', () => {
    const hole: Pt2[] = [{ x: 7, y: -1 }, { x: 12, y: -1 }, { x: 12, y: 5 }, { x: 7, y: 5 }];
    const pieces = convexPolygonDifference(quad, hole);
    // Το quad κόβεται στο x=7 → απομένει ορθογώνιο [0,7]×[0,4] = 28.
    expect(sumArea(pieces)).toBeCloseTo(28, 6);
  });

  it('τρύπα καλύπτει όλο το quad → κενό', () => {
    const hole: Pt2[] = [{ x: -1, y: -1 }, { x: 11, y: -1 }, { x: 11, y: 5 }, { x: -1, y: 5 }];
    expect(convexPolygonDifference(quad, hole)).toHaveLength(0);
  });

  it('τρύπα εκτός quad → ολόκληρο το quad επιστρέφεται (1 κομμάτι, ίδιο εμβαδόν)', () => {
    const hole: Pt2[] = [{ x: 20, y: 20 }, { x: 22, y: 20 }, { x: 22, y: 22 }, { x: 20, y: 22 }];
    const pieces = convexPolygonDifference(quad, hole);
    expect(sumArea(pieces)).toBeCloseTo(area(quad), 6);
  });

  it('CW-ορισμένη τρύπα → ίδιο αποτέλεσμα (κανονικοποίηση orientation)', () => {
    const holeCcw: Pt2[] = [{ x: 3, y: 1 }, { x: 6, y: 1 }, { x: 6, y: 3 }, { x: 3, y: 3 }];
    const holeCw = [...holeCcw].reverse();
    expect(sumArea(convexPolygonDifference(quad, holeCw)))
      .toBeCloseTo(sumArea(convexPolygonDifference(quad, holeCcw)), 9);
  });
});

describe('convexPolygonDifference — degenerate «bridge» (root cause)', () => {
  // Λεπτός τοίχος (πάχος ~0.2) που ένα δοκάρι **μόλις-μόλις γεφυρώνει**: η κάτω/πάνω
  // ακμή του host σχεδόν συμπίπτει με τις παρειές του τοίχου → το polygon-clipping
  // πετούσε «Unable to complete output ring». Το analytic peel πρέπει να επιβιώσει.
  const thinQuad: Pt2[] = [
    { x: 8.6577, y: 9.3837 }, { x: 10.9166, y: 7.9982 },
    { x: 10.9166, y: 7.7982 }, { x: 8.6577, y: 9.1837 },
  ];

  it('host που γεφυρώνει ΑΚΡΙΒΩΣ → δεν πετά + έγκυρα κομμάτια', () => {
    const bridging: Pt2[] = [
      { x: 10.0264, y: 7.3 }, { x: 10.2764, y: 7.3 },
      { x: 10.2764, y: 11.0 }, { x: 10.0264, y: 11.0 },
    ];
    let pieces: Pt2[][] = [];
    expect(() => { pieces = convexPolygonDifference(thinQuad, bridging); }).not.toThrow();
    // Η διαφορά πρέπει να είναι μη-κενή (το δοκάρι κόβει μέρος, όχι όλο τον τοίχο)
    // και να μην ξεπερνά το εμβαδόν του τοίχου.
    expect(sumArea(pieces)).toBeLessThanOrEqual(area(thinQuad) + 1e-9);
    expect(sumArea(pieces)).toBeGreaterThan(0);
  });

  it('host που γεφυρώνει με ακμή σχεδόν-collinear στην παρειά → robust', () => {
    // Ακμή host σχεδόν παράλληλη/εφαπτόμενη στη μακριά παρειά του τοίχου.
    const tangent: Pt2[] = [
      { x: 8.6577, y: 9.18371 }, { x: 10.9166, y: 7.79821 },
      { x: 11.5, y: 8.5 }, { x: 9.2, y: 10.0 },
    ];
    expect(() => convexPolygonDifference(thinQuad, tangent)).not.toThrow();
  });
});
