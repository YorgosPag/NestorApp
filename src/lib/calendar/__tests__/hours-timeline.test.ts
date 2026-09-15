/**
 * ADR-841 §7 Α21.16.8 · Α21.21 — «ανοιχτό τώρα;» πάνω σε ημερομηνίες: σπαστό ωράριο, μετά τα μεσάνυχτα, 24 ώρες,
 * και οι τρεις διορθώσεις της Α21.21 (αργία σε κλειστή μέρα · αργία μπροστά · βάρδια της παραμονής) με ειδικές ώρες.
 */

import { holidaysNeedingAnswer, isSoon, openStateAt, upcomingDays } from '../hours-timeline';
import { WEEKLY_HOURS_PRESETS } from '../weekly-hours-editing';
import type { WeeklyHours } from '../weekly-hours';

/** Σπαστό ωράριο καταστήματος: Δευ–Παρ 09–14 & 17:30–21, Σάβ 09–14, Κυρ κλειστά. */
const SPLIT: WeeklyHours = {
  1: [{ opens: '09:00', closes: '14:00' }, { opens: '17:30', closes: '21:00' }],
  2: [{ opens: '09:00', closes: '14:00' }, { opens: '17:30', closes: '21:00' }],
  3: [{ opens: '09:00', closes: '14:00' }],
  4: [{ opens: '09:00', closes: '14:00' }, { opens: '17:30', closes: '21:00' }],
  5: [{ opens: '09:00', closes: '14:00' }, { opens: '17:30', closes: '21:00' }],
  6: [{ opens: '09:00', closes: '14:00' }],
  7: [],
};

const CLOSED: WeeklyHours = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] };

const NO_HOLIDAYS = { holidayOn: () => null };

describe('openStateAt — σπαστό ωράριο', () => {
  it('ανοιχτό μέσα στο πρωινό διάστημα', () => {
    // Δευτέρα 14/9/2026, 10:00 ώρα Ελλάδας (UTC+3)
    expect(openStateAt(SPLIT, new Date('2026-09-14T07:00:00Z'), NO_HOLIDAYS)).toEqual({
      kind: 'open', closes: { weekday: 1, time: '14:00', inDays: 0, inMinutes: 240 },
    });
  });

  it('🔴 ΣΠΑΣΤΟ: στις 15:00 είναι ΚΛΕΙΣΤΟ και ανοίγει 17:30 την ίδια μέρα', () => {
    expect(openStateAt(SPLIT, new Date('2026-09-14T12:00:00Z'), NO_HOLIDAYS)).toEqual({
      kind: 'closed', next: { weekday: 1, time: '17:30', inDays: 0, inMinutes: 150 }, uncertain: null,
    });
  });

  it('Σάββατο βράδυ → ανοίγει Δευτέρα 09:00 (η Κυριακή παραλείπεται)', () => {
    expect(openStateAt(SPLIT, new Date('2026-09-19T17:00:00Z'), NO_HOLIDAYS)).toEqual({
      kind: 'closed', next: { weekday: 1, time: '09:00', inDays: 2, inMinutes: 2220 }, uncertain: null,
    });
  });

  it('🔴 ίδια ημέρα της ΕΠΟΜΕΝΗΣ εβδομάδας → inDays = 7, ποτέ «σήμερα»', () => {
    const mondayOnly: WeeklyHours = { ...CLOSED, 1: [{ opens: '09:00', closes: '12:00' }] };
    // Δευτέρα 14/9/2026, 20:00 ώρα Ελλάδας
    expect(openStateAt(mondayOnly, new Date('2026-09-14T17:00:00Z'), NO_HOLIDAYS)).toEqual({
      kind: 'closed', next: { weekday: 1, time: '09:00', inDays: 7, inMinutes: 9420 }, uncertain: null,
    });
  });

  it('η ώρα κλεισίματος ΔΕΝ είναι ανοιχτή (μισάνοιχτο διάστημα)', () => {
    expect(openStateAt(SPLIT, new Date('2026-09-14T11:00:00Z'), NO_HOLIDAYS).kind).toBe('closed');
  });

  it('🔴 σε αργία που θα ήταν ανοιχτά λέει «αργία», ΟΧΙ «ανοιχτό» — ούτε «κλειστό»', () => {
    // Δευτέρα του Πάσχα 2026-04-13, 10:00
    expect(openStateAt(SPLIT, new Date('2026-04-13T07:00:00Z'))).toEqual({
      kind: 'holiday', holiday: 'easter-monday',
    });
  });

  it('κλειστά όλη την εβδομάδα → next = null', () => {
    expect(openStateAt(CLOSED, new Date('2026-09-14T07:00:00Z'), NO_HOLIDAYS)).toEqual({
      kind: 'closed', next: null, uncertain: null,
    });
  });
});

describe('openStateAt — μετά τα μεσάνυχτα και 24 ώρες (Α21.16.8)', () => {
  it('🔴 Παρασκευή 22:00–03:00: το Σάββατο 01:00 είναι ΑΝΟΙΧΤΟ και κλείνει 03:00', () => {
    const friday: WeeklyHours = { ...CLOSED, 5: [{ opens: '22:00', closes: '03:00' }] };
    // Σάββατο 19/9/2026, 01:00 ώρα Ελλάδας
    expect(openStateAt(friday, new Date('2026-09-18T22:00:00Z'), NO_HOLIDAYS)).toEqual({
      kind: 'open', closes: { weekday: 6, time: '03:00', inDays: 0, inMinutes: 120 },
    });
  });

  it('🔴 η βάρδια της Κυριακής συνεχίζει μέσα στη Δευτέρα', () => {
    const sunday: WeeklyHours = { ...CLOSED, 7: [{ opens: '22:00', closes: '02:00' }] };
    // Δευτέρα 14/9/2026, 01:00 ώρα Ελλάδας
    expect(openStateAt(sunday, new Date('2026-09-13T22:00:00Z'), NO_HOLIDAYS)).toEqual({
      kind: 'open', closes: { weekday: 1, time: '02:00', inDays: 0, inMinutes: 60 },
    });
  });

  it('συνεχόμενα ανοίγματα ΣΥΓΧΩΝΕΥΟΝΤΑΙ: κλείνει «αύριο 02:00», όχι «στις 00:00»', () => {
    const shift: WeeklyHours = {
      ...CLOSED,
      1: [{ opens: '18:00', closes: '00:00' }],
      2: [{ opens: '00:00', closes: '02:00' }],
    };
    // Δευτέρα 14/9/2026, 23:00 ώρα Ελλάδας
    expect(openStateAt(shift, new Date('2026-09-14T20:00:00Z'), NO_HOLIDAYS)).toEqual({
      kind: 'open', closes: { weekday: 2, time: '02:00', inDays: 1, inMinutes: 180 },
    });
  });

  it('κλείσιμο ακριβώς στα μεσάνυχτα = 24:00 της ΙΔΙΑΣ ημέρας', () => {
    const evening: WeeklyHours = { ...CLOSED, 1: [{ opens: '18:00', closes: '00:00' }] };
    expect(openStateAt(evening, new Date('2026-09-14T16:00:00Z'), NO_HOLIDAYS)).toEqual({
      kind: 'open', closes: { weekday: 1, time: '24:00', inDays: 0, inMinutes: 300 },
    });
  });

  it('24 ώρες μία ημέρα → κλείνει 24:00· 24/7 → closes = null', () => {
    const mondayTen = new Date('2026-09-14T07:00:00Z');
    const allDayMonday: WeeklyHours = { ...CLOSED, 1: [{ opens: '00:00', closes: '24:00' }] };
    expect(openStateAt(allDayMonday, mondayTen, NO_HOLIDAYS)).toEqual({
      kind: 'open', closes: { weekday: 1, time: '24:00', inDays: 0, inMinutes: 840 },
    });
    expect(openStateAt(WEEKLY_HOURS_PRESETS['always-open'], mondayTen, NO_HOLIDAYS)).toEqual({ kind: 'open', closes: null });
  });

  it('isSoon = μέσα σε μία ώρα (το «Κλείνει σύντομα» της Google)', () => {
    expect(isSoon({ weekday: 1, time: '14:00', inDays: 0, inMinutes: 60 })).toBe(true);
    expect(isSoon({ weekday: 1, time: '14:00', inDays: 0, inMinutes: 61 })).toBe(false);
  });
});

describe('🔴 Α21.21 — αργίες: μόνο ό,τι πραγματικά δεν ξέρουμε', () => {
  it('🔴 λάθος 1: αργία σε μέρα ΗΔΗ κλειστή ⇒ «κλειστό», όχι «ίσως διαφέρει»', () => {
    // Κυριακή του Πάσχα 12/4/2026, 10:00 — το SPLIT είναι κλειστό Κυριακή· η Δευτέρα του Πάσχα θα ήταν ανοιχτή.
    expect(openStateAt(SPLIT, new Date('2026-04-12T07:00:00Z'))).toEqual({
      kind: 'closed',
      next: { weekday: 2, time: '09:00', inDays: 2, inMinutes: 2820 },
      uncertain: { holiday: 'easter-monday', weekday: 1, inDays: 1 },
    });
  });

  it('🔴 λάθος 2: η αργία ΜΠΡΟΣΤΑ λέγεται — δεν «ανοίγει Τρίτη» σιωπηλά', () => {
    const state = openStateAt(SPLIT, new Date('2026-04-11T17:00:00Z'));
    expect(state).toMatchObject({ kind: 'closed', uncertain: { holiday: 'easter-monday', inDays: 2 } });
  });

  it('🔴 λάθος 3: η βάρδια της παραμονής μένει ανοιχτή ΜΕΣΑ στην αργία — μετά, «αργία»', () => {
    const thursdayNight: WeeklyHours = { ...CLOSED, 4: [{ opens: '22:00', closes: '02:00' }], 5: [{ opens: '09:00', closes: '17:00' }] };
    // Παρασκευή 25/12/2026 (Χριστούγεννα): 01:00 και 03:00 ώρα Ελλάδας (UTC+2)
    expect(openStateAt(thursdayNight, new Date('2026-12-24T23:00:00Z'))).toEqual({
      kind: 'open', closes: { weekday: 5, time: '02:00', inDays: 0, inMinutes: 60 },
    });
    expect(openStateAt(thursdayNight, new Date('2026-12-25T01:00:00Z'))).toEqual({ kind: 'holiday', holiday: 'christmas' });
  });
});

describe('🏆 Α21.21 — ειδικές ώρες: η δήλωση νικά αργία και εβδομάδα', () => {
  it('«Κλειστά» σήμερα ⇒ κλειστό, και ανοίγει αύριο με το εβδομαδιαίο', () => {
    const special = [{ date: '2026-09-14', kind: 'closed' as const }];
    expect(openStateAt(SPLIT, new Date('2026-09-14T07:00:00Z'), { ...NO_HOLIDAYS, special })).toEqual({
      kind: 'closed', next: { weekday: 2, time: '09:00', inDays: 1, inMinutes: 1380 }, uncertain: null,
    });
  });

  it('«Κανονικά» σε αργία ⇒ το εβδομαδιαίο ισχύει, χωρίς «ίσως διαφέρει»', () => {
    const special = [{ date: '2026-04-13', kind: 'regular' as const }];
    expect(openStateAt(SPLIT, new Date('2026-04-13T07:00:00Z'), { special })).toEqual({
      kind: 'open', closes: { weekday: 1, time: '14:00', inDays: 0, inMinutes: 240 },
    });
  });

  it('«Άλλο ωράριο» σε αργία ⇒ οι δηλωμένες ώρες', () => {
    const special = [{ date: '2026-04-13', kind: 'custom' as const, intervals: [{ opens: '10:00', closes: '13:00' }] }];
    expect(openStateAt(SPLIT, new Date('2026-04-13T08:00:00Z'), { special })).toEqual({
      kind: 'open', closes: { weekday: 1, time: '13:00', inDays: 0, inMinutes: 120 },
    });
  });

  it('βάρδια της Παρασκευής ΠΡΙΝ από κλειστό Σάββατο: ανήκει στην Παρασκευή, μένει ανοιχτή', () => {
    const friday: WeeklyHours = { ...CLOSED, 5: [{ opens: '22:00', closes: '03:00' }] };
    const special = [{ date: '2026-09-19', kind: 'closed' as const }];
    expect(openStateAt(friday, new Date('2026-09-18T22:00:00Z'), { ...NO_HOLIDAYS, special })).toEqual({
      kind: 'open', closes: { weekday: 6, time: '03:00', inDays: 0, inMinutes: 120 },
    });
  });
});

describe('upcomingDays — οι 7 γραμμές της σελίδας', () => {
  it('ημερομηνίες από σήμερα, με πηγή και αργία ανά μέρα', () => {
    const special = [{ date: '2026-04-14', kind: 'closed' as const }];
    const days = upcomingDays(SPLIT, new Date('2026-04-11T07:00:00Z'), 7, { special });
    expect(days.map(({ dateKey }) => dateKey)).toEqual([
      '2026-04-11', '2026-04-12', '2026-04-13', '2026-04-14', '2026-04-15', '2026-04-16', '2026-04-17',
    ]);
    expect(days[1].plan).toEqual({ kind: 'known', intervals: [], source: 'weekly', holiday: 'easter-sunday' });
    expect(days[2].plan).toEqual({ kind: 'unknown', holiday: 'easter-monday' });
    expect(days[3].plan).toEqual({ kind: 'known', intervals: [], source: 'closed', holiday: null });
  });
});

describe('holidaysNeedingAnswer — ο ΕΝΑΣ κριτής για φόρμα και Φάση Β', () => {
  const FROM = new Date('2026-09-15T07:00:00Z');

  it('γραφείο Δευ–Παρ: μόνο αργίες σε ανοιχτή μέρα, μέσα σε έναν χρόνο', () => {
    expect(holidaysNeedingAnswer(WEEKLY_HOURS_PRESETS.office, FROM).map(({ dateKey }) => dateKey)).toEqual([
      '2026-10-28', '2026-12-25', '2027-01-01', '2027-01-06', '2027-03-15',
      '2027-03-25', '2027-04-30', '2027-05-03', '2027-06-21',
    ]);
  });

  it('🔑 δηλωμένη μέρα ΔΕΝ ξαναρωτιέται', () => {
    const special = [{ date: '2026-12-25', kind: 'closed' as const }];
    expect(holidaysNeedingAnswer(WEEKLY_HOURS_PRESETS.office, FROM, { special }).map(({ dateKey }) => dateKey)).not.toContain('2026-12-25');
  });

  it('🔴 Πρωτομαγιά 2027 (Μ. Σάββατο) σε κατάστημα ανοιχτό Σάββατο ⇒ provisional', () => {
    const labourDay = holidaysNeedingAnswer(WEEKLY_HOURS_PRESETS['retail-split'], FROM).find(({ dateKey }) => dateKey === '2027-05-01');
    expect(labourDay).toEqual({ dateKey: '2027-05-01', holiday: 'labour-day', provisional: true });
  });
});
