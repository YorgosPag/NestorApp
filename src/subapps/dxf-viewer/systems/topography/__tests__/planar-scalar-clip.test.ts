/**
 * ADR-665 M2.2 — tests για τον ΕΝΑ κόφτη ημιεπιπέδου σε βαθμωτό πεδίο.
 *
 * Κλειδώνει τις τρεις ιδιότητες που κάνουν τον cap και τους όγκους cut/fill σωστούς:
 *   1. **Στεγανότητα** — κορυφή ακριβώς στο μηδέν μπαίνει και στα ΔΥΟ μισά, ώστε τα εμβαδά τους
 *      να αθροίζουν πίσω στο αρχικό. Χαλάρωσέ το σε `> 0` και ανοίγει σχισμή μηδενικού πλάτους.
 *   2. **Κυρτότητα** — τρίγωνο κομμένο από ημιεπίπεδο δίνει 0, 3 ή 4 κορυφές· ποτέ 5, ποτέ 2.
 *      Αυτό είναι που επιτρέπει fan-triangulation χωρίς CDT.
 *   3. **Fast path** — πολύγωνο ολόκληρο στη μία πλευρά επιστρέφεται αυτούσιο.
 */

import { clipPolygonAtScalarZero } from '../planar-scalar-clip';
import type { Point2D } from '../../../rendering/types/Types';

interface V { readonly x: number; readonly y: number; readonly f: number }

const fieldOf = (v: V): number => v.f;
const atCrossing = (p: Point2D): V => ({ x: p.x, y: p.y, f: 0 });

const clip = (poly: readonly V[], sign: 1 | -1): V[] =>
  clipPolygonAtScalarZero(poly, sign, fieldOf, atCrossing);

/** Εμβαδόν πολυγώνου (shoelace, απόλυτο) — ανεξάρτητο από τον κόφτη, για τον έλεγχο στεγανότητας. */
function area(poly: readonly V[]): number {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/** Τρίγωνο 10×10 με το πεδίο δοσμένο ανά κορυφή. */
const tri = (f0: number, f1: number, f2: number): V[] => [
  { x: 0, y: 0, f: f0 },
  { x: 10, y: 0, f: f1 },
  { x: 0, y: 10, f: f2 },
];

describe('clipPolygonAtScalarZero', () => {
  it('πολύγωνο ΟΛΟΚΛΗΡΟ θετικό → επιστρέφεται αυτούσιο στο +, κενό στο −', () => {
    const t = tri(3, 5, 7);
    expect(clip(t, 1)).toEqual(t);
    expect(clip(t, -1)).toEqual([]);
  });

  it('πολύγωνο ΟΛΟΚΛΗΡΟ αρνητικό → το αντίστροφο', () => {
    const t = tri(-3, -5, -7);
    expect(clip(t, 1)).toEqual([]);
    expect(clip(t, -1)).toEqual(t);
  });

  it('μία κορυφή έξω → 4 κορυφές· δύο έξω → 3 κορυφές (πάντα κυρτό)', () => {
    expect(clip(tri(1, 1, -1), 1)).toHaveLength(4);
    expect(clip(tri(1, -1, -1), 1)).toHaveLength(3);
  });

  it('ΣΤΕΓΑΝΟΤΗΤΑ: τα δύο μισά αθροίζουν ακριβώς στο αρχικό εμβαδόν', () => {
    const t = tri(4, -6, 2);
    const whole = area(t);
    expect(area(clip(t, 1)) + area(clip(t, -1))).toBeCloseTo(whole, 9);
  });

  it('ΣΤΕΓΑΝΟΤΗΤΑ σε κορυφή ΑΚΡΙΒΩΣ στο μηδέν: μπαίνει και στα δύο μισά', () => {
    const t = tri(0, 5, -5);
    const plus = clip(t, 1);
    const minus = clip(t, -1);
    expect(plus.some((v) => v.f === 0 && v.x === 0 && v.y === 0)).toBe(true);
    expect(minus.some((v) => v.f === 0 && v.x === 0 && v.y === 0)).toBe(true);
    expect(area(plus) + area(minus)).toBeCloseTo(area(t), 9);
  });

  it('ολόκληρη ακμή στο μηδέν → ακέραιο στο −, ΜΗΔΕΝΙΚΟΥ εμβαδού στο +', () => {
    const t = tri(0, 0, -4);
    expect(area(clip(t, -1))).toBeCloseTo(area(t), 9);
    // Η ακμή στο μηδέν ανήκει και στα δύο μισά (στεγανότητα), οπότε στο + επιστρέφεται ως
    // εκφυλισμένη λωρίδα — ΜΗΔΕΝΙΚΟΥ εμβαδού, άρα μηδενικής συνεισφοράς σε όγκο/cap. Ο έλεγχος
    // είναι πάνω στο ΕΜΒΑΔΟΝ και όχι στο πλήθος κορυφών: το «πόσες κορυφές» είναι λεπτομέρεια
    // υλοποίησης, το «δεν προσθέτει τίποτα» είναι το συμβόλαιο.
    expect(area(clip(t, 1))).toBeCloseTo(0, 9);
  });

  it('η νέα κορυφή κάθεται ΠΑΝΩ στη γραμμή, γραμμικά παρεμβαλλόμενη', () => {
    // Ακμή (0,0,f=-2) → (10,0,f=+2): το μηδέν πέφτει στο μέσο, x = 5.
    const t: V[] = [
      { x: 0, y: 0, f: -2 },
      { x: 10, y: 0, f: 2 },
      { x: 10, y: 10, f: 2 },
    ];
    const crossings = clip(t, 1).filter((v) => v.f === 0);
    expect(crossings.some((v) => Math.abs(v.x - 5) < 1e-9 && Math.abs(v.y) < 1e-9)).toBe(true);
  });

  it('εκφυλισμένη είσοδος (< 3 κορυφές) → κενό, ποτέ σφάλμα', () => {
    expect(clip([{ x: 0, y: 0, f: 1 }, { x: 1, y: 0, f: 1 }], 1)).toEqual([]);
    expect(clip([], 1)).toEqual([]);
  });

  it('μη-πεπερασμένο πεδίο → η κορυφή είναι ΕΞΩ και στα δύο πρόσημα (δεν διαρρέει NaN)', () => {
    const t = tri(Number.NaN, 5, 7);
    for (const piece of [clip(t, 1), clip(t, -1)]) {
      for (const v of piece) {
        expect(Number.isFinite(v.x)).toBe(true);
        expect(Number.isFinite(v.y)).toBe(true);
      }
    }
  });
});
