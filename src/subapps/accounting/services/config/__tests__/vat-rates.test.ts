/**
 * ⚓ Ο ΕΝΑΣ πίνακας συντελεστών ΦΠΑ (ADR-928 Φ0) — προεπιλογή, στενευτής, ταυτότητα με την επανεξαγωγή.
 */

import {
  GREEK_STANDARD_VAT_RATE,
  GREEK_VAT_RATE_PERCENTS,
  GREEK_VAT_RATES,
  isGreekVatRatePercent,
} from '../vat-rates';
import { GREEK_VAT_RATES as REEXPORTED } from '../vat-config';

describe('vat-rates — ο ΕΝΑΣ πίνακας', () => {
  it('ο κανονικός συντελεστής είναι η γραμμή standard_24 (η πρώτη)', () => {
    expect(GREEK_VAT_RATES[0].code).toBe('standard_24');
    expect(GREEK_STANDARD_VAT_RATE).toBe(24);
  });

  it('τα ποσοστά είναι ακριβώς οι γραμμές του πίνακα, με τη σειρά του', () => {
    expect(GREEK_VAT_RATE_PERCENTS).toEqual([24, 13, 6, 0]);
  });

  it('ο στενευτής δέχεται μόνο συντελεστές του πίνακα', () => {
    for (const rate of GREEK_VAT_RATE_PERCENTS) expect(isGreekVatRatePercent(rate)).toBe(true);
    for (const value of [23, 17, -1, 24.5, '24', null, undefined, Number.NaN]) {
      expect(isGreekVatRatePercent(value)).toBe(false);
    }
  });

  it('το vat-config επανεξάγει τον ΙΔΙΟ πίνακα, όχι αντίγραφο', () => {
    expect(REEXPORTED).toBe(GREEK_VAT_RATES);
  });
});
