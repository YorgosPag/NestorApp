/**
 * @fileoverview **ΠΟΙΑ ΕΡΩΤΗΣΗ, ΣΕ ΠΟΙΑ ΠΕΡΙΟΔΟ, ΠΟΤΕ** — ο καθαρός πυρήνας της ερώτησης αργιών (ADR-841 §7 Α21.21 Φάση Β).
 * @related lib/calendar/hours-timeline.ts (`holidaysNeedingAnswer` — ο ΕΝΑΣ κριτής) · config/holiday-question-policy.ts ·
 *   lib/agency/showcase-holiday-answers.ts (η απάντηση γράφεται στην κάρτα)
 * @module lib/calendar/holiday-question
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΠΕΡΙΟΔΟΣ ΥΠΟΛΟΓΙΖΕΤΑΙ ΑΠΟ ΤΟ ΗΜΕΡΟΛΟΓΙΟ — ΟΧΙ ΑΠΟ ΤΙΣ ΑΠΑΝΤΗΣΕΙΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ένα email **ανά εορταστική περίοδο**, όχι ανά αργία. Η περίοδος = αργίες σε απόσταση ≤ `seasonGapDays`, και
 * ομαδοποιούνται **όλες** οι εθνικές αργίες — όχι μόνο οι αναπάντητες. Αλλιώς μια απάντηση στη φόρμα για τις 25/12
 * θα άλλαζε το «κλειδί» της περιόδου και θα γεννούσε **δεύτερη** ερώτηση για την ίδια περίοδο. Καμία λίστα περιόδων
 * δεν γράφεται με το χέρι: τα Χριστούγεννα→Θεοφάνεια και η Μ. Παρασκευή→Δευτέρα του Πάσχα **προκύπτουν**.
 *
 * 🔴 **Ποτέ ερώτηση για ημερομηνία που ίσως μετατεθεί** (`provisional`) και ποτέ για **σήμερα** (αργά για να βοηθήσει).
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, χωρίς I/O.
 */

import { HOLIDAY_QUESTION_POLICY } from '@/config/holiday-question-policy';
import { addDaysToDateKey, daysBetweenDateKeys } from '@/lib/calendar/date-key';
import { greekPublicHolidayOn, type GreekPublicHolidayId } from '@/lib/calendar/greek-public-holidays';
import { holidaysNeedingAnswer, type TimelineOptions } from '@/lib/calendar/hours-timeline';
import { SPECIAL_DAYS_HORIZON_DAYS, type SpecialDay } from '@/lib/calendar/special-hours';
import { athensClockAt, type WeeklyHours } from '@/lib/calendar/weekly-hours';

/** Η 1η Φεβρουαρίου δεν ανήκει ποτέ σε περίοδο (βλ. `config/holiday-question-policy`) — η σταθερή αρχή της σάρωσης. */
const SEASON_ANCHOR_MONTH_DAY = '02-01';

/** Οι απαντήσεις που δίνονται **χωρίς** φόρμα — το «Άλλο ωράριο» θέλει ώρες, άρα φόρμα. */
export const HOLIDAY_ANSWER_KINDS = ['closed', 'regular'] as const;

export type HolidayAnswerKind = (typeof HOLIDAY_ANSWER_KINDS)[number];

/** Μία εορταστική περίοδος. Το `key` (πρώτη ημερομηνία) είναι **σταθερό** όσο κι αν απαντηθούν οι μέρες της. */
export interface HolidaySeason {
  readonly key: string;
  readonly lastDate: string;
}

/** Μία μέρα που ρωτάμε, για ένα κατάστημα. */
export interface HolidayQuestionItem {
  readonly locationId: string;
  readonly date: string;
  readonly holiday: GreekPublicHolidayId;
}

/** Μία απάντηση που ήδη δόθηκε — η «μνήμη πέρσι» ζει στις λυμένες ερωτήσεις, όχι σε νέα αποθήκη. */
export interface SettledHolidayAnswer extends HolidayQuestionItem {
  readonly kind: HolidayAnswerKind;
}

/** Ό,τι χρειάζεται από ένα κατάστημα — η κάρτα το ικανοποιεί δομικά. */
export interface HoursOfLocation {
  readonly id: string;
  readonly hours: WeeklyHours | null;
  readonly specialHours: readonly SpecialDay[];
}

export type HolidayQuestionStage = 'ask' | 'reminder';

/** Μια περίοδος που **ωρίμασε** για ερώτηση, με τις μέρες που ακόμη δεν απαντήθηκαν. */
export interface DueHolidaySeason {
  readonly season: HolidaySeason;
  readonly items: readonly HolidayQuestionItem[];
  /** Ημέρες ως την **πρώτη αναπάντητη** μέρα. */
  readonly leadDays: number;
  readonly stage: HolidayQuestionStage;
}

type HolidayOn = NonNullable<TimelineOptions['holidayOn']>;

function scanStart(todayKey: string): string {
  const year = Number(todayKey.slice(0, 4));
  const anchor = `${year}-${SEASON_ANCHOR_MONTH_DAY}`;
  return todayKey >= anchor ? anchor : `${year - 1}-${SEASON_ANCHOR_MONTH_DAY}`;
}

function holidayDatesBetween(from: string, to: string, holidayOn: HolidayOn): string[] {
  const dates: string[] = [];
  for (let date: string | null = from; date !== null && date <= to; date = addDaysToDateKey(date, 1)) {
    if (holidayOn(date) !== null) dates.push(date);
  }
  return dates;
}

/**
 * **Οι εορταστικές περίοδοι που δεν τελείωσαν**, μέσα στον ορίζοντα των ειδικών ωρών.
 *
 * ⚠️ Η σάρωση αρχίζει από σταθερή άγκυρα (1/2), όχι από το σήμερα: μια περίοδος σε εξέλιξη κρατά το **ίδιο** κλειδί
 * και στις 26/12 και στις 2/1.
 */
export function holidaySeasons(todayKey: string, holidayOn: HolidayOn = greekPublicHolidayOn): readonly HolidaySeason[] {
  const until = addDaysToDateKey(todayKey, SPECIAL_DAYS_HORIZON_DAYS);
  if (until === null) return [];
  const seasons: { key: string; lastDate: string }[] = [];
  for (const date of holidayDatesBetween(scanStart(todayKey), until, holidayOn)) {
    const current = seasons[seasons.length - 1];
    const gap = current === undefined ? null : daysBetweenDateKeys(current.lastDate, date);
    if (current !== undefined && gap !== null && gap <= HOLIDAY_QUESTION_POLICY.seasonGapDays) current.lastDate = date;
    else seasons.push({ key: date, lastDate: date });
  }
  return seasons.filter(({ lastDate }) => lastDate >= todayKey);
}

/**
 * **Οι μέρες που ρωτάμε για ένα κατάστημα** — ό,τι λέει ο `holidaysNeedingAnswer`, χωρίς `provisional` και χωρίς σήμερα.
 */
export function pendingHolidayItems(
  location: HoursOfLocation,
  instant: Date,
  options: Pick<TimelineOptions, 'holidayOn'> = {},
): readonly HolidayQuestionItem[] {
  if (location.hours === null) return [];
  const todayKey = athensClockAt(instant).dateKey;
  return holidaysNeedingAnswer(location.hours, instant, { ...options, special: location.specialHours })
    .filter(({ dateKey, provisional }) => !provisional && dateKey > todayKey)
    .map(({ dateKey, holiday }) => ({ locationId: location.id, date: dateKey, holiday }));
}

function dueSeason(season: HolidaySeason, items: readonly HolidayQuestionItem[], todayKey: string): DueHolidaySeason | null {
  const inSeason = items.filter(({ date }) => season.key <= date && date <= season.lastDate);
  const first = inSeason.reduce<string | null>((earliest, { date }) => (earliest === null || date < earliest ? date : earliest), null);
  const leadDays = first === null ? null : daysBetweenDateKeys(todayKey, first);
  if (leadDays === null || leadDays > HOLIDAY_QUESTION_POLICY.askLeadDays) return null;
  const stage: HolidayQuestionStage = leadDays <= HOLIDAY_QUESTION_POLICY.reminderLeadDays ? 'reminder' : 'ask';
  return { season, items: inSeason, leadDays, stage };
}

/**
 * **Ποιες περίοδοι ωρίμασαν για ερώτηση** σε ένα γραφείο — όλα τα καταστήματα μαζί, **ένα** email ανά περίοδο.
 *
 * Το `stage` λέει μόνο **πού βρίσκεται ο χρόνος**· αν στάλθηκε ήδη ερώτηση ή υπενθύμιση το ξέρει η υπηρεσία.
 */
export function dueHolidaySeasons(
  locations: readonly HoursOfLocation[],
  instant: Date,
  options: Pick<TimelineOptions, 'holidayOn'> = {},
): readonly DueHolidaySeason[] {
  const todayKey = athensClockAt(instant).dateKey;
  const items = locations.flatMap((location) => pendingHolidayItems(location, instant, options));
  if (items.length === 0) return [];
  return holidaySeasons(todayKey, options.holidayOn)
    .map((season) => dueSeason(season, items, todayKey))
    .filter((due): due is DueHolidaySeason => due !== null);
}

/**
 * **«Πέρσι: Κλειστά»** — η απάντηση του ίδιου καταστήματος για την ίδια αργία την προηγούμενη χρονιά, ή `null`.
 * Κινητές αργίες ταιριάζουν κατά **ταυτότητα** (`easter-monday`), όχι κατά ημερομηνία.
 */
export function lastYearAnswer(history: readonly SettledHolidayAnswer[], item: HolidayQuestionItem): HolidayAnswerKind | null {
  const previousYear = String(Number(item.date.slice(0, 4)) - 1);
  const found = history.find(
    (answer) => answer.locationId === item.locationId && answer.holiday === item.holiday && answer.date.startsWith(`${previousYear}-`),
  );
  return found?.kind ?? null;
}
