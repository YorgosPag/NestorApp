/**
 * sales-stat-values — ο κανόνας «μηδέν/αρνητικό σημαίνει άγνωστο, όχι €0».
 *
 * Ένας κοινός formatter σερβίρει και τις 4 σελίδες πωλήσεων (properties / sold /
 * parking / storage), άρα ένα regression εδώ τις σπάει όλες μαζί. Τα intl-utils
 * είναι mocked: εδώ ελέγχεται η ΔΙΚΗ μας απόφαση (κατώφλι + στρογγυλοποίηση),
 * όχι η μορφοποίηση νομίσματος.
 */

jest.mock('@/lib/intl-utils', () => ({
  formatCurrencyCompact: (amount: number) => `compact:${amount}`,
  formatCurrencyWhole: (amount: number) => `whole:${amount}`,
}));

import {
  SALES_STAT_EMPTY,
  salesMoneyValue,
  salesPerSqmValue,
} from '../sales-stat-values';

describe('salesMoneyValue', () => {
  it('μορφοποιεί συμπτυγμένα κάθε θετικό ποσό', () => {
    expect(salesMoneyValue(1250000)).toBe('compact:1250000');
  });

  it('δίνει παύλα στο μηδέν — «δεν ξέρουμε», όχι «€0»', () => {
    expect(salesMoneyValue(0)).toBe(SALES_STAT_EMPTY);
  });

  it('δίνει παύλα σε αρνητικό ποσό', () => {
    expect(salesMoneyValue(-1)).toBe(SALES_STAT_EMPTY);
  });
});

describe('salesPerSqmValue', () => {
  it('στρογγυλοποιεί σε ακέραιο ΠΡΙΝ τη μορφοποίηση', () => {
    expect(salesPerSqmValue(2499.6)).toBe('whole:2500');
  });

  it('δίνει παύλα στο μηδέν', () => {
    expect(salesPerSqmValue(0)).toBe(SALES_STAT_EMPTY);
  });

  it('δεν στρογγυλοποιεί ένα θετικό κλάσμα σε μηδέν-παύλα', () => {
    expect(salesPerSqmValue(0.4)).toBe('whole:0');
  });
});
