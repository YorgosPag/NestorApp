/**
 * ADR-841 §7 Α21.16 — το εβδομαδιαίο ωράριο: ο ΕΝΑΣ κριτής και το «ανοιχτό τώρα;» σε ώρα Ελλάδας.
 */

import {
  athensClockAt,
  normalizeWeeklyHours,
  openStateAt,
  readWeeklyHours,
  weeklyHoursDefect,
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

describe('openStateAt', () => {
  it('ανοιχτό μέσα στο πρωινό διάστημα', () => {
    // Δευτέρα 14/9/2026, 10:00 ώρα Ελλάδας (UTC+3)
    expect(openStateAt(SPLIT, new Date('2026-09-14T07:00:00Z'), noHoliday)).toEqual({
      kind: 'open', closes: '14:00',
    });
  });

  it('🔴 ΣΠΑΣΤΟ: στις 15:00 είναι ΚΛΕΙΣΤΟ και ανοίγει 17:30 την ίδια μέρα', () => {
    expect(openStateAt(SPLIT, new Date('2026-09-14T12:00:00Z'), noHoliday)).toEqual({
      kind: 'closed', next: { weekday: 1, opens: '17:30', inDays: 0 },
    });
  });

  it('Σάββατο βράδυ → ανοίγει Δευτέρα 09:00 (η Κυριακή παραλείπεται)', () => {
    expect(openStateAt(SPLIT, new Date('2026-09-19T17:00:00Z'), noHoliday)).toEqual({
      kind: 'closed', next: { weekday: 1, opens: '09:00', inDays: 2 },
    });
  });

  it('🔴 ίδια ημέρα της ΕΠΟΜΕΝΗΣ εβδομάδας → inDays = 7, ποτέ «σήμερα»', () => {
    const mondayOnly: WeeklyHours = { 1: [{ opens: '09:00', closes: '12:00' }], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] };
    // Δευτέρα 14/9/2026, 20:00 ώρα Ελλάδας
    expect(openStateAt(mondayOnly, new Date('2026-09-14T17:00:00Z'), noHoliday)).toEqual({
      kind: 'closed', next: { weekday: 1, opens: '09:00', inDays: 7 },
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
    const closed: WeeklyHours = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] };
    expect(openStateAt(closed, new Date('2026-09-14T07:00:00Z'), noHoliday)).toEqual({
      kind: 'closed', next: null,
    });
  });
});

describe('weeklyHoursDefect — ο ΕΝΑΣ κριτής', () => {
  const withMonday = (monday: WeeklyHours[1]): WeeklyHours => ({ ...SPLIT, 1: monday });

  it('έγκυρο → null', () => {
    expect(weeklyHoursDefect(SPLIT)).toBeNull();
  });

  it.each([
    ['time-malformed', [{ opens: '9:00', closes: '14:00' }]],
    ['time-malformed', [{ opens: '24:00', closes: '23:00' }]],
    ['interval-empty', [{ opens: '14:00', closes: '14:00' }]],
    ['interval-empty', [{ opens: '22:00', closes: '02:00' }]],
    ['intervals-overlap', [{ opens: '12:00', closes: '18:00' }, { opens: '09:00', closes: '13:00' }]],
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
});

describe('normalizeWeeklyHours + readWeeklyHours', () => {
  it('ταξινομεί τα διαστήματα κάθε ημέρας', () => {
    const shuffled: WeeklyHours = { ...SPLIT, 1: [...SPLIT[1]].reverse() };
    expect(normalizeWeeklyHours(shuffled)[1]).toEqual(SPLIT[1]);
  });

  it('round-trip μέσω «δίσκου» (κλειδιά-συμβολοσειρές)', () => {
    const stored = JSON.parse(JSON.stringify(SPLIT)) as unknown;
    expect(readWeeklyHours(stored)).toEqual(SPLIT);
  });

  it('🔴 ή όλο ή τίποτα: ημέρα που λείπει ή άκυρο ωράριο → null, ποτέ «κλειστά»', () => {
    const { 7: _sunday, ...missingSunday } = SPLIT;
    expect(readWeeklyHours(missingSunday)).toBeNull();
    expect(readWeeklyHours({ ...SPLIT, 2: [{ opens: '18:00', closes: '09:00' }] })).toBeNull();
    expect(readWeeklyHours('09-17')).toBeNull();
  });
});
