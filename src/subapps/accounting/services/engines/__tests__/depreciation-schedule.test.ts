/**
 * @jest-environment node
 *
 * Πίνακας αποσβέσεων — SSoT (ADR-ACC-010 §2.1.1 Φάση 4). Νούμερα υπολογισμένα ΜΕ ΤΟ ΧΕΡΙ, όχι από τον κώδικα.
 *
 *   Π1  έναρξη = ο ΕΠΟΜΕΝΟΣ μήνας της έναρξης χρήσης (ΚΦΕ αρ.24 παρ.6)
 *   Π2  εκποίηση: ο μήνας της εκποίησης μετρά
 *   Π3  υπόλοιπο αρχής = ο ίδιος ο πίνακας (καμία εξάρτηση από μεταβλητά πεδία)
 *   Π4  πλαφόν στην αποσβέσιμη αξία · το άθροισμα όλων των χρήσεων = ακριβώς η αποσβέσιμη αξία
 *   Π5  άκυρα στοιχεία = σφάλμα, ποτέ σιωπηλό 0
 */

import {
  depreciationForYear,
  depreciationScheduleThrough,
  InvalidDepreciationTermsError,
  isFullyDepreciatedAt,
  monthsInFiscalYear,
  type DepreciationTerms,
} from '../depreciation-schedule';
import { roundToTwo } from '../../../utils/math';

function terms(overrides: Partial<DepreciationTerms> = {}): DepreciationTerms {
  return {
    acquisitionCost: 10000,
    residualValue: 0,
    depreciationRate: 10,
    depreciationStartDate: '2024-12-10',
    disposalDate: null,
    ...overrides,
  };
}

describe('Π1 — έναρξη τον επόμενο μήνα', () => {
  it('Η/Υ 1.000 € (20%) σε χρήση 15/3/2026 ⇒ Απρ–Δεκ = 9 μήνες = 150,00 €', () => {
    const row = depreciationForYear(terms({ acquisitionCost: 1000, depreciationRate: 20, depreciationStartDate: '2026-03-15' }), 2026);
    expect(row.monthsApplied).toBe(9);
    expect(row.charge).toBe(150);
  });

  it('σε χρήση 1/1 ⇒ 11 μήνες (ο Ιανουάριος ΔΕΝ μετρά): 10.000 × 10% × 11/12 = 916,67', () => {
    const row = depreciationForYear(terms({ depreciationStartDate: '2025-01-01' }), 2025);
    expect([row.monthsApplied, row.charge]).toEqual([11, 916.67]);
  });

  it('σε χρήση Δεκέμβριο ⇒ 0 μήνες εκείνη τη χρήση, 12 την επόμενη', () => {
    const t = terms({ depreciationStartDate: '2025-12-05' });
    expect(monthsInFiscalYear(t, 2025)).toBe(0);
    expect(monthsInFiscalYear(t, 2026)).toBe(12);
    expect(depreciationForYear(t, 2025).charge).toBe(0);
    expect(depreciationForYear(t, 2026).charge).toBe(1000);
  });

  it('πλήρες ISO της ίδιας ημέρας = ίδιο αποτέλεσμα με `YYYY-MM-DD`', () => {
    const iso = depreciationForYear(terms({ depreciationStartDate: '2026-03-15T10:00:00.000Z' }), 2026);
    const day = depreciationForYear(terms({ depreciationStartDate: '2026-03-15' }), 2026);
    expect(iso).toEqual(day);
  });

  it('χρήση πριν από την έναρξη ⇒ μηδενική γραμμή με πλήρη αναπόσβεστη αξία', () => {
    expect(depreciationForYear(terms({ depreciationStartDate: '2027-02-01' }), 2026)).toEqual({
      fiscalYear: 2026, monthsApplied: 0, openingAccumulated: 0, charge: 0, closingAccumulated: 0, closingNetBookValue: 10000,
    });
  });
});

describe('Π2 — εκποίηση', () => {
  it('εκποίηση 30/6 ⇒ Ιαν–Ιουν = 6 μήνες: 12.000 × 10% × 6/12 = 600· την επόμενη χρήση 0', () => {
    const t = terms({ acquisitionCost: 12000, disposalDate: '2026-06-30' });
    expect([monthsInFiscalYear(t, 2026), depreciationForYear(t, 2026).charge]).toEqual([6, 600]);
    expect(depreciationForYear(t, 2027).charge).toBe(0);
  });

  it('εκποίηση τον μήνα της έναρξης ⇒ καμία απόσβεση (ο πρώτος μήνας θα ήταν ο επόμενος)', () => {
    const t = terms({ depreciationStartDate: '2026-06-01', disposalDate: '2026-06-20' });
    expect(monthsInFiscalYear(t, 2026)).toBe(0);
  });
});

describe('Π3 — υπόλοιπο αρχής από τον πίνακα', () => {
  it('καταχώριση αργά (κτήση 2021, Η/Υ 1.000 € 20%): 2021 = 183,33 · 2022–25 = 200 · 2026 = 16,67 · 2027 = 0', () => {
    const t = terms({ acquisitionCost: 1000, depreciationRate: 20, depreciationStartDate: '2021-01-01' });
    const charges = depreciationScheduleThrough(t, 2027).map((r) => [r.fiscalYear, r.charge]);
    expect(charges).toEqual([[2021, 183.33], [2022, 200], [2023, 200], [2024, 200], [2025, 200], [2026, 16.67], [2027, 0]]);
  });

  it('ίδια χρήση = ίδια γραμμή, όποια σειρά κι αν ζητηθεί (καθαρή συνάρτηση)', () => {
    const t = terms();
    const later = depreciationForYear(t, 2026);
    const earlier = depreciationForYear(t, 2025);
    expect(depreciationForYear(t, 2026)).toEqual(later);
    expect(later.openingAccumulated).toBe(earlier.closingAccumulated);
  });
});

describe('Π4 — πλαφόν και άθροισμα', () => {
  it('οχήματα 25.000 € (16% = 4.000/έτος): 6 πλήρεις χρήσεις = 24.000 ⇒ η 7η = 1.000, η 8η = 0', () => {
    const t = terms({ acquisitionCost: 25000, depreciationRate: 16, depreciationStartDate: '2018-12-01' });
    expect(depreciationForYear(t, 2024).closingAccumulated).toBe(24000);
    const capped = depreciationForYear(t, 2025);
    expect([capped.charge, capped.closingNetBookValue]).toEqual([1000, 0]);
    expect(isFullyDepreciatedAt(t, capped)).toBe(true);
    expect(depreciationForYear(t, 2026).charge).toBe(0);
  });

  it('υπολειμματική αξία: 10.000 − 2.000 = 8.000 × 10% = 800· αναπόσβεστη 9.200', () => {
    const row = depreciationForYear(terms({ residualValue: 2000 }), 2025);
    expect([row.charge, row.closingNetBookValue]).toEqual([800, 9200]);
  });

  it('άβολο ποσό (1.234,57 €, 16%, 19/7): Σ χρήσεων = ΑΚΡΙΒΩΣ η αποσβέσιμη αξία, κανένα χαμένο λεπτό', () => {
    const t = terms({ acquisitionCost: 1234.57, depreciationRate: 16, depreciationStartDate: '2023-07-19', residualValue: 34.57 });
    const rows = depreciationScheduleThrough(t, 2040);
    expect(roundToTwo(rows.reduce((sum, r) => sum + r.charge, 0))).toBe(1200);
    expect(rows[rows.length - 1].closingNetBookValue).toBe(34.57);
    expect(rows.every((r) => r.charge >= 0)).toBe(true);
  });
});

describe('Π5 — άκυρα στοιχεία = σφάλμα', () => {
  it.each([
    ['ανύπαρκτη ημέρα έναρξης', { depreciationStartDate: '2026-02-30' }],
    ['κακογραμμένη ημερομηνία εκποίησης', { disposalDate: '30/06/2026' }],
    ['μηδενικός συντελεστής', { depreciationRate: 0 }],
    ['υπολειμματική > κόστος', { residualValue: 20000 }],
    ['αρνητικό κόστος', { acquisitionCost: -1 }],
  ])('%s', (_label, overrides) => {
    expect(() => depreciationForYear(terms(overrides as Partial<DepreciationTerms>), 2026)).toThrow(InvalidDepreciationTermsError);
  });

  it('άκυρο ποσό πετά και για χρήση ΠΡΙΝ από την έναρξη — το «νωρίς» δεν κρύβει το σφάλμα', () => {
    expect(() => depreciationForYear(terms({ depreciationRate: 0, depreciationStartDate: '2030-01-01' }), 2026))
      .toThrow(InvalidDepreciationTermsError);
  });
});
