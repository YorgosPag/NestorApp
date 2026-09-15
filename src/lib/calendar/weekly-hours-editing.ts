/**
 * @fileoverview **ΕΠΕΞΕΡΓΑΣΙΑ ΩΡΑΡΙΟΥ, ΧΩΡΙΣ REACT** — λειτουργία ημέρας, πρόταση διαστήματος, αντιγραφή, πρότυπα (ADR-841 §7 Α21.16.8).
 * @related lib/calendar/weekly-hours.ts (ο ΕΝΑΣ κριτής) · components/mandate/WeeklyHoursField.tsx
 * @module lib/calendar/weekly-hours-editing
 *
 * 🏆 **Τι κάνει η Google στο Business Profile** — ανά ημέρα «Κλειστά / Ανοιχτά / 24 ώρες» και «+» για
 * δεύτερο διάστημα. **Τι προσθέτουμε**:
 *   • η πρόταση νέου διαστήματος είναι **πάντα έγκυρη** — ποτέ κόκκινο μήνυμα από το ίδιο το κουμπί·
 *     και ξέρει το ελληνικό μεσημεριανό κενό (14:00 → 17:30–21:00)·
 *   • **αντιγραφή** ημέρας σε όλες τις καθημερινές / όλες τις ημέρες·
 *   • **πρότυπα** με το ελληνικό **εμπορικό σπαστό** ωράριο, όχι μόνο «Δευ–Παρ 9–5».
 *
 * **Layering**: leaf — καθαρές συναρτήσεις.
 */

import {
  END_OF_DAY,
  intervalDuration,
  isAllDay,
  ISO_WEEKDAYS,
  MAX_INTERVALS_PER_DAY,
  MINUTES_PER_DAY,
  minutesOf,
  formatMinutes,
  START_OF_DAY,
  type DailyInterval,
  type IsoWeekday,
  type WeeklyHours,
} from '@/lib/calendar/weekly-hours';

// =============================================================================
// ΛΕΙΤΟΥΡΓΙΑ ΗΜΕΡΑΣ
// =============================================================================

export const DAY_MODES = ['open', 'all-day', 'closed'] as const;

export type DayMode = (typeof DAY_MODES)[number];

export const ALL_DAY_INTERVAL: DailyInterval = { opens: START_OF_DAY, closes: END_OF_DAY };

export const DEFAULT_INTERVAL: DailyInterval = { opens: '09:00', closes: '17:00' };

/** Η λειτουργία **προκύπτει** από τα διαστήματα — δεν αποθηκεύεται δεύτερη αλήθεια. */
export function dayModeOf(intervals: readonly DailyInterval[]): DayMode {
  if (intervals.length === 0) return 'closed';
  return intervals.length === 1 && isAllDay(intervals[0]) ? 'all-day' : 'open';
}

/**
 * Αλλαγή λειτουργίας. `remembered` = ό,τι είχε η ημέρα **πριν** κλείσει — ο άνθρωπος που πάτησε
 * «Κλειστά» κατά λάθος δεν ξαναγράφει το σπαστό του ωράριο.
 */
export function intervalsForMode(mode: DayMode, remembered: readonly DailyInterval[]): readonly DailyInterval[] {
  if (mode === 'closed') return [];
  if (mode === 'all-day') return [ALL_DAY_INTERVAL];
  return dayModeOf(remembered) === 'open' ? remembered : [DEFAULT_INTERVAL];
}

// =============================================================================
// ΠΡΟΤΑΣΗ ΕΠΟΜΕΝΟΥ ΔΙΑΣΤΗΜΑΤΟΣ
// =============================================================================

/** 3,5 ώρες = το ελληνικό μεσημεριανό κενό (14:00 → 17:30)· μετά μικρότερα, αν δεν χωρά. */
const BREAK_CANDIDATES = [210, 60, 0] as const;
const PROPOSED_LENGTH = 210;
const MIN_PROPOSED_LENGTH = 60;

/** Πού τελειώνει η ημέρα **ως τώρα** (λεπτά από τα μεσάνυχτα της· >1440 αν περνά τα μεσάνυχτα). */
function latestEnd(day: readonly DailyInterval[]): number | null {
  let end: number | null = null;
  for (const interval of day) {
    const from = minutesOf(interval.opens);
    const duration = intervalDuration(interval);
    if (from === null || duration === null) return null;
    end = Math.max(end ?? 0, from + duration);
  }
  return end;
}

/**
 * **Πάντα έγκυρη πρόταση, ή `null` όταν δεν χωρά** — τότε το κουμπί δεν προσφέρεται.
 * Κλείσιμο στα μεσάνυχτα γράφεται `00:00` (το `<input type="time">` δεν δέχεται `24:00`).
 */
export function proposeNextInterval(day: readonly DailyInterval[]): DailyInterval | null {
  if (day.length === 0) return DEFAULT_INTERVAL;
  if (day.length >= MAX_INTERVALS_PER_DAY) return null;
  const end = latestEnd(day);
  if (end === null) return null;
  for (const gap of BREAK_CANDIDATES) {
    const opens = end + gap;
    if (opens + MIN_PROPOSED_LENGTH > MINUTES_PER_DAY) continue;
    const closes = Math.min(opens + PROPOSED_LENGTH, MINUTES_PER_DAY);
    return { opens: formatMinutes(opens), closes: closes === MINUTES_PER_DAY ? START_OF_DAY : formatMinutes(closes) };
  }
  return null;
}

// =============================================================================
// ΑΝΤΙΓΡΑΦΗ ΚΑΙ ΠΡΟΤΥΠΑ
// =============================================================================

export const WEEKDAY_GROUPS = {
  weekdays: [1, 2, 3, 4, 5],
  'every-day': ISO_WEEKDAYS,
} as const satisfies Record<string, readonly IsoWeekday[]>;

export type WeekdayGroup = keyof typeof WEEKDAY_GROUPS;

export const WEEKDAY_GROUP_IDS = Object.keys(WEEKDAY_GROUPS) as WeekdayGroup[];

function weekOf(dayHours: (weekday: IsoWeekday) => readonly DailyInterval[]): WeeklyHours {
  return {
    1: dayHours(1), 2: dayHours(2), 3: dayHours(3), 4: dayHours(4),
    5: dayHours(5), 6: dayHours(6), 7: dayHours(7),
  };
}

/** Τα διαστήματα της `from` σε κάθε ημέρα της ομάδας — οι υπόλοιπες μένουν ως είχαν. */
export function copyDayTo(hours: WeeklyHours, from: IsoWeekday, group: WeekdayGroup): WeeklyHours {
  const targets: readonly IsoWeekday[] = WEEKDAY_GROUPS[group];
  return weekOf((weekday) => (targets.includes(weekday) ? hours[from].map((interval) => ({ ...interval })) : hours[weekday]));
}

const MORNING: DailyInterval = { opens: '09:00', closes: '15:00' };
const SPLIT_DAY: readonly DailyInterval[] = [
  { opens: '09:00', closes: '14:30' },
  { opens: '17:30', closes: '21:00' },
];

/**
 * **Πρότυπα** — πρόταση, όχι δήλωση: γεμίζουν το πρόχειρο, ο άνθρωπος αποθηκεύει.
 * `retail-split` = το ελληνικό εμπορικό ωράριο: Δευ/Τετ/Σάβ πρωί · Τρί/Πέμ/Παρ σπαστό.
 */
export const WEEKLY_HOURS_PRESETS = {
  office: weekOf((weekday) => (weekday <= 5 ? [DEFAULT_INTERVAL] : [])),
  'retail-split': weekOf((weekday) => {
    if (weekday === 7) return [];
    return weekday === 2 || weekday === 4 || weekday === 5 ? SPLIT_DAY : [MORNING];
  }),
  'always-open': weekOf(() => [ALL_DAY_INTERVAL]),
} as const satisfies Record<string, WeeklyHours>;

export type WeeklyHoursPreset = keyof typeof WEEKLY_HOURS_PRESETS;

export const WEEKLY_HOURS_PRESET_IDS = Object.keys(WEEKLY_HOURS_PRESETS) as WeeklyHoursPreset[];
