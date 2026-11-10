/**
 * Συντελεστής ΦΠΑ ↔ αιτία εξαίρεσης: η αιτία ζει **μόνο** στο 0% — γραμμή τιμολογίου ή υπηρεσία (preset), ίδιος κανόνας.
 */

import { makeLine } from '@/subapps/accounting/services/mydata/__tests__/mydata-fixtures';
import { isVatExemptionMissing } from '@/subapps/accounting/services/mydata/mydata-codes';
import { withVatExemption, withVatRate } from '../vat-rate-transition';

describe('withVatRate', () => {
  it('φεύγοντας από το 0% η αιτία καθαρίζει', () => {
    const line = withVatRate(makeLine({ vatRate: 0, vatExemptionCategory: 15 }), 24);
    expect(line.vatRate).toBe(24);
    expect(line.vatExemptionCategory).toBeNull();
  });

  it('στο 0% η υπάρχουσα αιτία μένει', () => {
    expect(withVatRate(makeLine({ vatRate: 0, vatExemptionCategory: 15 }), 0).vatExemptionCategory).toBe(15);
  });

  it('νέο 0% χωρίς αιτία ⇒ «λείπει» (ο ίδιος κανόνας με τον έλεγχο πριν τη διαβίβαση)', () => {
    expect(isVatExemptionMissing(withVatRate(makeLine({ vatRate: 24 }), 0))).toBe(true);
  });
});

describe('withVatExemption', () => {
  it('ορίζει αιτία σε γραμμή 0%', () => {
    const line = withVatExemption(makeLine({ vatRate: 0 }), 7);
    expect(line.vatExemptionCategory).toBe(7);
    expect(isVatExemptionMissing(line)).toBe(false);
  });

  it('δεν γράφει αιτία σε γραμμή με ΦΠΑ', () => {
    const original = makeLine({ vatRate: 24 });
    expect(withVatExemption(original, 7)).toBe(original);
  });
});

describe('ίδιος κανόνας για υπηρεσία (ServicePreset) — ADR-ACC-003 §22.3', () => {
  const preset = { presetId: 'sp_1', vatRate: 0, vatExemptionCategory: 15 };

  it('φεύγοντας από το 0% η αιτία της υπηρεσίας καθαρίζει, τα υπόλοιπα πεδία μένουν', () => {
    expect(withVatRate(preset, 13)).toEqual({ presetId: 'sp_1', vatRate: 13, vatExemptionCategory: null });
  });

  it('δεν μεταλλάσσει το όρισμα', () => {
    withVatRate(preset, 24);
    expect(preset.vatExemptionCategory).toBe(15);
  });
});
