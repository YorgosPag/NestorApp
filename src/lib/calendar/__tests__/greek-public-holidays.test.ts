/**
 * ADR-841 §7 Α21.16 — οι αργίες υπολογίζονται, και οι κινητές ακολουθούν το Ορθόδοξο Πάσχα.
 *
 * 🔑 Οι ημερομηνίες Πάσχα είναι **γνωστές εξωτερικά** (όχι παραγόμενες από τον ίδιο
 * αλγόριθμο): 2024 = 5/5 · 2025 = 20/4 · 2026 = 12/4 · 2027 = 2/5 · 2030 = 28/4.
 */

import { greekPublicHolidayOn, orthodoxEasterDateKey } from '../greek-public-holidays';

describe('orthodoxEasterDateKey', () => {
  it.each([
    [2024, '2024-05-05'],
    [2025, '2025-04-20'],
    [2026, '2026-04-12'],
    [2027, '2027-05-02'],
    [2030, '2030-04-28'],
  ])('%i → %s', (year, expected) => {
    expect(orthodoxEasterDateKey(year)).toBe(expected);
  });
});

describe('greekPublicHolidayOn', () => {
  it('σταθερές αργίες', () => {
    expect(greekPublicHolidayOn('2026-03-25')).toBe('independence-day');
    expect(greekPublicHolidayOn('2026-10-28')).toBe('ochi-day');
    expect(greekPublicHolidayOn('2026-12-26')).toBe('boxing-day');
  });

  it('κινητές αργίες 2026 — από το Πάσχα της 12/4', () => {
    expect(greekPublicHolidayOn('2026-02-23')).toBe('clean-monday');
    expect(greekPublicHolidayOn('2026-04-10')).toBe('good-friday');
    expect(greekPublicHolidayOn('2026-04-13')).toBe('easter-monday');
    expect(greekPublicHolidayOn('2026-06-01')).toBe('whit-monday');
  });

  it('η Καθαρά Δευτέρα ΠΕΦΤΕΙ ΣΕ ΑΛΛΗ ΜΕΡΑ κάθε χρόνο — ένας πίνακας θα το έχανε', () => {
    expect(greekPublicHolidayOn('2027-03-15')).toBe('clean-monday');
    expect(greekPublicHolidayOn('2026-03-15')).toBeNull();
  });

  it('εργάσιμη μέρα και σκουπίδι → null', () => {
    expect(greekPublicHolidayOn('2026-09-14')).toBeNull();
    expect(greekPublicHolidayOn('14/09/2026')).toBeNull();
  });
});
