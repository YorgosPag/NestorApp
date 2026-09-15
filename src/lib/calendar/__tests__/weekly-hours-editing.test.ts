/**
 * ADR-841 §7 Α21.16.8 — επεξεργασία ωραρίου: λειτουργία ημέρας, πάντα-έγκυρη πρόταση, αντιγραφή, πρότυπα.
 */

import { weeklyHoursDefect, type DailyInterval, type WeeklyHours } from '../weekly-hours';
import {
  ALL_DAY_INTERVAL,
  copyDayTo,
  dayModeOf,
  DEFAULT_INTERVAL,
  intervalsForMode,
  proposeNextInterval,
  WEEKLY_HOURS_PRESET_IDS,
  WEEKLY_HOURS_PRESETS,
} from '../weekly-hours-editing';

const CLOSED: WeeklyHours = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] };
const MORNING_SPLIT: readonly DailyInterval[] = [
  { opens: '09:00', closes: '14:00' },
  { opens: '17:30', closes: '21:00' },
];

describe('dayModeOf + intervalsForMode', () => {
  it('η λειτουργία ΠΡΟΚΥΠΤΕΙ από τα διαστήματα', () => {
    expect(dayModeOf([])).toBe('closed');
    expect(dayModeOf([ALL_DAY_INTERVAL])).toBe('all-day');
    expect(dayModeOf([DEFAULT_INTERVAL])).toBe('open');
    expect(dayModeOf(MORNING_SPLIT)).toBe('open');
  });

  it('🔑 «Κλειστά» κατά λάθος και πίσω: το σπαστό ωράριο ΕΠΙΣΤΡΕΦΕΙ', () => {
    expect(intervalsForMode('closed', MORNING_SPLIT)).toEqual([]);
    expect(intervalsForMode('open', MORNING_SPLIT)).toEqual(MORNING_SPLIT);
  });

  it('«Ανοιχτά» χωρίς μνήμη ή μετά από 24ωρο → προεπιλογή 09:00–17:00', () => {
    expect(intervalsForMode('open', [])).toEqual([DEFAULT_INTERVAL]);
    expect(intervalsForMode('open', [ALL_DAY_INTERVAL])).toEqual([DEFAULT_INTERVAL]);
    expect(intervalsForMode('all-day', MORNING_SPLIT)).toEqual([ALL_DAY_INTERVAL]);
  });
});

describe('proposeNextInterval — πάντα έγκυρη, ή τίποτα', () => {
  it.each([
    ['κενή ημέρα', [], DEFAULT_INTERVAL],
    ['🇬🇷 μετά το 14:00 → το ελληνικό απόγευμα 17:30–21:00', [{ opens: '09:00', closes: '14:00' }], { opens: '17:30', closes: '21:00' }],
    ['μετά το 17:00 → 20:30 έως τα μεσάνυχτα', [{ opens: '09:00', closes: '17:00' }], { opens: '20:30', closes: '00:00' }],
    ['αργά: μικρότερο κενό αν δεν χωρά', [{ opens: '09:00', closes: '22:00' }], { opens: '23:00', closes: '00:00' }],
  ] as const)('%s', (_label, day, expected) => {
    expect(proposeNextInterval(day)).toEqual(expected);
  });

  it.each([
    ['δεν χωρά ούτε μία ώρα', [{ opens: '18:00', closes: '23:30' }]],
    ['η ημέρα περνά ήδη τα μεσάνυχτα', [{ opens: '22:00', closes: '02:00' }]],
    ['ήδη τρία διαστήματα', [{ opens: '06:00', closes: '07:00' }, { opens: '08:00', closes: '09:00' }, { opens: '10:00', closes: '11:00' }]],
  ] as const)('null — %s', (_label, day) => {
    expect(proposeNextInterval(day)).toBeNull();
  });

  it('🔴 ΙΔΙΟΤΗΤΑ: η πρόταση ΠΟΤΕ δεν γεννά ελάττωμα (το λάθος της Α21.16 που έβγαζε κόκκινο με το πάτημα)', () => {
    const days: readonly (readonly DailyInterval[])[] = [
      [], [{ opens: '09:00', closes: '14:00' }], [{ opens: '09:00', closes: '17:00' }],
      [{ opens: '00:00', closes: '12:00' }], [{ opens: '09:00', closes: '22:00' }], MORNING_SPLIT,
    ];
    for (const day of days) {
      const proposal = proposeNextInterval(day);
      if (proposal === null) continue;
      expect(weeklyHoursDefect({ ...CLOSED, 1: [...day, proposal] })).toBeNull();
    }
  });
});

describe('copyDayTo + πρότυπα', () => {
  it('αντιγραφή σε όλες τις καθημερινές — το Σαββατοκύριακο μένει ως είχε', () => {
    const start: WeeklyHours = { ...CLOSED, 1: MORNING_SPLIT, 6: [DEFAULT_INTERVAL] };
    const copied = copyDayTo(start, 1, 'weekdays');
    expect([copied[1], copied[2], copied[3], copied[4], copied[5]]).toEqual(Array(5).fill(MORNING_SPLIT));
    expect(copied[6]).toEqual([DEFAULT_INTERVAL]);
    expect(copied[7]).toEqual([]);
  });

  it('αντιγραφή σε όλες τις ημέρες', () => {
    const copied = copyDayTo({ ...CLOSED, 3: [ALL_DAY_INTERVAL] }, 3, 'every-day');
    expect(Object.values(copied)).toEqual(Array(7).fill([ALL_DAY_INTERVAL]));
  });

  it.each(WEEKLY_HOURS_PRESET_IDS)('το πρότυπο «%s» περνά τον ΕΝΑΝ κριτή', (preset) => {
    expect(weeklyHoursDefect(WEEKLY_HOURS_PRESETS[preset])).toBeNull();
  });

  it('🇬🇷 εμπορικό σπαστό: Τρί/Πέμ/Παρ δύο διαστήματα, Δευ/Τετ/Σάβ πρωί, Κυρ κλειστά', () => {
    const retail = WEEKLY_HOURS_PRESETS['retail-split'];
    expect([retail[2].length, retail[4].length, retail[5].length]).toEqual([2, 2, 2]);
    expect([retail[1].length, retail[3].length, retail[6].length]).toEqual([1, 1, 1]);
    expect(retail[7]).toEqual([]);
  });
});
