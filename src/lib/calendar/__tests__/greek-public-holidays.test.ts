/**
 * ADR-841 §7 Α21.16 · Α21.21 — οι αργίες υπολογίζονται, οι κινητές ακολουθούν το Ορθόδοξο Πάσχα, και η
 * Πρωτομαγιά ακολουθεί την υπουργική απόφαση όταν μετατίθεται.
 *
 * 🔑 Οι ημερομηνίες Πάσχα είναι **γνωστές εξωτερικά** (όχι παραγόμενες από τον ίδιο
 * αλγόριθμο): 2024 = 5/5 · 2025 = 20/4 · 2026 = 12/4 · 2027 = 2/5 · 2030 = 28/4.
 */

import {
  greekPublicHolidayOn,
  isProvisionalHoliday,
  labourDayContested,
  orthodoxEasterDateKey,
} from '../greek-public-holidays';

describe('orthodoxEasterDateKey', () => {
  it.each([
    [2013, '2013-05-05'],
    [2016, '2016-05-01'],
    [2021, '2021-05-02'],
    [2022, '2022-04-24'],
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
    expect(greekPublicHolidayOn('2026-05-01')).toBe('labour-day');
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

describe('🔴 Α21.21 — η Πρωτομαγιά μετατίθεται με υπουργική απόφαση', () => {
  it.each([2013, 2016, 2021, 2022, 2024, 2027])('%i: κίνδυνος μετάθεσης (Κυριακή ή Μεγάλη Εβδομάδα/Πάσχα)', (year) => {
    expect(labourDayContested(year)).toBe(true);
  });

  it.each([2025, 2026, 2030])('%i: κανένας κίνδυνος', (year) => {
    expect(labourDayContested(year)).toBe(false);
  });

  it('με απόφαση: η αργία ζει στη ΝΕΑ μέρα, η 1η Μαΐου είναι απλή μέρα', () => {
    expect(greekPublicHolidayOn('2024-05-07')).toBe('labour-day');
    expect(greekPublicHolidayOn('2024-05-01')).toBeNull();
  });

  it('🔑 2016: η 1η Μαΐου ήταν Κυριακή του Πάσχα — μετά την απόφαση φαίνεται ως ΑΥΤΟ', () => {
    expect(greekPublicHolidayOn('2016-05-01')).toBe('easter-sunday');
    expect(greekPublicHolidayOn('2016-05-03')).toBe('labour-day');
  });

  it('🔶 2027 χωρίς απόφαση ακόμη: η 1η Μαΐου μένει αργία, ΣΗΜΑΣΜΕΝΗ ως προσωρινή', () => {
    // ⚠️ Όταν εκδοθεί η απόφαση και μπει στο `config/greek-holiday-decisions.ts`, αυτή η άγκυρα ΠΡΕΠΕΙ να αλλάξει.
    expect(greekPublicHolidayOn('2027-05-01')).toBe('labour-day');
    expect(isProvisionalHoliday('2027-05-01')).toBe(true);
    expect(isProvisionalHoliday('2026-05-01')).toBe(false);
    expect(isProvisionalHoliday('2024-05-07')).toBe(false);
  });
});
