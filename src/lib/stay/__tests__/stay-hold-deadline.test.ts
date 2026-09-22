/**
 * ADR-835 §4.11 · §23.3 — **οι άγκυρες της προθεσμίας απάντησης** (hold TTL).
 *
 * Κάθε άγκυρα ονομάζει ένα ψέμα που θα έλεγε η οθόνη αν η συνάρτηση έσπαγε:
 * · λάθος βαθμίδα ⇒ «απάντηση σε 72 ώρες» για άφιξη αύριο
 * · χωρίς ρολόι ανθρώπου ⇒ αίτημα Παρασκευή 23:40 «ξοδεύει» το Σαββατοκύριακο
 * · χωρίς ταβάνι ⇒ ωράριο «Σάββατο 10–11» κάνει τις 48 ώρες δύο εβδομάδες
 * · χωρίς ταβάνι άφιξης ⇒ ο επισκέπτης μαθαίνει «όχι» ενώ στέκεται στην πόρτα
 */

import type { WeeklyHours } from '@/lib/calendar/weekly-hours';
import { formatDateTime } from '@/lib/intl-formatting';
import elShortStay from '@/i18n/locales/el/short-stay.json';
import enShortStay from '@/i18n/locales/en/short-stay.json';
import {
  STAY_HOLD_MIN_WINDOW_MINUTES,
  STAY_HOLD_TIME_FORMAT,
  STAY_HOLD_TIER_RULES,
  stayHoldDeadline,
  stayHoldTierOf,
} from '@/lib/stay/stay-hold-deadline';
import type { StayClock } from '@/types/stay-rules';

/** Τρίτη 1/9/2026, 10:00 Αθήνας (UTC+3). */
const TUESDAY_10: StayClock = { today: '2026-09-01', minutes: 600, instant: '2026-09-01T07:00:00.000Z' };

const everyDay = (opens: string, closes: string): WeeklyHours => ({
  1: [{ opens, closes }], 2: [{ opens, closes }], 3: [{ opens, closes }], 4: [{ opens, closes }],
  5: [{ opens, closes }], 6: [{ opens, closes }], 7: [{ opens, closes }],
});

const DAY = 1440;

describe('Β — η κλίμακα (μία, σε πίνακα)', () => {
  it.each([
    { lead: 0, tier: 'imminent' },
    { lead: 2 * DAY - 1, tier: 'imminent' },
    // 🔴 Το κενό του §4.11: 48h–7 ημέρες ⇒ 24h (το καθολικό ρολόι της αγοράς).
    { lead: 2 * DAY, tier: 'soon' },
    { lead: 7 * DAY - 1, tier: 'soon' },
    { lead: 7 * DAY, tier: 'upcoming' },
    { lead: 30 * DAY - 1, tier: 'upcoming' },
    { lead: 30 * DAY, tier: 'distant' },
  ])('άφιξη σε $lead λεπτά ⇒ $tier', ({ lead, tier }) => {
    expect(stayHoldTierOf(lead)).toBe(tier);
  });

  it('οι ώρες της κλίμακας είναι 2 · 24 · 48 · 72', () => {
    expect([
      STAY_HOLD_TIER_RULES.imminent.responseHours, STAY_HOLD_TIER_RULES.soon.responseHours,
      STAY_HOLD_TIER_RULES.upcoming.responseHours, STAY_HOLD_TIER_RULES.distant.responseHours,
    ]).toEqual([2, 24, 48, 72]);
  });
});

describe('Ρ — ρολόι τοίχου (προεπιλογή, η πρακτική της αγοράς)', () => {
  // 🔴 ADR-835 §23.12 Ε1: ως 19/09 εδώ έγραφε `bound: 'response-hours'` — η άγκυρα **κλείδωνε το σφάλμα**,
  //    και η οθόνη έλεγε «μέσα στις ώρες απόκρισής του» σε οικοδεσπότη που δεν δήλωσε ώρες (μετρημένο ζωντανά).
  it('🔴 άφιξη αύριο ⇒ 2 ώρες από τώρα, ταβάνι `tier` — ΟΧΙ «ώρες απόκρισης» που κανείς δεν δήλωσε', () => {
    expect(stayHoldDeadline({ clock: TUESDAY_10, checkIn: '2026-09-02', responseHours: null })).toEqual({
      kind: 'held', expiresAt: '2026-09-01T09:00:00.000Z', tier: 'imminent', bound: 'tier',
    });
  });

  it('άφιξη σε 16 ημέρες ⇒ 48 ώρες', () => {
    const hold = stayHoldDeadline({ clock: TUESDAY_10, checkIn: '2026-09-17', responseHours: null });
    expect(hold).toMatchObject({ kind: 'held', tier: 'upcoming', expiresAt: '2026-09-03T07:00:00.000Z' });
  });
});

describe('🏆 Α — ρολόι ανθρώπου', () => {
  // Παρασκευή 4/9/2026, 23:40 Αθήνας = 20:40Z. Ώρες απόκρισης 09:00–21:00 κάθε μέρα (12 ώρες/ημέρα).
  const FRIDAY_2340: StayClock = { today: '2026-09-04', minutes: 23 * 60 + 40, instant: '2026-09-04T20:40:00.000Z' };

  it('αίτημα Παρασκευή 23:40, 48 ώρες ανοιχτού χρόνου ⇒ Τρίτη 21:00 — η νύχτα ΔΕΝ ξοδεύεται', () => {
    const hold = stayHoldDeadline({ clock: FRIDAY_2340, checkIn: '2026-09-20', responseHours: everyDay('09:00', '21:00') });
    // Σάβ + Κυρ + Δευ + Τρί × 12h = 48h ⇒ Τρίτη 8/9 21:00 Αθήνας = 18:00Z.
    expect(hold).toEqual({ kind: 'held', expiresAt: '2026-09-08T18:00:00.000Z', tier: 'upcoming', bound: 'response-hours' });
  });

  it('🔴 ο παρονομαστής: ΧΩΡΙΣ ώρες απόκρισης η ίδια στιγμή δίνει Κυριακή 23:40', () => {
    const hold = stayHoldDeadline({ clock: FRIDAY_2340, checkIn: '2026-09-20', responseHours: null });
    // Ίδια βαθμίδα, άλλο ταβάνι στο όνομα: με ώρες `response-hours` (πάνω), χωρίς ώρες `tier`.
    expect(hold).toMatchObject({ expiresAt: '2026-09-06T20:40:00.000Z', bound: 'tier' });
  });

  it('🔑 οι αργίες ΔΕΝ παγώνουν το ρολόι — οι ώρες είναι δήλωση ανθρώπου, όχι ωράριο καταστήματος', () => {
    // 28/10 (εθνική αργία, Τετάρτη). Ώρες 09:00–21:00 · αίτημα Τρίτη 27/10 20:00 · άφιξη σε 16 ημέρες.
    const clock: StayClock = { today: '2026-10-27', minutes: 20 * 60, instant: '2026-10-27T18:00:00.000Z' };
    const hold = stayHoldDeadline({ clock, checkIn: '2026-11-12', responseHours: everyDay('09:00', '21:00') });
    // 1h Τρίτη + 12h Τετ (αργία, ΜΕΤΡΑ) + 12h Πέμ + 12h Παρ + 11h Σάβ ⇒ Σάββατο 31/10 20:00 Αθήνας (χειμερινή: 18:00Z).
    expect(hold).toMatchObject({ kind: 'held', bound: 'response-hours', expiresAt: '2026-10-31T18:00:00.000Z' });
  });
});

describe('🏆 Τ — τα ταβάνια', () => {
  it('ταβάνι τέντωσης: ωράριο «μόνο Σάββατο 10–11» ⇒ το πολύ 2× (96 ώρες για 48)', () => {
    const sparse: WeeklyHours = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [{ opens: '10:00', closes: '11:00' }], 7: [] };
    const hold = stayHoldDeadline({ clock: TUESDAY_10, checkIn: '2026-09-20', responseHours: sparse });
    expect(hold).toEqual({ kind: 'held', expiresAt: '2026-09-05T07:00:00.000Z', tier: 'upcoming', bound: 'stretch' });
  });

  it('ταβάνι άφιξης: άφιξη ΣΗΜΕΡΑ στις 11:00 ⇒ απάντηση ως τις 12:00 της άφιξης', () => {
    const clock: StayClock = { ...TUESDAY_10, minutes: 660, instant: '2026-09-01T08:00:00.000Z' };
    expect(stayHoldDeadline({ clock, checkIn: '2026-09-01', responseHours: null })).toEqual({
      kind: 'held', expiresAt: '2026-09-01T09:00:00.000Z', tier: 'imminent', bound: 'arrival',
    });
  });

  it(`🔴 λιγότερα από ${STAY_HOLD_MIN_WINDOW_MINUTES}′ ως το ταβάνι ⇒ too-late — προθεσμία 20 λεπτών είναι παγίδα`, () => {
    const clock: StayClock = { ...TUESDAY_10, minutes: 700, instant: '2026-09-01T08:40:00.000Z' };
    expect(stayHoldDeadline({ clock, checkIn: '2026-09-01', responseHours: null })).toEqual({ kind: 'too-late' });
  });

  it('άφιξη στο παρελθόν ⇒ too-late', () => {
    expect(stayHoldDeadline({ clock: TUESDAY_10, checkIn: '2026-08-31', responseHours: null })).toEqual({ kind: 'too-late' });
  });
});

/**
 * ADR-777 §8.60.21.7 — μετρημένο ζωντανά 2026-09-22: η υπόσχεση έγραφε «ως Πέμ 24 Σεπ 2026, 10:17 π.μ..».
 * Η άγκυρα αποδίδει την προθεσμία με τη **ζωντανή** μορφή μέσα στα **πραγματικά** πρότυπα `promise.*`.
 */
describe('🔴 Μ — η μορφή της προθεσμίας (24ωρο, ώρα Αθήνας)', () => {
  const promisesOf = (locale: 'el' | 'en'): readonly string[] =>
    Object.values((locale === 'el' ? elShortStay : enShortStay).request.promise);

  it.each(['el', 'en'] as const)('%s: καμία υπόσχεση δεν γράφει διπλή τελεία μετά την ώρα', (locale) => {
    const until = formatDateTime('2026-09-24T07:17:00.000Z', STAY_HOLD_TIME_FORMAT, locale);
    for (const template of promisesOf(locale)) {
      expect(template.replace('{until}', until)).not.toMatch(/\.\./);
    }
  });

  it('η ώρα γράφεται 24ωρα σε ώρα Αθήνας — 14:05, όχι «02:05 μ.μ.»', () => {
    expect(formatDateTime('2026-09-24T11:05:00.000Z', STAY_HOLD_TIME_FORMAT, 'el')).toContain('14:05');
  });

  it('τα μεσάνυχτα Αθήνας γράφονται 00:00, ποτέ 24:00', () => {
    const midnight = formatDateTime('2026-09-23T21:00:00.000Z', STAY_HOLD_TIME_FORMAT, 'el');
    expect(midnight).toContain('00:00');
    expect(midnight).not.toContain('24:00');
  });
});
