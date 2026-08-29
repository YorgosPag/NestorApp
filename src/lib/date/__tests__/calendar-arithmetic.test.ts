/**
 * 🔴 ADR-828 §1 — άγκυρες του **ψαλιδίσματος** στο τέλος του μήνα.
 *
 * Ο κανόνας που φυλάνε: ο άνθρωπος που έγραψε «31/1» και τράβηξε τη λαβή εννοεί «το τέλος
 * του επόμενου μήνα», ποτέ «τρεις μέρες μέσα σε αυτόν που ακολουθεί».
 */

import {
  addMonthsClampedUtc,
  addYearsClampedUtc,
  daysInMonth,
} from '../calendar-arithmetic';

/** Οι δοκιμές μιλούν σε ημερομηνίες, όχι σε χιλιοστά — ο βοηθός κρατά την πρόθεση ορατή. */
const utc = (year: number, month: number, day: number): Date =>
  new Date(Date.UTC(year, month - 1, day));

const iso = (date: Date): string => date.toISOString().slice(0, 10);

describe('daysInMonth', () => {
  it('γνωρίζει τους μήνες των 30 και των 31', () => {
    expect(daysInMonth(2026, 1)).toBe(31);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });

  it('γνωρίζει τα δίσεκτα', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(1900, 2)).toBe(28);
  });
});

describe('addMonthsClampedUtc', () => {
  /** 🔴 Το test για το οποίο γράφτηκε ολόκληρο το αρχείο. */
  it('31 Ιανουαρίου + 1 μήνας = 28 Φεβρουαρίου, ΠΟΤΕ 3 Μαρτίου', () => {
    expect(iso(addMonthsClampedUtc(utc(2026, 1, 31), 1))).toBe('2026-02-28');
    expect(iso(addMonthsClampedUtc(utc(2026, 1, 31), 1))).not.toBe('2026-03-03');
  });

  it('σε δίσεκτο έτος ψαλιδίζει στις 29', () => {
    expect(iso(addMonthsClampedUtc(utc(2024, 1, 31), 1))).toBe('2024-02-29');
  });

  it('31 Μαΐου − 1 μήνας = 30 Απριλίου', () => {
    expect(iso(addMonthsClampedUtc(utc(2026, 5, 31), -1))).toBe('2026-04-30');
  });

  it('μέρα που χωράει μένει ανέγγιχτη', () => {
    expect(iso(addMonthsClampedUtc(utc(2026, 1, 15), 1))).toBe('2026-02-15');
  });

  it('περνά τα σύνορα του έτους και προς τις δύο κατευθύνσεις', () => {
    expect(iso(addMonthsClampedUtc(utc(2026, 12, 15), 1))).toBe('2027-01-15');
    expect(iso(addMonthsClampedUtc(utc(2026, 1, 15), -1))).toBe('2025-12-15');
    expect(iso(addMonthsClampedUtc(utc(2026, 6, 10), 18))).toBe('2027-12-10');
    expect(iso(addMonthsClampedUtc(utc(2026, 6, 10), -18))).toBe('2024-12-10');
  });

  it('βήμα μηδέν επιστρέφει την ίδια ημερομηνία', () => {
    expect(iso(addMonthsClampedUtc(utc(2026, 8, 29), 0))).toBe('2026-08-29');
  });

  it('δεν αγγίζει το όρισμα', () => {
    const source = utc(2026, 1, 31);
    addMonthsClampedUtc(source, 5);
    expect(iso(source)).toBe('2026-01-31');
  });
});

describe('addYearsClampedUtc', () => {
  it('29 Φεβρουαρίου + 1 έτος = 28 Φεβρουαρίου', () => {
    expect(iso(addYearsClampedUtc(utc(2024, 2, 29), 1))).toBe('2025-02-28');
  });

  it('29 Φεβρουαρίου + 4 έτη μένει 29 Φεβρουαρίου', () => {
    expect(iso(addYearsClampedUtc(utc(2024, 2, 29), 4))).toBe('2028-02-29');
  });

  it('πηγαίνει και προς τα πίσω', () => {
    expect(iso(addYearsClampedUtc(utc(2026, 8, 29), -2))).toBe('2024-08-29');
  });
});
