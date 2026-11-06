/**
 * ΑΓΚΥΡΑ — **«ποια γλώσσα και ποιος μήνας;»** *(ADR-928 §5.24.2)*
 *
 * Το γεγονός, μετρημένο στην οθόνη (2026-11-06, nestorconstruct.gr, εφαρμογή στα αγγλικά): ο άξονας της τάσης
 * εξαμήνου στο hub προμηθειών έγραφε «Ιουν · Ιουλ · Αυγ…», γιατί το `Intl.DateTimeFormat(undefined)` παίρνει τη
 * γλώσσα του **λειτουργικού**, όχι της εφαρμογής. Και το `new Date('YYYY-MM-01')` διαβάζεται ως μεσάνυχτα UTC ⇒
 * δυτικά του Greenwich ο μήνας γλιστρά στον **προηγούμενο**.
 *
 * Ρωτά τη ΣΗΜΑΣΙΑ, όχι συμβολοσειρά CLDR: η προσδοκία παράγεται από την ίδια τη μηχανή `Intl` με ρητή γλώσσα και
 * ζώνη UTC, ώστε μια αναβάθμιση των δεδομένων CLDR του Node να μην την κοκκινίζει χωρίς να έχει σπάσει τίποτα.
 */

import { formatCalendarMonth } from '@/lib/intl-formatting';

const expected = (locale: string, options: Intl.DateTimeFormatOptions, monthIndex: number) =>
  new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(new Date(Date.UTC(2026, monthIndex, 1, 12)));

describe("formatCalendarMonth — 'month' (μόνο μήνας, άξονας)", () => {
  it('γράφει τον μήνα στη ΖΗΤΟΥΜΕΝΗ γλώσσα, χωρίς έτος', () => {
    expect(formatCalendarMonth('2026-06', 'en', 'month')).toBe(expected('en', { month: 'short' }, 5));
    expect(formatCalendarMonth('2026-06', 'el', 'month')).toBe(expected('el', { month: 'short' }, 5));
    expect(formatCalendarMonth('2026-06', 'en', 'month')).not.toMatch(/2026/);
  });

  it('ο μήνας ΔΕΝ γλιστρά: Ιανουάριος μένει Ιανουάριος (αγκύρωση UTC)', () => {
    expect(formatCalendarMonth('2026-01', 'en', 'month')).toBe(expected('en', { month: 'short' }, 0));
    expect(formatCalendarMonth('2026-01', 'en', 'month')).not.toBe(expected('en', { month: 'short' }, 11));
  });

  it("οι υπάρχουσες μορφές μένουν ίδιες ('long' / 'short' με έτος)", () => {
    expect(formatCalendarMonth('2026-09', 'en')).toBe(expected('en', { month: 'long', year: 'numeric' }, 8));
    expect(formatCalendarMonth('2026-09', 'en', 'short')).toBe(expected('en', { month: 'short', year: 'numeric' }, 8));
  });

  it('άκυρο κλειδί ⇒ επιστρέφεται αυτούσιο, ποτέ «Invalid Date»', () => {
    expect(formatCalendarMonth('not-a-month', 'en', 'month')).toBe('not-a-month');
  });
});
