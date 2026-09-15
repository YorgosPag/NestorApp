/**
 * @fileoverview **ΑΝΟΙΧΤΟ ΤΩΡΑ; — ΠΑΝΩ ΣΕ ΠΡΑΓΜΑΤΙΚΕΣ ΗΜΕΡΟΜΗΝΙΕΣ** (ADR-841 §7 Α21.16.8 · Α21.21).
 * @related lib/calendar/weekly-hours.ts · lib/calendar/special-hours.ts · lib/calendar/greek-public-holidays.ts ·
 *   components/mandate/ShowcaseOpeningHours.tsx
 * @module lib/calendar/hours-timeline
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΟΧΙ ΠΙΑ «ΛΕΠΤΑ-ΤΗΣ-ΕΒΔΟΜΑΔΑΣ»
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η εβδομάδα είναι **κυκλική**, οι ημερομηνίες όχι: με ειδικές ώρες, η Τρίτη αυτής της εβδομάδας δεν είναι η
 * Τρίτη της επόμενης. Άρα η γραμμή χρόνου στρώνεται πάνω σε **ημερομηνίες** (χθες … +14 ημέρες), και κάθε ημέρα
 * ρωτά με σειρά: **ειδική μέρα** → **αργία σε μέρα που θα ήταν ανοιχτά** («δεν ξέρουμε») → **εβδομαδιαίο**.
 *
 * 🔑 **ΤΑ ΤΡΙΑ ΛΑΘΗ ΠΟΥ ΔΙΟΡΘΩΝΕΙ** (Α21.21):
 *   1. αργία σε μέρα **ήδη κλειστή** ⇒ «Κλειστό» — η απάντηση είναι βέβαιη, όχι «ίσως διαφέρει»·
 *   2. η αργία **μπροστά** δεν αποσιωπάται: «ανοίγει Τρίτη 09:00» όταν η Δευτέρα είναι αργία **το λέει** (`uncertain`)·
 *   3. μετά τα μεσάνυχτα, το διάστημα **ανήκει στη μέρα που ξεκινά** (GBP `SpecialHourPeriod`) — η βάρδια της
 *      παραμονής μένει ανοιχτή μέσα στην αργία.
 *
 * ⚠️ Κάθε ημέρα μετρά 1440 λεπτά: τις δύο νύχτες αλλαγής ώρας τον χρόνο ένα «σε Χ λεπτά» μπορεί να απέχει μία
 * ώρα — ίδια παραδοχή με τη γραμμή που αντικατέστησε· το **ποια μέρα και ποια ώρα** μένει ακριβές.
 *
 * **Layering**: καθαρές συναρτήσεις, ασφαλές και στις δύο πλευρές.
 */

import { addDaysToDateKey } from '@/lib/calendar/date-key';
import {
  greekPublicHolidayOn,
  isProvisionalHoliday,
  type GreekPublicHolidayId,
} from '@/lib/calendar/greek-public-holidays';
import { SPECIAL_DAYS_HORIZON_DAYS, type SpecialDay, type SpecialDayKind } from '@/lib/calendar/special-hours';
import {
  athensClockAt,
  formatMinutes,
  intervalDuration,
  minutesOf,
  MINUTES_PER_DAY,
  SOON_MINUTES,
  type AthensClock,
  type DailyInterval,
  type IsoWeekday,
  type WeeklyHours,
} from '@/lib/calendar/weekly-hours';

const DAYS_PER_WEEK = 7;
const WINDOW_PAST_DAYS = 1;
const WINDOW_AHEAD_DAYS = 14;

export interface TimelineOptions {
  /** Οι ειδικές μέρες του καταστήματος (Α21.21). */
  readonly special?: readonly SpecialDay[];
  /** Εγχέεται στις άγκυρες· προεπιλογή οι ελληνικές αργίες. */
  readonly holidayOn?: (dateKey: string) => GreekPublicHolidayId | null;
}

/** **Τι ξέρουμε για μία ημερομηνία.** */
export type DayPlan =
  | {
      readonly kind: 'known';
      readonly intervals: readonly DailyInterval[];
      /** Από πού ήρθε η βεβαιότητα — η σελίδα λέει «Ειδικό ωράριο» όταν δεν είναι το εβδομαδιαίο. */
      readonly source: 'weekly' | SpecialDayKind;
      readonly holiday: GreekPublicHolidayId | null;
    }
  /** 🔴 Αργία σε μέρα που **θα ήταν ανοιχτά**, χωρίς δήλωση — «το ωράριο ίσως διαφέρει», ποτέ εικασία. */
  | { readonly kind: 'unknown'; readonly holiday: GreekPublicHolidayId };

export interface CalendarDay {
  readonly dateKey: string;
  readonly weekday: IsoWeekday;
  readonly inDays: number;
  readonly plan: DayPlan;
}

/**
 * Μια στιγμή του ωραρίου **σε σχέση με το τώρα**.
 *
 * ⚠️ **Το `inDays` δεν είναι περιττό**: Δευτέρα 20:00 με ωράριο μόνο Δευτέρα 09:00 δίνει
 * `weekday: 1` — και χωρίς απόσταση η κάρτα θα έγραφε «ανοίγει σήμερα στις 09:00».
 */
export interface HoursMoment {
  readonly weekday: IsoWeekday;
  readonly time: string;
  readonly inDays: number;
  readonly inMinutes: number;
}

/** Μια αργία **χωρίς δήλωση** ανάμεσα στο τώρα και στο επόμενο άνοιγμα. */
export interface UncertainDay {
  readonly holiday: GreekPublicHolidayId;
  readonly weekday: IsoWeekday;
  readonly inDays: number;
}

export type OpenState =
  /** `closes = null` ⇒ ανοιχτό για τουλάχιστον μία εβδομάδα χωρίς διακοπή (24/7). */
  | { readonly kind: 'open'; readonly closes: HoursMoment | null }
  /** `next = null` ⇒ κανένα γνωστό άνοιγμα στο παράθυρο. */
  | { readonly kind: 'closed'; readonly next: HoursMoment | null; readonly uncertain: UncertainDay | null }
  | { readonly kind: 'holiday'; readonly holiday: GreekPublicHolidayId };

export function isSoon(moment: HoursMoment): boolean {
  return moment.inMinutes <= SOON_MINUTES;
}

function weekdayAfter(weekday: IsoWeekday, days: number): IsoWeekday {
  return ((((weekday - 1 + days) % DAYS_PER_WEEK) + DAYS_PER_WEEK) % DAYS_PER_WEEK + 1) as IsoWeekday;
}

function declaredIntervals(declared: SpecialDay, weekly: readonly DailyInterval[]): readonly DailyInterval[] {
  if (declared.kind === 'closed') return [];
  return declared.kind === 'regular' ? weekly : declared.intervals;
}

function planOf(dateKey: string, weekday: IsoWeekday, hours: WeeklyHours, options: TimelineOptions): DayPlan {
  const holiday = (options.holidayOn ?? greekPublicHolidayOn)(dateKey);
  const weekly = hours[weekday];
  const declared = options.special?.find((day) => day.date === dateKey);
  if (declared !== undefined) {
    return { kind: 'known', intervals: declaredIntervals(declared, weekly), source: declared.kind, holiday };
  }
  // 🔴 Λάθος 1: αργία σε μέρα ΗΔΗ κλειστή είναι βέβαιο «κλειστά» — δεν υπάρχει τι να διαφέρει.
  if (holiday !== null && weekly.length > 0) return { kind: 'unknown', holiday };
  return { kind: 'known', intervals: weekly, source: 'weekly', holiday };
}

function calendarDays(clock: AthensClock, hours: WeeklyHours, options: TimelineOptions, from: number, to: number): CalendarDay[] {
  const days: CalendarDay[] = [];
  for (let inDays = from; inDays <= to; inDays += 1) {
    const dateKey = addDaysToDateKey(clock.dateKey, inDays);
    if (dateKey === null) continue;
    const weekday = weekdayAfter(clock.weekday, inDays);
    days.push({ dateKey, weekday, inDays, plan: planOf(dateKey, weekday, hours, options) });
  }
  return days;
}

interface OpenBlock {
  start: number;
  end: number;
}

/**
 * **Συνεχή ανοίγματα** σε λεπτά από τα σημερινά μεσάνυχτα: 23:00–24:00 της Δευτέρας + 00:00–02:00 της Τρίτης
 * είναι **ένα** άνοιγμα που κλείνει Τρίτη 02:00. Οι μέρες «δεν ξέρουμε» δεν γεννούν ανοίγματα.
 */
function openBlocks(days: readonly CalendarDay[]): OpenBlock[] {
  const spans = days
    .flatMap(({ inDays, plan }) => (plan.kind === 'unknown' ? [] : plan.intervals.flatMap((interval) => {
      const from = minutesOf(interval.opens);
      const duration = intervalDuration(interval);
      if (from === null || duration === null || duration === 0) return [];
      const start = inDays * MINUTES_PER_DAY + from;
      return [{ start, end: start + duration }];
    })))
    .sort((left, right) => left.start - right.start);
  const blocks: OpenBlock[] = [];
  for (const span of spans) {
    const last = blocks[blocks.length - 1];
    if (last !== undefined && span.start <= last.end) last.end = Math.max(last.end, span.end);
    else blocks.push({ ...span });
  }
  return blocks;
}

/** Λεπτό-της-γραμμής → στιγμή. Κλείσιμο ακριβώς στα μεσάνυχτα = `24:00` της **ίδιας** ημέρας. */
function momentOf(target: number, now: number, edge: 'opens' | 'closes', today: IsoWeekday): HoursMoment {
  const inDays = Math.floor((edge === 'closes' ? target - 1 : target) / MINUTES_PER_DAY);
  return {
    weekday: weekdayAfter(today, inDays),
    time: formatMinutes(target - inDays * MINUTES_PER_DAY),
    inDays,
    inMinutes: target - now,
  };
}

/** 🔴 Λάθος 2: η πρώτη αργία «δεν ξέρουμε» **πριν** από το επόμενο άνοιγμα (ή μέσα στην εβδομάδα, αν δεν υπάρχει). */
function uncertainBefore(days: readonly CalendarDay[], lastDay: number): UncertainDay | null {
  const day = days.find(({ inDays, plan }) => inDays > 0 && inDays <= lastDay && plan.kind === 'unknown');
  return day === undefined || day.plan.kind !== 'unknown'
    ? null
    : { holiday: day.plan.holiday, weekday: day.weekday, inDays: day.inDays };
}

/**
 * **Είναι ανοιχτό;** — πρώτα «είμαστε μέσα σε γνωστό άνοιγμα;» (η βάρδια της παραμονής, λάθος 3), μετά
 * «είναι σήμερα αργία χωρίς δήλωση;», μετά «πότε ανοίγει».
 */
export function openStateAt(hours: WeeklyHours, instant: Date, options: TimelineOptions = {}): OpenState {
  const clock = athensClockAt(instant);
  const days = calendarDays(clock, hours, options, -WINDOW_PAST_DAYS, WINDOW_AHEAD_DAYS);
  const now = clock.minutes;
  const blocks = openBlocks(days);

  const current = blocks.find((block) => block.start <= now && now < block.end);
  if (current !== undefined) {
    const always = current.end - now >= DAYS_PER_WEEK * MINUTES_PER_DAY;
    return { kind: 'open', closes: always ? null : momentOf(current.end, now, 'closes', clock.weekday) };
  }
  const today = days.find(({ inDays }) => inDays === 0);
  if (today?.plan.kind === 'unknown') return { kind: 'holiday', holiday: today.plan.holiday };

  const upcoming = blocks.find((block) => block.start > now);
  const next = upcoming === undefined ? null : momentOf(upcoming.start, now, 'opens', clock.weekday);
  return { kind: 'closed', next, uncertain: uncertainBefore(days, next?.inDays ?? DAYS_PER_WEEK - 1) };
}

/** **Οι επόμενες `count` ημέρες από σήμερα**, με ό,τι ξέρουμε για την καθεμία — ο πίνακας της σελίδας (όπως το Google Maps). */
export function upcomingDays(hours: WeeklyHours, instant: Date, count: number, options: TimelineOptions = {}): readonly CalendarDay[] {
  return calendarDays(athensClockAt(instant), hours, options, 0, count - 1);
}

export interface HolidayQuestion {
  readonly dateKey: string;
  readonly holiday: GreekPublicHolidayId;
  /** Η Πρωτομαγιά χρονιάς με κίνδυνο μετάθεσης, χωρίς γνωστή απόφαση — «μπορεί να μετατεθεί». */
  readonly provisional: boolean;
}

/**
 * **Οι αργίες που περιμένουν απάντηση** — εθνικές αργίες, μέσα στον ορίζοντα των ειδικών ωρών, που πέφτουν σε μέρα
 * **ανοιχτή** και **δεν** έχουν δήλωση. Ο ΕΝΑΣ κριτής για τις «Προτεινόμενες αργίες» της φόρμας **και** για την
 * ερώτηση της Φάσης Β — ποτέ δεύτερη λίστα που θα ρωτούσε κάτι ήδη απαντημένο.
 */
export function holidaysNeedingAnswer(hours: WeeklyHours, instant: Date, options: TimelineOptions = {}): readonly HolidayQuestion[] {
  return calendarDays(athensClockAt(instant), hours, options, 0, SPECIAL_DAYS_HORIZON_DAYS).flatMap(({ dateKey, plan }) =>
    plan.kind === 'unknown' ? [{ dateKey, holiday: plan.holiday, provisional: isProvisionalHoliday(dateKey) }] : [],
  );
}
