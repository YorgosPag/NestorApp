/**
 * ADR-841 §7 Α21.21 Φάση Β — περίοδοι αργιών (υπολογισμένες), ωρίμανση ερώτησης (21/7), provisional εκτός, «πέρσι».
 */

import { HOLIDAY_QUESTION_POLICY } from '@/config/holiday-question-policy';

import { addDaysToDateKey } from '../date-key';
import { greekPublicHolidayOn } from '../greek-public-holidays';
import {
  dueHolidaySeasons,
  holidaySeasons,
  lastYearAnswer,
  pendingHolidayItems,
  type HoursOfLocation,
  type SettledHolidayAnswer,
} from '../holiday-question';
import type { WeeklyHours } from '../weekly-hours';

/** Δευ–Σάβ ανοιχτά, Κυριακή κλειστά. */
const MON_SAT: WeeklyHours = {
  1: [{ opens: '09:00', closes: '17:00' }],
  2: [{ opens: '09:00', closes: '17:00' }],
  3: [{ opens: '09:00', closes: '17:00' }],
  4: [{ opens: '09:00', closes: '17:00' }],
  5: [{ opens: '09:00', closes: '17:00' }],
  6: [{ opens: '09:00', closes: '14:00' }],
  7: [],
};

const shop = (overrides: Partial<HoursOfLocation> = {}): HoursOfLocation => ({
  id: 'sloc_a', hours: MON_SAT, specialHours: [], ...overrides,
});

/** 10:00 ώρα Ελλάδας (χειμώνας UTC+2). */
const winter = (dateKey: string): Date => new Date(`${dateKey}T08:00:00Z`);

describe('holidaySeasons — υπολογισμένες, όχι γραμμένες', () => {
  it('🔑 Χριστούγεννα → Θεοφάνεια = ΜΙΑ περίοδος, πάνω από την αλλαγή χρονιάς', () => {
    const seasons = holidaySeasons('2026-12-01');
    expect(seasons[0]).toEqual({ key: '2026-12-25', lastDate: '2027-01-06' });
  });

  it('🔑 Καθαρά Δευτέρα 2027 (15/3) + 25η Μαρτίου = μία · Μ. Παρασκευή → Δευτέρα του Πάσχα 2027 = μία', () => {
    const keys = holidaySeasons('2027-02-02').map(({ key, lastDate }) => `${key}..${lastDate}`);
    expect(keys.slice(0, 2)).toEqual(['2027-03-15..2027-03-25', '2027-04-30..2027-05-03']);
  });

  it('🔴 περίοδος σε εξέλιξη κρατά το ΙΔΙΟ κλειδί (26/12 και 2/1)', () => {
    expect(holidaySeasons('2026-12-26')[0]?.key).toBe('2026-12-25');
    expect(holidaySeasons('2027-01-02')[0]?.key).toBe('2026-12-25');
  });

  it('🔴 άγκυρα: καμία αργία από 7/1 ως 14/2 σε ΚΑΘΕ χρονιά 1901–2099 ⇒ η 1/2 δεν ανήκει ποτέ σε περίοδο', () => {
    expect(HOLIDAY_QUESTION_POLICY.seasonGapDays).toBeLessThan(39);
    const offenders: string[] = [];
    for (let year = 1901; year <= 2099; year += 1) {
      for (let date: string | null = `${year}-01-07`; date !== null && date <= `${year}-02-14`; date = addDaysToDateKey(date, 1)) {
        if (greekPublicHolidayOn(date) !== null) offenders.push(date);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('pendingHolidayItems — ό,τι λέει ο ΕΝΑΣ κριτής, χωρίς σήμερα και χωρίς provisional', () => {
  it('ανεβαίνει σε μέρες ανοιχτές (Παρ 25/12 · Σάβ 26/12)', () => {
    const dates = pendingHolidayItems(shop(), winter('2026-12-04')).map(({ date }) => date);
    expect(dates.slice(0, 4)).toEqual(['2026-12-25', '2026-12-26', '2027-01-01', '2027-01-06']);
  });

  it('🔴 η σημερινή αργία ΔΕΝ ρωτιέται — αργά για να βοηθήσει', () => {
    const dates = pendingHolidayItems(shop(), winter('2026-12-25')).map(({ date }) => date);
    expect(dates).not.toContain('2026-12-25');
    expect(dates[0]).toBe('2026-12-26');
  });

  it('🔴 Πρωτομαγιά 2027 (Μ. Σάββατο, χωρίς απόφαση) ΔΕΝ ρωτιέται', () => {
    const dates = pendingHolidayItems(shop(), new Date('2027-04-15T07:00:00Z')).map(({ date }) => date);
    expect(dates).toContain('2027-04-30');
    expect(dates).not.toContain('2027-05-01');
  });

  it('χωρίς εβδομαδιαίο ωράριο ⇒ τίποτα να ρωτηθεί', () => {
    expect(pendingHolidayItems(shop({ hours: null }), winter('2026-12-04'))).toEqual([]);
  });
});

describe('dueHolidaySeasons — 21 ημέρες πριν, υπενθύμιση στις 7', () => {
  it('22 ημέρες πριν ⇒ τίποτα', () => {
    expect(dueHolidaySeasons([shop()], winter('2026-12-03'))).toEqual([]);
  });

  it('🔑 21 ημέρες πριν ⇒ ΜΙΑ ερώτηση για όλη την περίοδο (4 μέρες)', () => {
    const [due, ...rest] = dueHolidaySeasons([shop()], winter('2026-12-04'));
    expect(rest).toEqual([]);
    expect(due).toMatchObject({ season: { key: '2026-12-25' }, leadDays: 21, stage: 'ask' });
    expect(due?.items.map(({ date }) => date)).toEqual(['2026-12-25', '2026-12-26', '2027-01-01', '2027-01-06']);
  });

  it('7 ημέρες πριν ⇒ στάδιο υπενθύμισης', () => {
    expect(dueHolidaySeasons([shop()], winter('2026-12-18'))[0]).toMatchObject({ leadDays: 7, stage: 'reminder' });
  });

  it('🔑 δύο καταστήματα ⇒ ΕΝΑ email: οι μέρες και των δύο στην ίδια περίοδο', () => {
    const [due] = dueHolidaySeasons([shop(), shop({ id: 'sloc_b' })], winter('2026-12-04'));
    expect(new Set(due?.items.map(({ locationId }) => locationId))).toEqual(new Set(['sloc_a', 'sloc_b']));
  });

  it('🔴 απαντημένο στη φόρμα ΔΕΝ ξαναρωτιέται · ο χρόνος μετρά ως την πρώτη ΑΝΑΠΑΝΤΗΤΗ', () => {
    const answered = shop({ specialHours: [{ date: '2026-12-25', kind: 'closed' }] });
    expect(dueHolidaySeasons([answered], winter('2026-12-04'))).toEqual([]);
    const [due] = dueHolidaySeasons([answered], winter('2026-12-05'));
    expect(due).toMatchObject({ season: { key: '2026-12-25' }, leadDays: 21 });
    expect(due?.items.map(({ date }) => date)).not.toContain('2026-12-25');
  });
});

describe('lastYearAnswer — «Πέρσι: Κλειστά»', () => {
  const history: SettledHolidayAnswer[] = [
    { locationId: 'sloc_a', date: '2025-04-21', holiday: 'easter-monday', kind: 'closed' },
    { locationId: 'sloc_b', date: '2025-12-25', holiday: 'christmas', kind: 'regular' },
  ];

  it('🔑 κινητή αργία ταιριάζει κατά ταυτότητα, όχι ημερομηνία', () => {
    expect(lastYearAnswer(history, { locationId: 'sloc_a', date: '2026-04-13', holiday: 'easter-monday' })).toBe('closed');
  });

  it('άλλο κατάστημα ή πριν από δύο χρόνια ⇒ null', () => {
    expect(lastYearAnswer(history, { locationId: 'sloc_a', date: '2026-12-25', holiday: 'christmas' })).toBeNull();
    expect(lastYearAnswer(history, { locationId: 'sloc_a', date: '2027-04-03', holiday: 'easter-monday' })).toBeNull();
  });
});
