/**
 * ADR-234 · ADR-919 — άγκυρες του κριτή «πότε λήγει η δόση;» στα σύνορα του πλάνου πληρωμών.
 *
 * Ο κανόνας που φυλάνε: δεκτό είναι **ό,τι στέλνουν οι πελάτες** (`toISOString()`), και τίποτα που δεν είναι
 * στιγμή σε υπαρκτή ημέρα — το παλιό πρόθεμα δεχόταν `2027-02-30xyz`.
 */

import { installmentDueDateSchema, isInstallmentDueDate } from '../installment-due-date';

describe('installment-due-date', () => {
  it('δέχεται ό,τι βγάζει το toISOString() — wizard και επεξεργασία δόσης', () => {
    const wizard = new Date(2026, 10, 29, 10, 23);
    wizard.setMonth(wizard.getMonth() + 3);
    expect(isInstallmentDueDate(wizard.toISOString())).toBe(true);
    expect(isInstallmentDueDate(new Date('2026-11-29').toISOString())).toBe(true);
    expect(isInstallmentDueDate('2028-02-29T00:00:00.000Z')).toBe(true);
  });

  it.each([
    ['ανύπαρκτη ημέρα', '2027-02-30T00:00:00.000Z'],
    ['μη δίσεκτο', '2027-02-29T00:00:00.000Z'],
    ['ουρά μετά το πρόθεμα (περνούσε το παλιό regex)', '2027-02-30xyz'],
    ['σκέτη ημέρα — οι πελάτες στέλνουν στιγμή', '2026-11-29'],
    ['μετατόπιση αντί για Z — χαλά τη σειρά συμβολοσειρών', '2026-11-29T10:23:00+02:00'],
    ['κενό', ''],
  ])('απορρίπτει: %s', (_label, value) => {
    expect(isInstallmentDueDate(value)).toBe(false);
  });

  it('μη συμβολοσειρές ⇒ false, ποτέ σφάλμα', () => {
    for (const value of [null, undefined, 20261129, new Date()]) {
      expect(isInstallmentDueDate(value)).toBe(false);
    }
  });

  it('το σχήμα και ο κριτής απαντούν το ίδιο', () => {
    expect(installmentDueDateSchema.safeParse('2027-02-30T00:00:00.000Z').success).toBe(false);
    expect(installmentDueDateSchema.safeParse('2026-11-29T00:00:00.000Z').success).toBe(true);
  });
});
