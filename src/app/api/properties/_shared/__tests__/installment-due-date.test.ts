/**
 * ADR-234 · ADR-919 — άγκυρες του κριτή «πότε λήγει η δόση;» στα σύνορα του πλάνου πληρωμών.
 *
 * Ο κανόνας που φυλάνε: η λήξη είναι **ημέρα** και στη βάση γράφεται **μόνο** `YYYY-MM-DD`. Η παλιά μορφή των
 * πελατών (στιγμή UTC από `toISOString()`) γίνεται δεκτή μεταβατικά και κανονικοποιείται στην ημέρα της στην Αθήνα.
 * Τίποτα που δεν είναι υπαρκτή ημέρα — το παλιό πρόθεμα δεχόταν `2027-02-30xyz`.
 */

import { installmentDueDateSchema, toInstallmentDueDay } from '../installment-due-date';

describe('installment-due-date', () => {
  it('ημέρα (η νέα μορφή wizard + επεξεργασίας) ⇒ αυτούσια', () => {
    expect(toInstallmentDueDay('2026-11-29')).toBe('2026-11-29');
    expect(toInstallmentDueDay('2028-02-29')).toBe('2028-02-29');
  });

  it('παλιά στιγμή UTC ⇒ η ημέρα της στην Αθήνα', () => {
    // wizard 01:30 Αθήνα 5/11 με παλιό bundle
    expect(toInstallmentDueDay('2026-11-04T23:30:00.000Z')).toBe('2026-11-05');
    // επεξεργασία: μεσάνυχτα UTC
    expect(toInstallmentDueDay(new Date('2026-11-29').toISOString())).toBe('2026-11-29');
  });

  it.each([
    ['ανύπαρκτη ημέρα', '2027-02-30'],
    ['μη δίσεκτο', '2027-02-29'],
    ['ανύπαρκτη ημέρα σε στιγμή', '2027-02-30T00:00:00.000Z'],
    ['ουρά μετά το πρόθεμα (περνούσε το παλιό regex)', '2027-02-30xyz'],
    ['μετατόπιση αντί για Z', '2026-11-29T10:23:00+02:00'],
    ['κενό', ''],
  ])('απορρίπτει: %s', (_label, value) => {
    expect(toInstallmentDueDay(value)).toBeNull();
  });

  it('μη συμβολοσειρές ⇒ null, ποτέ σφάλμα', () => {
    for (const value of [null, undefined, 20261129, new Date()]) {
      expect(toInstallmentDueDay(value)).toBeNull();
    }
  });

  it('το σχήμα κρίνει το ίδιο ΚΑΙ κανονικοποιεί σε ημέρα', () => {
    expect(installmentDueDateSchema.safeParse('2027-02-30').success).toBe(false);
    expect(installmentDueDateSchema.safeParse('2026-11-29').data).toBe('2026-11-29');
    expect(installmentDueDateSchema.safeParse('2026-11-04T23:30:00.000Z').data).toBe('2026-11-05');
  });
});
