/**
 * ADR-449 PART A — tests για το `mergeCollinearFinishSegments` (ενιαία «κουβέρτα» σοβά).
 *
 * Καλύπτει το κρίσιμο συμβόλαιο:
 *  - **run-merge**: διαδοχικά collinear same-material segments → ΕΝΑ (A+B→AB, AB+C→ABC).
 *  - **wrap-around ring-close**: το τελευταίο κλείνει collinear πάνω στο πρώτο → η ραφή
 *    κλεισίματος του ring εξαφανίζεται.
 *  - **ΟΧΙ-merge** σε αλλαγή: γωνία (μη παράλληλα), υλικού, ταξινόμησης, πάχους, colorOverride.
 *  - **BOQ ταυτότητα**: Σ(lengthM) πριν == μετά (η συγχώνευση δεν αλλάζει επιμέτρηση).
 *  - junction/square flags: κρατιούνται από τα ΑΚΡΑ του run (prev.a-side, next.b-side).
 */

import { mergeCollinearFinishSegments } from '../structural-finish-merge';
import type { FinishFaceSegment } from '../structural-finish-types';

/** Segment factory: `lengthM` = ευκλείδειο μήκος a→b (unitToMeters=1), interior/plaster default. */
function seg(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  over: Partial<FinishFaceSegment> = {},
): FinishFaceSegment {
  return {
    a: { x: ax, y: ay },
    b: { x: bx, y: by },
    classification: 'interior',
    materialId: 'mat-plaster-int',
    thickness: 15,
    lengthM: Math.hypot(bx - ax, by - ay),
    ...over,
  };
}

/** Σ μηκών (BOQ ταυτότητα). */
const total = (segs: readonly FinishFaceSegment[]): number =>
  segs.reduce((s, x) => s + x.lengthM, 0);

describe('mergeCollinearFinishSegments (ADR-449 PART A)', () => {
  it('< 2 segments → επιστρέφει copy (μηδέν αλλαγή)', () => {
    const one = [seg(0, 0, 10, 0)];
    const out = mergeCollinearFinishSegments(one);
    expect(out).toEqual(one);
    expect(out).not.toBe(one); // νέο array (καθαρή SSoT, όχι mutation)
    expect(mergeCollinearFinishSegments([])).toEqual([]);
  });

  it('run-merge: 3 διαδοχικά collinear same-material → 1 ενιαία όψη (a→b συνολικό)', () => {
    const out = mergeCollinearFinishSegments([
      seg(0, 0, 10, 0),
      seg(10, 0, 25, 0),
      seg(25, 0, 40, 0),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].a).toEqual({ x: 0, y: 0 });
    expect(out[0].b).toEqual({ x: 40, y: 0 });
    expect(out[0].lengthM).toBeCloseTo(40); // BOQ ταυτότητα (10+15+15)
  });

  it('BOQ ταυτότητα: Σ(lengthM) αμετάβλητο μετά τη συγχώνευση', () => {
    const input = [seg(0, 0, 10, 0), seg(10, 0, 25, 0), seg(25, 0, 40, 0)];
    expect(total(mergeCollinearFinishSegments(input))).toBeCloseTo(total(input));
  });

  it('ΟΧΙ-merge σε γωνία (μη παράλληλα) → η γραμμή μένει μόνο στην αλλαγή διεύθυνσης', () => {
    const out = mergeCollinearFinishSegments([
      seg(0, 0, 10, 0), // +x
      seg(10, 0, 10, 10), // +y (γωνία)
    ]);
    expect(out).toHaveLength(2);
  });

  it('ΟΧΙ-merge σε αλλαγή υλικού (καθαρό σύνορο PART B)', () => {
    const out = mergeCollinearFinishSegments([
      seg(0, 0, 10, 0, { materialId: 'mat-plaster-int' }),
      seg(10, 0, 20, 0, { materialId: 'mat-knauf' }),
    ]);
    expect(out).toHaveLength(2);
  });

  it('ΟΧΙ-merge σε αλλαγή ταξινόμησης (interior↔exterior)', () => {
    const out = mergeCollinearFinishSegments([
      seg(0, 0, 10, 0, { classification: 'interior' }),
      seg(10, 0, 20, 0, { classification: 'exterior', materialId: 'mat-plaster-int' }),
    ]);
    expect(out).toHaveLength(2);
  });

  it('ΟΧΙ-merge σε αλλαγή πάχους', () => {
    const out = mergeCollinearFinishSegments([
      seg(0, 0, 10, 0, { thickness: 15 }),
      seg(10, 0, 20, 0, { thickness: 25 }),
    ]);
    expect(out).toHaveLength(2);
  });

  it('ΟΧΙ-merge σε αλλαγή colorOverride (per-region paint σύνορο, PART B)', () => {
    const out = mergeCollinearFinishSegments([
      seg(0, 0, 10, 0, { colorOverride: '#c0d8b0' }),
      seg(10, 0, 20, 0, { colorOverride: '#e0b0b0' }),
    ]);
    expect(out).toHaveLength(2);
  });

  it('ΟΧΙ-merge όταν λείπει η κοινή κορυφή (χάσμα)', () => {
    const out = mergeCollinearFinishSegments([
      seg(0, 0, 10, 0),
      seg(11, 0, 20, 0), // prev.b=(10,0) ≠ next.a=(11,0)
    ]);
    expect(out).toHaveLength(2);
  });

  it('wrap-around ring-close: το τελευταίο κλείνει collinear πάνω στο πρώτο → η ραφή σβήνει', () => {
    // Ορθογώνιο [0,40]×[0,20] με την κάτω ακμή σπασμένη στο (20,0) (seam κλεισίματος ring):
    //   s0 (20,0)-(40,0) | s1 (40,0)-(40,20) | s2 (40,20)-(0,20) | s3 (0,20)-(0,0) | s4 (0,0)-(20,0)
    // s4 συνεχίζει collinear το s0 (κοινή κορυφή (20,0), ίδια +x φορά) → wrap-merge σε (0,0)-(40,0).
    const input = [
      seg(20, 0, 40, 0),
      seg(40, 0, 40, 20),
      seg(40, 20, 0, 20),
      seg(0, 20, 0, 0),
      seg(0, 0, 20, 0),
    ];
    const out = mergeCollinearFinishSegments(input);
    expect(out).toHaveLength(4); // 5 → 4 (η κάτω ακμή ενοποιήθηκε)
    // Η ενιαία κάτω ακμή (0,0)→(40,0) υπάρχει ΜΙΑ φορά.
    const bottom = out.filter((s) => Math.abs(s.a.y) < 1e-9 && Math.abs(s.b.y) < 1e-9);
    expect(bottom).toHaveLength(1);
    expect(bottom[0].a).toEqual({ x: 0, y: 0 });
    expect(bottom[0].b).toEqual({ x: 40, y: 0 });
    expect(total(out)).toBeCloseTo(total(input)); // BOQ ταυτότητα (περίμετρος 120)
  });

  it('wrap-around ΔΕΝ ενεργοποιείται όταν αλλάζει το υλικό στη ραφή κλεισίματος', () => {
    const input = [
      seg(20, 0, 40, 0, { materialId: 'mat-a' }),
      seg(40, 0, 40, 20),
      seg(40, 20, 0, 20),
      seg(0, 20, 0, 0),
      seg(0, 0, 20, 0, { materialId: 'mat-b' }), // διαφορετικό υλικό → όχι wrap-merge
    ];
    const out = mergeCollinearFinishSegments(input);
    expect(out).toHaveLength(5);
  });

  it('junction/square flags: κρατιούνται από τα ΑΚΡΑ του run, τα ενδιάμεσα πέφτουν', () => {
    const out = mergeCollinearFinishSegments([
      seg(0, 0, 10, 0, { aJunction: true, bJunction: true }),
      seg(10, 0, 20, 0, { aSquareEnd: true, bSquareEnd: true }),
      seg(20, 0, 30, 0, { aJunction: true, bSquareEnd: true }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].aJunction).toBe(true); // από το πρώτο (start)
    expect(out[0].bSquareEnd).toBe(true); // από το τελευταίο (end)
    // Οι ενδιάμεσες σημαίες στην κοινή κορυφή (περιττό split) αγνοούνται.
    expect(out[0].bJunction).toBeUndefined();
    expect(out[0].aSquareEnd).toBeUndefined();
  });

  it('μεικτό: run-merge + διατήρηση γωνιών σε σύνθετη ευθεία όψη (ενιαία κουβέρτα)', () => {
    // Ευθεία σύνθετη όψη σπασμένη σε 3 collinear + 1 γωνία + 2 collinear.
    const input = [
      seg(0, 0, 10, 0),
      seg(10, 0, 20, 0),
      seg(20, 0, 30, 0),
      seg(30, 0, 30, 15), // γωνία
      seg(30, 15, 40, 15),
      seg(40, 15, 55, 15),
    ];
    const out = mergeCollinearFinishSegments(input);
    // 3→1 (κάτω ευθεία) + γωνία + 2→1 (πάνω ευθεία) = 3 όψεις.
    expect(out).toHaveLength(3);
    expect(total(out)).toBeCloseTo(total(input));
  });
});
