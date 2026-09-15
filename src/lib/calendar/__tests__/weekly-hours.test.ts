/**
 * ADR-841 §7 Α21.16 · Α21.16.8 — το εβδομαδιαίο ωράριο: ο ΕΝΑΣ κριτής και η ώρα Ελλάδας, με σπαστό ωράριο,
 * 24 ώρες και βάρδιες μετά τα μεσάνυχτα (σύμβαση Google Business Profile).
 * Το «ανοιχτό τώρα;» ζει στο `hours-timeline.test.ts` (Α21.21).
 */

import {
  athensClockAt,
  dayIntervalsDefect,
  endsNextDay,
  normalizeWeeklyHours,
  readDayIntervals,
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

describe('dayIntervalsDefect — ΜΙΑ ημέρα, ο ΙΔΙΟΣ κριτής (Α21.21)', () => {
  it('ίδιες κρίσεις με την εβδομάδα: επικάλυψη, κενό, μετά τα μεσάνυχτα έγκυρο', () => {
    expect(dayIntervalsDefect([{ opens: '12:00', closes: '18:00' }, { opens: '09:00', closes: '13:00' }])).toBe('intervals-overlap');
    expect(dayIntervalsDefect([{ opens: '10:00', closes: '10:00' }])).toBe('interval-empty');
    expect(dayIntervalsDefect([{ opens: '22:00', closes: '02:00' }])).toBeNull();
    expect(dayIntervalsDefect([])).toBeNull();
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

  it('readDayIntervals: σχήμα μόνο — ξένα πεδία φεύγουν, λάθος τύπος → null', () => {
    expect(readDayIntervals([{ opens: '09:00', closes: '14:00', extra: 1 }])).toEqual([{ opens: '09:00', closes: '14:00' }]);
    expect(readDayIntervals([{ opens: 9, closes: '14:00' }])).toBeNull();
    expect(readDayIntervals('09:00')).toBeNull();
  });
});
