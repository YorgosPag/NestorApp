/**
 * @fileoverview **ΕΙΔΙΚΕΣ ΩΡΕΣ — ΤΟ ΩΡΑΡΙΟ ΜΙΑΣ ΣΥΓΚΕΚΡΙΜΕΝΗΣ ΗΜΕΡΟΜΗΝΙΑΣ** (ADR-841 §7 Α21.21).
 * @related lib/calendar/hours-timeline.ts (ο καταναλωτής) · lib/calendar/weekly-hours.ts (ο ΕΝΑΣ κριτής διαστημάτων) ·
 *   types/showcase-card.ts
 * @module lib/calendar/special-hours
 *
 * 🏆 **Google Business Profile API `SpecialHourPeriod`**: ανά **ημερομηνία**, «κλειστά» ή ώρες, με κλείσιμο έως
 * την επόμενη μέρα. **Τι προσθέτουμε**: το **«Κανονικά»** — η δήλωση που σβήνει το «το ωράριο ίσως διαφέρει»
 * μιας αργίας χωρίς να ξαναγράψει ο άνθρωπος τις ώρες του, και που **ακολουθεί** το εβδομαδιαίο αν εκείνο αλλάξει.
 *
 * 🔑 **Κλειδί είναι η ημερομηνία**, όχι η θέση στον πίνακα: δύο εγγραφές για την ίδια μέρα = ελάττωμα.
 *
 * 🔑 **Η περασμένη μέρα ΔΕΝ είναι λάθος του ανθρώπου** — ο χρόνος πέρασε. Ο κριτής την αγνοεί και η κανονικοποίηση
 * την κλαδεύει· αλλιώς μια κάρτα με «25/12 κλειστά» θα απέτυχε να αποθηκευτεί στις 26/12.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις.
 */

import { addDaysToDateKey, daysBetweenDateKeys, isDateKey } from '@/lib/calendar/date-key';
import {
  dayIntervalsDefect,
  normalizeDayIntervals,
  readDayIntervals,
  type DailyInterval,
  type WeeklyHoursDefect,
} from '@/lib/calendar/weekly-hours';

export const SPECIAL_DAY_KINDS = ['closed', 'regular', 'custom'] as const;

export type SpecialDayKind = (typeof SPECIAL_DAY_KINDS)[number];

export type SpecialDay =
  | { readonly date: string; readonly kind: 'closed' }
  /** «Κανονικά» — το εβδομαδιαίο ωράριο εκείνης της ημέρας, **δηλωμένο** ως ισχύον. */
  | { readonly date: string; readonly kind: 'regular' }
  | { readonly date: string; readonly kind: 'custom'; readonly intervals: readonly DailyInterval[] };

/**
 * 🔴 **Ταβάνι** — ίδιο δόγμα με το `MAX_SHOWCASE_LOCATIONS`: ο κατάλογος κατεβάζει κάθε βιτρίνα σε κάθε ανώνυμο.
 * 30 = οι 13 εθνικές αργίες ενός χρόνου + τοπικές + άδειες, με περιθώριο.
 */
export const MAX_SPECIAL_DAYS_PER_LOCATION = 30;

/** Έως έναν χρόνο μπροστά — οι αργίες της **επόμενης** χρονιάς, όχι ημερολόγιο δεκαετίας. */
export const SPECIAL_DAYS_HORIZON_DAYS = 366;

const SPECIAL_DAY_DEFECTS = [
  'date-invalid',
  'date-beyond-horizon',
  'date-duplicate',
  'hours-missing',
  'too-many-days',
] as const;

export type SpecialDayDefect = (typeof SPECIAL_DAY_DEFECTS)[number] | WeeklyHoursDefect;

/** Τι φταίει σε **ποια** γραμμή — η φόρμα το λέει δίπλα της. */
export interface SpecialDayIssue {
  readonly index: number;
  readonly defect: SpecialDayDefect;
}

function isPast(day: SpecialDay, todayKey: string): boolean {
  return isDateKey(day.date) && day.date < todayKey;
}

function ownDefect(day: SpecialDay, todayKey: string): SpecialDayDefect | null {
  const ahead = isDateKey(day.date) ? daysBetweenDateKeys(todayKey, day.date) : null;
  if (ahead === null) return 'date-invalid';
  if (ahead > SPECIAL_DAYS_HORIZON_DAYS) return 'date-beyond-horizon';
  if (day.kind !== 'custom') return null;
  return day.intervals.length === 0 ? 'hours-missing' : dayIntervalsDefect(day.intervals);
}

/**
 * **Ο ΕΝΑΣ κριτής** — η φόρμα (ανάδραση ανά γραμμή) και ο διακομιστής (εγγύηση).
 *
 * @param todayKey Η σημερινή ημέρα **στην Ελλάδα** (`athensClockAt`) — εγχέεται, ώστε ο κριτής να μένει καθαρός.
 */
export function specialDaysDefects(days: readonly SpecialDay[], todayKey: string): readonly SpecialDayIssue[] {
  const seen = new Set<string>();
  const issues: SpecialDayIssue[] = [];
  let upcoming = 0;
  days.forEach((day, index) => {
    if (isPast(day, todayKey)) return;
    upcoming += 1;
    const defect = upcoming > MAX_SPECIAL_DAYS_PER_LOCATION
      ? 'too-many-days'
      : ownDefect(day, todayKey) ?? (seen.has(day.date) ? 'date-duplicate' : null);
    seen.add(day.date);
    if (defect !== null) issues.push({ index, defect });
  });
  return issues;
}

/** Το **πρώτο** ελάττωμα — ό,τι χρειάζεται ο διακομιστής για να αρνηθεί. */
export function specialDaysDefect(days: readonly SpecialDay[], todayKey: string): SpecialDayDefect | null {
  return specialDaysDefects(days, todayKey)[0]?.defect ?? null;
}

/**
 * **Η πρόταση του «Προσθήκη ημερομηνίας»** — πάντα έγκυρη: η πρώτη **ελεύθερη** μέρα από αύριο, «Κλειστά».
 * `null` όταν γέμισε το ταβάνι — τότε το κουμπί δεν προσφέρεται (ίδιο δόγμα με το `proposeNextInterval`, Α21.16.8:
 * ποτέ κόκκινο μήνυμα από το ίδιο το κουμπί).
 */
export function proposeSpecialDay(days: readonly SpecialDay[], todayKey: string): SpecialDay | null {
  if (days.filter((day) => !isPast(day, todayKey)).length >= MAX_SPECIAL_DAYS_PER_LOCATION) return null;
  for (let ahead = 1; ahead <= SPECIAL_DAYS_HORIZON_DAYS; ahead += 1) {
    const date = addDaysToDateKey(todayKey, ahead);
    if (date !== null && !days.some((day) => day.date === date)) return { date, kind: 'closed' };
  }
  return null;
}

function canonical(day: SpecialDay): SpecialDay {
  return day.kind === 'custom'
    ? { date: day.date, kind: 'custom', intervals: normalizeDayIntervals(day.intervals) }
    : { date: day.date, kind: day.kind };
}

/** Η μορφή που αποθηκεύεται: **χωρίς** περασμένες, ταξινομημένες κατά ημερομηνία, χωρίς ξένα πεδία. */
export function normalizeSpecialDays(days: readonly SpecialDay[], todayKey: string): readonly SpecialDay[] {
  return days
    .filter((day) => !isPast(day, todayKey))
    .map(canonical)
    .sort((left, right) => (left.date < right.date ? -1 : left.date > right.date ? 1 : 0));
}

function readSpecialDay(raw: unknown): SpecialDay | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { date, kind, intervals } = raw as Record<string, unknown>;
  if (!isDateKey(date)) return null;
  if (kind === 'closed' || kind === 'regular') return { date, kind };
  if (kind !== 'custom') return null;
  const read = readDayIntervals(intervals);
  return read === null || read.length === 0 || dayIntervalsDefect(read) !== null ? null : { date, kind, intervals: read };
}

/**
 * **Ανεκτικός αναγνώστης** — απόν πεδίο (κάθε παλιό έγγραφο) ή σκουπίδι ⇒ `[]`, **ποτέ** σφάλμα.
 *
 * ⚠️ **Ή όλες ή καμία** (ίδιο δόγμα με το `readWeeklyHours`): μια μισοδιαβασμένη λίστα θα έδειχνε το εβδομαδιαίο
 * ωράριο ακριβώς τη μέρα που ο άνθρωπος δήλωσε «κλειστά» — ψευδής ισχυρισμός που **μοιάζει** σωστός.
 * Οι περασμένες **δεν** κρίνονται εδώ (εξαρτώνται από το ρολόι)· τις αγνοεί η γραμμή χρόνου.
 */
export function readSpecialDays(raw: unknown): readonly SpecialDay[] {
  if (!Array.isArray(raw) || raw.length > MAX_SPECIAL_DAYS_PER_LOCATION) return [];
  const days: SpecialDay[] = [];
  for (const entry of raw) {
    const day = readSpecialDay(entry);
    if (day === null || days.some((kept) => kept.date === day.date)) return [];
    days.push(day);
  }
  return days;
}
