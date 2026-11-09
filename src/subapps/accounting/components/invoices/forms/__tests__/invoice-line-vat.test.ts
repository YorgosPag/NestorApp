/**
 * Συντελεστής ΦΠΑ ↔ αιτία εξαίρεσης μιας γραμμής: η αιτία ζει **μόνο** στο 0% — από τον επιλογέα ή από preset.
 */

import { makeLine } from '@/subapps/accounting/services/mydata/__tests__/mydata-fixtures';
import { isVatExemptionMissing } from '@/subapps/accounting/services/mydata/mydata-codes';
import { withLineVatExemption, withLineVatRate } from '../invoice-line-vat';

describe('withLineVatRate', () => {
  it('φεύγοντας από το 0% η αιτία καθαρίζει', () => {
    const line = withLineVatRate(makeLine({ vatRate: 0, vatExemptionCategory: 15 }), 24);
    expect(line.vatRate).toBe(24);
    expect(line.vatExemptionCategory).toBeNull();
  });

  it('στο 0% η υπάρχουσα αιτία μένει', () => {
    expect(withLineVatRate(makeLine({ vatRate: 0, vatExemptionCategory: 15 }), 0).vatExemptionCategory).toBe(15);
  });

  it('νέο 0% χωρίς αιτία ⇒ «λείπει» (ο ίδιος κανόνας με τον έλεγχο πριν τη διαβίβαση)', () => {
    expect(isVatExemptionMissing(withLineVatRate(makeLine({ vatRate: 24 }), 0))).toBe(true);
  });
});

describe('withLineVatExemption', () => {
  it('ορίζει αιτία σε γραμμή 0%', () => {
    const line = withLineVatExemption(makeLine({ vatRate: 0 }), 7);
    expect(line.vatExemptionCategory).toBe(7);
    expect(isVatExemptionMissing(line)).toBe(false);
  });

  it('δεν γράφει αιτία σε γραμμή με ΦΠΑ', () => {
    const original = makeLine({ vatRate: 24 });
    expect(withLineVatExemption(original, 7)).toBe(original);
  });
});
