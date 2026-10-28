/**
 * @fileoverview `roundMajor` + `formatCurrency` — η ζωντανή δοκιμή της πύλης προμηθευτή (ADR-327 changelog
 * 2026-10-28) αποθήκευσε `vatAmount: 21.599999999999998` και έδειξε «111,6 €».
 *
 * Κ1 στρογγύλευση στο λεπτό · Κ2 διόρθωση αναπαράστασης (`1.005 → 1.01`) · Κ3 πρόσημο συμμετρικό ·
 * Κ4 μη πεπερασμένο μένει αυτούσιο · Κ5 ποσό: ακέραιο χωρίς δεκαδικά, δεκαδικό ΠΑΝΤΑ με δύο ·
 * Κ6 επιλογές καλούντος: λιγότερα δεκαδικά χωρίς `RangeError`, ρητό ελάχιστο κρατά τα μηδενικά.
 */

import { roundMajor } from '../money';
import { formatCurrency } from '@/lib/intl-formatting';

jest.mock('@/lib/intl-utils', () => ({ getCurrentLocale: () => 'el-GR' }));

const NBSP = ' ';

describe('roundMajor', () => {
  test('Κ1 — το άθροισμα ΦΠΑ της ζωντανής προσφοράς γίνεται 21.6', () => {
    expect(roundMajor(90 * 0.24)).toBe(21.6);
    expect(roundMajor(63.3175)).toBe(63.32);
  });

  test('Κ2 — 1.005 (αποθηκευμένο 1.00499…) στρογγυλεύει ΠΑΝΩ', () => {
    expect(roundMajor(1.005)).toBe(1.01);
  });

  test('Κ3 — αρνητικά: συμμετρικά (διαφορές, καλύψεις κενού)', () => {
    expect(roundMajor(-1.005)).toBe(-1.01);
    expect(roundMajor(-21.599999999999998)).toBe(-21.6);
  });

  test('Κ4 — NaN/Infinity περνούν αυτούσια', () => {
    expect(roundMajor(Number.NaN)).toBeNaN();
    expect(roundMajor(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('formatCurrency', () => {
  test('Κ5 — ακέραιο «124 €», δεκαδικό «111,60 €»', () => {
    expect(formatCurrency(124)).toBe(`124${NBSP}€`);
    expect(formatCurrency(111.6)).toBe(`111,60${NBSP}€`);
    expect(formatCurrency(1234.5)).toBe(`1.234,50${NBSP}€`);
  });

  test('Κ6 — επιλογές καλούντος', () => {
    expect(formatCurrency(5000.4, 'EUR', { maximumFractionDigits: 0 })).toBe(`5.000${NBSP}€`);
    expect(formatCurrency(124, 'EUR', { minimumFractionDigits: 2 })).toBe(`124,00${NBSP}€`);
  });
});
