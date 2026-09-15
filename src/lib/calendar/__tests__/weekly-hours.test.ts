/**
 * ADR-841 §7 Α21.16 · Α21.16.8 — το εβδομαδιαίο ωράριο: ο ΕΝΑΣ κριτής και το «ανοιχτό τώρα;» σε ώρα Ελλάδας,
 * με σπαστό ωράριο, 24 ώρες και βάρδιες μετά τα μεσάνυχτα (σύμβαση Google Business Profile).
 */

import {
  athensClockAt,
  endsNextDay,
  isSoon,
  normalizeWeeklyHours,
  openStateAt,
  readWeeklyHours,
  weeklyHoursDefect,
  weeklyHoursDefects,
  type WeeklyHours,
} from '../weekly-hours';

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

const noHoliday = () => null;

describe('athensClockAt — η ώρα είναι της Ελλάδας, με θερινή ώρα', () => {
  it('χειμώνας = UTC+2', () => {
    expect(athensClockAt(new Date('2026-01-15T07:30:00Z'))).toEqual({
      dateKey: '2026-01-15', weekday: 4, minutes: 9 * 60 + 30,
    });
  });

  it('καλοκαίρι = UTC+3 — ένα σταθερό +2 θα έλεγε λάθος ώρα', () => {
    expect(athensClockAt(new Date('2026-07-15T07:30:00Z')).minutes).toBe(10 * 60 + 30);
  });

  it('η ημερομηνία αλλάζει στα μεσάνυχτα ΕΛΛΑΔΑΣ, όχι UTC', () => {
    expect(athensClockAt(new Date('2026-09-13T22:30:00Z')).dateKey).toBe('2026-09-14');
  });
});

describe('openStateAt — σπαστό ωράριο', () => {
  it('ανοιχτό μέσα στο πρωινό διάστημα', () => {
    // Δευτέρα 14/9/2026, 10:00 ώρα Ελλάδας (UTC+3)
    expect(openStateAt(SPLIT, new Date('2026-09-14T07:00:00Z'), noHoliday)).toEqual({
      kind: 'open', closes: { weekday: 1, time: '14:00', inDays: 0, inMinutes: 240 },
    });
  });

  it('🔴 ΣΠΑΣΤΟ: στις 15:00 είναι ΚΛΕΙΣΤΟ και ανοίγει 17:30 την ίδια μέρα', () => {
    expect(openStateAt(SPLIT, new Date('2026-09-14T12:00:00Z'), noHoliday)).toEqual({
      kind: 'closed', next: { weekday: 1, time: '17:30', inDays: 0, inMinutes: 150 },
    });
  });

  it('Σάββατο βράδυ → ανοίγει Δευτέρα 09:00 (η Κυριακή παραλείπεται)', () => {
    expect(openStateAt(SPLIT, new Date('2026-09-19T17:00:00Z'), noHoliday)).toEqual({
      kind: 'closed', next: { weekday: 1, time: '09:00', inDays: 2, inMinutes: 2220 },
    });
  });

  it('🔴 ίδια ημέρα της ΕΠΟΜΕΝΗΣ εβδομάδας → inDays = 7, ποτέ «σήμερα»', () => {
    const mondayOnly: WeeklyHours = { ...CLOSED, 1: [{ opens: '09:00', closes: '12:00' }] };
    // Δευτέρα 14/9/2026, 20:00 ώρα Ελλάδας
    expect(openStateAt(mondayOnly, new Date('2026-09-14T17:00:00Z'), noHoliday)).toEqual({
      kind: 'closed', next: { weekday: 1, time: '09:00', inDays: 7, inMinutes: 9420 },
    });
  });

  it('η ώρα κλεισίματος ΔΕΝ είναι ανοιχτή (μισάνοιχτο διάστημα)', () => {
    expect(openStateAt(SPLIT, new Date('2026-09-14T11:00:00Z'), noHoliday).kind).toBe('closed');
  });

  it('🔴 σε αργία λέει «αργία», ΟΧΙ «ανοιχτό» — ούτε «κλειστό»', () => {
    // Δευτέρα του Πάσχα 2026-04-13, 10:00
    expect(openStateAt(SPLIT, new Date('2026-04-13T07:00:00Z'))).toEqual({
      kind: 'holiday', holiday: 'easter-monday',
    });
  });

  it('κλειστά όλη την εβδομάδα → next = null', () => {
    expect(openStateAt(CLOSED, new Date('2026-09-14T07:00:00Z'), noHoliday)).toEqual({
      kind: 'closed', next: null,
    });
  });
});

describe('openStateAt — μετά τα μεσάνυχτα και 24 ώρες (Α21.16.8)', () => {
  it('🔴 Παρασκευή 22:00–03:00: το Σάββατο 01:00 είναι ΑΝΟΙΧΤΟ και κλείνει 03:00', () => {
    const friday: WeeklyHours = { ...CLOSED, 5: [{ opens: '22:00', closes: '03:00' }] };
    // Σάββατο 19/9/2026, 01:00 ώρα Ελλάδας
    expect(openStateAt(friday, new Date('2026-09-18T22:00:00Z'), noHoliday)).toEqual({
      kind: 'open', closes: { weekday: 6, time: '03:00', inDays: 0, inMinutes: 120 },
    });
  });

  it('🔴 κυκλικά: η βάρδια της Κυριακής συνεχίζει μέσα στη Δευτέρα', () => {
    const sunday: WeeklyHours = { ...CLOSED, 7: [{ opens: '22:00', closes: '02:00' }] };
    // Δευτέρα 14/9/2026, 01:00 ώρα Ελλάδας
    expect(openStateAt(sunday, new Date('2026-09-13T22:00:00Z'), noHoliday)).toEqual({
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
    expect(openStateAt(shift, new Date('2026-09-14T20:00:00Z'), noHoliday)).toEqual({
      kind: 'open', closes: { weekday: 2, time: '02:00', inDays: 1, inMinutes: 180 },
    });
  });

  it('κλείσιμο ακριβώς στα μεσάνυχτα = 24:00 της ΙΔΙΑΣ ημέρας', () => {
    const evening: WeeklyHours = { ...CLOSED, 1: [{ opens: '18:00', closes: '00:00' }] };
    expect(openStateAt(evening, new Date('2026-09-14T16:00:00Z'), noHoliday)).toEqual({
      kind: 'open', closes: { weekday: 1, time: '24:00', inDays: 0, inMinutes: 300 },
    });
  });

  it('24 ώρες μία ημέρα → κλείνει 24:00· 24/7 → closes = null', () => {
    const allDayMonday: WeeklyHours = { ...CLOSED, 1: [{ opens: '00:00', closes: '24:00' }] };
    const always: WeeklyHours = {
      1: [{ opens: '00:00', closes: '24:00' }], 2: [{ opens: '00:00', closes: '24:00' }],
      3: [{ opens: '00:00', closes: '24:00' }], 4: [{ opens: '00:00', closes: '24:00' }],
      5: [{ opens: '00:00', closes: '24:00' }], 6: [{ opens: '00:00', closes: '24:00' }],
      7: [{ opens: '00:00', closes: '24:00' }],
    };
    const mondayTen = new Date('2026-09-14T07:00:00Z');
    expect(openStateAt(allDayMonday, mondayTen, noHoliday)).toEqual({
      kind: 'open', closes: { weekday: 1, time: '24:00', inDays: 0, inMinutes: 840 },
    });
    expect(openStateAt(always, mondayTen, noHoliday)).toEqual({ kind: 'open', closes: null });
  });

  it('isSoon = μέσα σε μία ώρα (το «Κλείνει σύντομα» της Google)', () => {
    expect(isSoon({ weekday: 1, time: '14:00', inDays: 0, inMinutes: 60 })).toBe(true);
    expect(isSoon({ weekday: 1, time: '14:00', inDays: 0, inMinutes: 61 })).toBe(false);
  });
});

describe('weeklyHoursDefect(s) — ο ΕΝΑΣ κριτής', () => {
  const withMonday = (monday: WeeklyHours[1]): WeeklyHours => ({ ...SPLIT, 1: monday });

  it('έγκυρο → null', () => {
    expect(weeklyHoursDefect(SPLIT)).toBeNull();
    expect(weeklyHoursDefects(SPLIT)).toEqual([]);
  });

  it.each([
    ['time-malformed', [{ opens: '9:00', closes: '14:00' }]],
    ['time-malformed', [{ opens: '24:00', closes: '23:00' }]],
    ['time-malformed', [{ opens: '10:00', closes: '24:30' }]],
    ['interval-empty', [{ opens: '14:00', closes: '14:00' }]],
    ['intervals-overlap', [{ opens: '12:00', closes: '18:00' }, { opens: '09:00', closes: '13:00' }]],
    ['intervals-overlap', [{ opens: '06:00', closes: '20:00' }, { opens: '08:00', closes: '09:00' }, { opens: '10:00', closes: '11:00' }]],
    ['intervals-overlap', [{ opens: '00:00', closes: '24:00' }, { opens: '10:00', closes: '11:00' }]],
    [
      'too-many-intervals',
      [
        { opens: '06:00', closes: '07:00' }, { opens: '08:00', closes: '09:00' },
        { opens: '10:00', closes: '11:00' }, { opens: '12:00', closes: '13:00' },
      ],
    ],
  ] as const)('%s', (defect, monday) => {
    expect(weeklyHoursDefect(withMonday(monday))).toBe(defect);
  });

  it('εφαπτόμενα διαστήματα ΔΕΝ είναι επικάλυψη', () => {
    expect(weeklyHoursDefect(withMonday([
      { opens: '09:00', closes: '13:00' }, { opens: '13:00', closes: '17:00' },
    ]))).toBeNull();
  });

  it('✅ Α21.16.8 — μετά τα μεσάνυχτα και 24 ώρες είναι ΕΓΚΥΡΑ', () => {
    expect(weeklyHoursDefect(withMonday([{ opens: '22:00', closes: '02:00' }]))).toBeNull();
    expect(weeklyHoursDefect(withMonday([{ opens: '18:00', closes: '00:00' }]))).toBeNull();
    expect(weeklyHoursDefect(withMonday([{ opens: '00:00', closes: '24:00' }]))).toBeNull();
  });

  it('🔴 βάρδια που πέφτει πάνω στο πρωινό της ΕΠΟΜΕΝΗΣ ημέρας → ελάττωμα ΣΤΗΝ επόμενη', () => {
    expect(weeklyHoursDefects(withMonday([{ opens: '22:00', closes: '10:00' }]))).toEqual([
      { weekday: 2, defect: 'overlaps-previous-day' },
    ]);
  });

  it('🔴 κυκλικά: η Κυριακή που περνά τα μεσάνυχτα πέφτει πάνω στη Δευτέρα', () => {
    expect(weeklyHoursDefects({ ...SPLIT, 7: [{ opens: '22:00', closes: '09:30' }] })).toEqual([
      { weekday: 1, defect: 'overlaps-previous-day' },
    ]);
  });

  it('ελαττώματα ΑΝΑ ημέρα — η φόρμα δείχνει κάθε ένα δίπλα στη γραμμή του', () => {
    const broken: WeeklyHours = {
      ...SPLIT,
      1: [{ opens: '10:00', closes: '10:00' }],
      3: [{ opens: '9:00', closes: '14:00' }],
    };
    expect(weeklyHoursDefects(broken)).toEqual([
      { weekday: 1, defect: 'interval-empty' },
      { weekday: 3, defect: 'time-malformed' },
    ]);
  });

  it('endsNextDay: μόνο όταν κλείνει ΜΕΤΑ τα μεσάνυχτα', () => {
    expect(endsNextDay({ opens: '22:00', closes: '02:00' })).toBe(true);
    expect(endsNextDay({ opens: '18:00', closes: '00:00' })).toBe(false);
    expect(endsNextDay({ opens: '09:00', closes: '17:00' })).toBe(false);
  });
});

describe('normalizeWeeklyHours + readWeeklyHours', () => {
  it('ταξινομεί τα διαστήματα κάθε ημέρας', () => {
    const shuffled: WeeklyHours = { ...SPLIT, 1: [...SPLIT[1]].reverse() };
    expect(normalizeWeeklyHours(shuffled)[1]).toEqual(SPLIT[1]);
  });

  it('round-trip μέσω «δίσκου» (κλειδιά-συμβολοσειρές) — και με βάρδια μετά τα μεσάνυχτα', () => {
    const night: WeeklyHours = { ...SPLIT, 6: [{ opens: '22:00', closes: '03:00' }] };
    expect(readWeeklyHours(JSON.parse(JSON.stringify(SPLIT)) as unknown)).toEqual(SPLIT);
    expect(readWeeklyHours(JSON.parse(JSON.stringify(night)) as unknown)).toEqual(night);
  });

  it('🔴 ή όλο ή τίποτα: ημέρα που λείπει ή άκυρο ωράριο → null, ποτέ «κλειστά»', () => {
    const { 7: _sunday, ...missingSunday } = SPLIT;
    expect(readWeeklyHours(missingSunday)).toBeNull();
    expect(readWeeklyHours({ ...SPLIT, 2: [{ opens: '18:00', closes: '18:00' }] })).toBeNull();
    expect(readWeeklyHours('09-17')).toBeNull();
  });
});
