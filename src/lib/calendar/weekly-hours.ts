/**
 * @fileoverview **ΤΟ ΕΒΔΟΜΑΔΙΑΙΟ ΩΡΑΡΙΟ ΚΑΙ ΤΟ «ΑΝΟΙΧΤΟ ΤΩΡΑ;»** — ένα σχήμα, μία ώρα (ADR-841 §7 Α21.16 · Α21.16.8).
 * @related lib/calendar/weekly-hours-editing.ts · lib/calendar/greek-public-holidays.ts · types/showcase-card.ts
 * @module lib/calendar/weekly-hours
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΝΕΟ ΣΧΗΜΑ ΚΑΙ ΟΧΙ ΤΟ `config/business-hours.ts`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Εκείνο είναι **σταθερή ρύθμιση** του booking του Telegram, με **ένα** διάστημα ανά
 * ημέρα. Το ελληνικό κατάστημα έχει **σπαστό** ωράριο (09:00–14:00 · 17:30–21:00) — ένα
 * διάστημα θα έλεγε «ανοιχτό» στις 15:00. Εδώ κάθε ημέρα κρατά **πίνακα** διαστημάτων,
 * το ίδιο μοντέλο με το `OpeningHoursSpecification` του schema.org, ώστε το JSON-LD να
 * είναι **προβολή**, όχι μετάφραση.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΜΕΤΑ ΤΑ ΜΕΣΑΝΥΧΤΑ ΚΑΙ 24ΩΡΟ — Η ΣΥΜΒΑΣΗ ΤΗΣ GOOGLE (Α21.16.8)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Google Business Profile API (`TimePeriod`): το κλείσιμο μπορεί να είναι **επόμενη ημέρα**
 * και το `24:00` σημαίνει **τέλος ημέρας**. Εδώ, χωρίς αλλαγή σχήματος στον δίσκο:
 *   • `closes < opens` ⇒ το διάστημα **κλείνει την επόμενη ημέρα** (22:00–02:00)·
 *   • `00:00–24:00` ⇒ **ανοιχτό 24 ώρες** — το `24:00` επιτρέπεται **μόνο** ως κλείσιμο·
 *   • `closes === opens` ⇒ **άκυρο** (ασαφές για άνθρωπο· στο JSON-LD της Google σημαίνει «κλειστά»).
 * Κάθε έγγραφο που περνούσε τον παλιό κριτή περνά και τον νέο (ο παλιός ήταν αυστηρά
 * στενότερος) ⇒ **καμία μετανάστευση**.
 *
 * 🔑 **ΜΙΑ ΕΒΔΟΜΑΔΙΑΙΑ ΓΡΑΜΜΗ ΧΡΟΝΟΥ**: επικαλύψεις (και **ανάμεσα σε ημέρες**) και «ανοιχτό
 * τώρα;» κρίνονται πάνω στα ίδια λεπτά-της-εβδομάδας — ποτέ δύο αριθμητικές.
 *
 * 🔑 **Η ΩΡΑ ΕΙΝΑΙ ΠΑΝΤΑ ΩΡΑ ΕΛΛΑΔΑΣ** — όχι του φυλλομετρητή. Ο επισκέπτης από το
 * Λονδίνο που ρωτά *«είναι ανοιχτό;»* ρωτά για το γραφείο στη Θεσσαλονίκη.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, ασφαλές και στις δύο πλευρές.
 */

import { greekPublicHolidayOn, type GreekPublicHolidayId } from '@/lib/calendar/greek-public-holidays';

/** ISO 8601: 1 = Δευτέρα … 7 = Κυριακή. */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const ISO_WEEKDAYS: readonly IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7];

/** Ένα διάστημα λειτουργίας, `HH:mm` (24ωρο). `closes < opens` ⇒ κλείνει την επόμενη ημέρα. */
export interface DailyInterval {
  readonly opens: string;
  readonly closes: string;
}

/** Ημέρα με `[]` = **κλειστά** — μία αναπαράσταση της απουσίας, όχι δύο. */
export type WeeklyHours = Readonly<Record<IsoWeekday, readonly DailyInterval[]>>;

/** Σπαστό ωράριο + ένα περιθώριο· περισσότερα είναι λάθος πληκτρολόγησης, όχι ωράριο. */
export const MAX_INTERVALS_PER_DAY = 3;

export const MINUTES_PER_DAY = 1440;
const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;

export const START_OF_DAY = '00:00';
/** Τέλος ημέρας — σύμβαση `closeTime: 24:00` της Google. Μόνο ως κλείσιμο. */
export const END_OF_DAY = '24:00';

/** «Σύντομα» — όπως το «Κλείνει σύντομα» της Google: μία ώρα. Ο ΕΝΑΣ ορισμός. */
export const SOON_MINUTES = 60;

export const WEEKLY_HOURS_DEFECTS = [
  'time-malformed',
  'interval-empty',
  'intervals-overlap',
  'overlaps-previous-day',
  'too-many-intervals',
] as const;

export type WeeklyHoursDefect = (typeof WEEKLY_HOURS_DEFECTS)[number];

/** Τι φταίει σε **ποια** ημέρα — η φόρμα το δείχνει δίπλα στη γραμμή της. */
export interface DayDefect {
  readonly weekday: IsoWeekday;
  readonly defect: WeeklyHoursDefect;
}

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** `HH:mm` (00:00–23:59) → λεπτά από τα μεσάνυχτα, ή `null`. */
export function minutesOf(time: string): number | null {
  const match = TIME.exec(time);
  return match === null ? null : Number(match[1]) * 60 + Number(match[2]);
}

function closingMinutesOf(time: string): number | null {
  return time === END_OF_DAY ? MINUTES_PER_DAY : minutesOf(time);
}

/** Λεπτά (0–1440) → `HH:mm`· το 1440 γίνεται `24:00`. */
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export function isAllDay(interval: DailyInterval): boolean {
  return interval.opens === START_OF_DAY && interval.closes === END_OF_DAY;
}

/** Διάρκεια σε λεπτά — `0` για κενό διάστημα, `null` για κακογραμμένη ώρα. */
export function intervalDuration(interval: DailyInterval): number | null {
  const from = minutesOf(interval.opens);
  const to = closingMinutesOf(interval.closes);
  if (from === null || to === null) return null;
  if (to === from) return 0;
  return to > from ? to - from : to + MINUTES_PER_DAY - from;
}

/** Κλείνει **μετά** τα μεσάνυχτα (όχι ακριβώς στα μεσάνυχτα) — η φόρμα το λέει με λέξεις. */
export function endsNextDay(interval: DailyInterval): boolean {
  const from = minutesOf(interval.opens);
  const to = closingMinutesOf(interval.closes);
  return from !== null && to !== null && to > 0 && to < from;
}

// =============================================================================
// Η ΕΒΔΟΜΑΔΙΑΙΑ ΓΡΑΜΜΗ ΧΡΟΝΟΥ
// =============================================================================

interface WeekSpan {
  readonly start: number;
  readonly end: number;
  readonly weekday: IsoWeekday;
}

/** Τα **έγκυρα** διαστήματα ως λεπτά-της-εβδομάδας, ταξινομημένα. Το `end` μπορεί να περάσει την Κυριακή. */
function weekSpans(hours: WeeklyHours): WeekSpan[] {
  const spans: WeekSpan[] = [];
  for (const weekday of ISO_WEEKDAYS) {
    for (const interval of hours[weekday] ?? []) {
      const duration = intervalDuration(interval);
      const from = minutesOf(interval.opens);
      if (duration === null || duration === 0 || from === null) continue;
      const start = (weekday - 1) * MINUTES_PER_DAY + from;
      spans.push({ start, end: start + duration, weekday });
    }
  }
  return spans.sort((left, right) => left.start - right.start);
}

function ownDayDefect(intervals: readonly DailyInterval[]): WeeklyHoursDefect | null {
  if (intervals.length > MAX_INTERVALS_PER_DAY) return 'too-many-intervals';
  for (const interval of intervals) {
    const duration = intervalDuration(interval);
    if (duration === null) return 'time-malformed';
    if (duration === 0) return 'interval-empty';
  }
  return null;
}

/**
 * Επικαλύψεις με **τρέχουσα μέγιστη προσέγγιση** (όχι μόνο ο προηγούμενος γείτονας: ένα μακρύ
 * διάστημα μπορεί να «σκεπάζει» δύο επόμενα) και **κυκλικά** — η βάρδια της Κυριακής που περνά
 * τα μεσάνυχτα πέφτει πάνω στη Δευτέρα.
 */
function markOverlaps(hours: WeeklyHours, found: Map<IsoWeekday, WeeklyHoursDefect>): void {
  const spans = weekSpans(hours);
  if (spans.length === 0) return;
  const first = spans[0];
  const cyclic = [...spans, { ...first, start: first.start + MINUTES_PER_WEEK, end: first.end + MINUTES_PER_WEEK }];
  let reach = cyclic[0];
  for (const span of cyclic.slice(1)) {
    if (span.start < reach.end && !found.has(span.weekday)) {
      found.set(span.weekday, span.weekday === reach.weekday ? 'intervals-overlap' : 'overlaps-previous-day');
    }
    if (span.end > reach.end) reach = span;
  }
}

/**
 * **Ο ΕΝΑΣ κριτής** — τον καλούν η φόρμα (ανάδραση ανά ημέρα), ο διακομιστής (εγγύηση) και ο
 * αναγνώστης (παλιό/χειρόγραφο έγγραφο). Τρεις καλούντες, μία κρίση.
 */
export function weeklyHoursDefects(hours: WeeklyHours): readonly DayDefect[] {
  const found = new Map<IsoWeekday, WeeklyHoursDefect>();
  for (const weekday of ISO_WEEKDAYS) {
    const defect = ownDayDefect(hours[weekday] ?? []);
    if (defect !== null) found.set(weekday, defect);
  }
  markOverlaps(hours, found);
  return ISO_WEEKDAYS.flatMap((weekday) => {
    const defect = found.get(weekday);
    return defect === undefined ? [] : [{ weekday, defect }];
  });
}

/** Το **πρώτο** ελάττωμα — ό,τι χρειάζεται ο διακομιστής για να αρνηθεί. */
export function weeklyHoursDefect(hours: WeeklyHours): WeeklyHoursDefect | null {
  return weeklyHoursDefects(hours)[0]?.defect ?? null;
}

/** Τα διαστήματα **ταξινομημένα** — η μορφή που αποθηκεύεται και εμφανίζεται. */
export function normalizeWeeklyHours(hours: WeeklyHours): WeeklyHours {
  const sorted = (day: readonly DailyInterval[]) =>
    [...day]
      .map(({ opens, closes }) => ({ opens, closes }))
      .sort((left, right) => (minutesOf(left.opens) ?? 0) - (minutesOf(right.opens) ?? 0));
  return {
    1: sorted(hours[1]), 2: sorted(hours[2]), 3: sorted(hours[3]), 4: sorted(hours[4]),
    5: sorted(hours[5]), 6: sorted(hours[6]), 7: sorted(hours[7]),
  };
}

/**
 * **Ανεκτικός αναγνώστης** — `null` όταν το έγγραφο δεν κρατά έγκυρο ωράριο.
 *
 * ⚠️ Ένα μισοδιαβασμένο ωράριο θα έλεγε «κλειστά» για ημέρα που απλώς χάλασε — ψευδής
 * ισχυρισμός σε δημόσια κάρτα. Άρα ή όλο, ή τίποτα.
 */
export function readWeeklyHours(raw: unknown): WeeklyHours | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const source = raw as Record<string, unknown>;
  const days: Partial<Record<IsoWeekday, DailyInterval[]>> = {};
  for (const weekday of ISO_WEEKDAYS) {
    const day = source[String(weekday)];
    if (!Array.isArray(day)) return null;
    const intervals: DailyInterval[] = [];
    for (const entry of day) {
      if (typeof entry !== 'object' || entry === null) return null;
      const { opens, closes } = entry as Record<string, unknown>;
      if (typeof opens !== 'string' || typeof closes !== 'string') return null;
      intervals.push({ opens, closes });
    }
    days[weekday] = intervals;
  }
  const hours = days as WeeklyHours;
  return weeklyHoursDefect(hours) === null ? hours : null;
}

// =============================================================================
// Η ΩΡΑ ΕΛΛΑΔΑΣ
// =============================================================================

export const GREEK_TIME_ZONE = 'Europe/Athens';

/** Τι δείχνει το ρολόι **στην Ελλάδα** αυτή τη στιγμή. */
export interface AthensClock {
  readonly dateKey: string;
  readonly weekday: IsoWeekday;
  readonly minutes: number;
}

const WEEKDAY_OF: Readonly<Record<string, IsoWeekday>> = {
  Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
};

const ATHENS_PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: GREEK_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/**
 * 🔑 **Intl και όχι σταθερή μετατόπιση**: η θερινή ώρα αλλάζει την τελευταία Κυριακή
 * του Μαρτίου και του Οκτωβρίου — ένα `+2` θα έλεγε λάθος ώρα επτά μήνες τον χρόνο.
 */
export function athensClockAt(instant: Date): AthensClock {
  const parts: Record<string, string> = {};
  for (const part of ATHENS_PARTS.formatToParts(instant)) parts[part.type] = part.value;
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: WEEKDAY_OF[parts.weekday] ?? 1,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

// =============================================================================
// ΑΝΟΙΧΤΟ ΤΩΡΑ;
// =============================================================================

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

export type OpenState =
  /** `closes = null` ⇒ ανοιχτό **συνεχώς** (24/7). */
  | { readonly kind: 'open'; readonly closes: HoursMoment | null }
  /** `next = null` ⇒ κλειστά **κάθε** μέρα της εβδομάδας. */
  | { readonly kind: 'closed'; readonly next: HoursMoment | null }
  /** 🔴 **Όχι «κλειστό»**: αργία σημαίνει *«ίσως διαφέρει»* — δεν το δήλωσε ο ίδιος. */
  | { readonly kind: 'holiday'; readonly holiday: GreekPublicHolidayId };

export function isSoon(moment: HoursMoment): boolean {
  return moment.inMinutes <= SOON_MINUTES;
}

interface OpenBlock {
  start: number;
  end: number;
}

/**
 * **Συνεχή ανοίγματα** σε τρεις διαδοχικές εβδομάδες: 23:00–24:00 της Δευτέρας + 00:00–02:00 της
 * Τρίτης είναι **ένα** άνοιγμα που κλείνει Τρίτη 02:00 — όχι «κλείνει στις 24:00».
 */
function openBlocks(hours: WeeklyHours): OpenBlock[] {
  const spans = weekSpans(hours);
  const unrolled = [-1, 0, 1]
    .flatMap((week) => spans.map((span) => ({ start: span.start + week * MINUTES_PER_WEEK, end: span.end + week * MINUTES_PER_WEEK })))
    .sort((left, right) => left.start - right.start);
  const blocks: OpenBlock[] = [];
  for (const span of unrolled) {
    const last = blocks[blocks.length - 1];
    if (last !== undefined && span.start <= last.end) last.end = Math.max(last.end, span.end);
    else blocks.push({ ...span });
  }
  return blocks;
}

/** Λεπτό-της-γραμμής → στιγμή. Κλείσιμο ακριβώς στα μεσάνυχτα = `24:00` της **ίδιας** ημέρας. */
function momentOf(target: number, now: number, edge: 'opens' | 'closes'): HoursMoment {
  const dayIndex = Math.floor((edge === 'closes' ? target - 1 : target) / MINUTES_PER_DAY);
  return {
    weekday: ((((dayIndex % 7) + 7) % 7) + 1) as IsoWeekday,
    time: formatMinutes(target - dayIndex * MINUTES_PER_DAY),
    inDays: dayIndex - Math.floor(now / MINUTES_PER_DAY),
    inMinutes: target - now,
  };
}

/**
 * **Είναι ανοιχτό;** — με την **αργία πρώτη**, επειδή ό,τι λέει το εβδομαδιαίο ωράριο
 * εκείνη τη μέρα είναι ακριβώς αυτό που δεν ξέρουμε.
 */
export function openStateAt(
  hours: WeeklyHours,
  instant: Date,
  holidayOn: (dateKey: string) => GreekPublicHolidayId | null = greekPublicHolidayOn,
): OpenState {
  const clock = athensClockAt(instant);
  const holiday = holidayOn(clock.dateKey);
  if (holiday !== null) return { kind: 'holiday', holiday };

  const now = (clock.weekday - 1) * MINUTES_PER_DAY + clock.minutes;
  const blocks = openBlocks(hours);
  const current = blocks.find((block) => block.start <= now && now < block.end);
  if (current !== undefined) {
    const always = current.end - current.start >= MINUTES_PER_WEEK;
    return { kind: 'open', closes: always ? null : momentOf(current.end, now, 'closes') };
  }
  const next = blocks.find((block) => block.start > now);
  return { kind: 'closed', next: next === undefined ? null : momentOf(next.start, now, 'opens') };
}
