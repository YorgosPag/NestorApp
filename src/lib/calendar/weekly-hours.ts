/**
 * @fileoverview **ΤΟ ΕΒΔΟΜΑΔΙΑΙΟ ΩΡΑΡΙΟ ΚΑΙ ΤΟ «ΑΝΟΙΧΤΟ ΤΩΡΑ;»** — ένα σχήμα, μία ώρα (ADR-841 §7 Α21.16).
 * @related lib/calendar/greek-public-holidays.ts · types/showcase-card.ts
 * @module lib/calendar/weekly-hours
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΝΕΟ ΣΧΗΜΑ ΚΑΙ ΟΧΙ ΤΟ `config/business-hours.ts`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Εκείνο είναι **σταθερή ρύθμιση** του booking του Telegram, με **ένα** διάστημα ανά
 * ημέρα. Το ελληνικό κατάστημα έχει **σπαστό** ωράριο (09:00–14:00 · 17:30–21:00) — ένα
 * διάστημα θα έλεγε «ανοιχτό» στις 15:00. Εδώ κάθε ημέρα κρατά **πίνακα** διαστημάτων,
 * το ίδιο μοντέλο με το `OpeningHoursSpecification` του schema.org, ώστε το JSON-LD της
 * Φ2 να είναι **προβολή**, όχι μετάφραση.
 *
 * ⚠️ **ΚΑΜΙΑ ΜΕΣΟΝΥΚΤΙΑ ΒΑΡΔΙΑ** (Φ1): `closes > opens`, ονομασμένη άρνηση. Ένα
 * 22:00–02:00 θα χρειαζόταν να «ανήκει» σε δύο ημέρες, και κανένας επαγγελματίας του
 * καταλόγου (μηχανικός · μεσίτης · υδραυλικός) δεν το δήλωσε.
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

/** Ένα διάστημα λειτουργίας, `HH:mm` (24ωρο). */
export interface DailyInterval {
  readonly opens: string;
  readonly closes: string;
}

/** Ημέρα με `[]` = **κλειστά** — μία αναπαράσταση της απουσίας, όχι δύο. */
export type WeeklyHours = Readonly<Record<IsoWeekday, readonly DailyInterval[]>>;

/** Σπαστό ωράριο + ένα περιθώριο· περισσότερα είναι λάθος πληκτρολόγησης, όχι ωράριο. */
export const MAX_INTERVALS_PER_DAY = 3;

export const WEEKLY_HOURS_DEFECTS = [
  'time-malformed',
  'interval-empty',
  'intervals-overlap',
  'too-many-intervals',
] as const;

export type WeeklyHoursDefect = (typeof WEEKLY_HOURS_DEFECTS)[number];

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** `HH:mm` → λεπτά από τα μεσάνυχτα, ή `null`. */
export function minutesOf(time: string): number | null {
  const match = TIME.exec(time);
  return match === null ? null : Number(match[1]) * 60 + Number(match[2]);
}

/** **Τι φταίει στην ημέρα** — ή `null` όταν είναι έγκυρη. Διαστήματα ταξινομούνται πρώτα. */
function dayDefect(intervals: readonly DailyInterval[]): WeeklyHoursDefect | null {
  if (intervals.length > MAX_INTERVALS_PER_DAY) return 'too-many-intervals';
  const spans: Array<readonly [number, number]> = [];
  for (const { opens, closes } of intervals) {
    const from = minutesOf(opens);
    const to = minutesOf(closes);
    if (from === null || to === null) return 'time-malformed';
    if (to <= from) return 'interval-empty';
    spans.push([from, to]);
  }
  spans.sort((left, right) => left[0] - right[0]);
  for (let index = 1; index < spans.length; index += 1) {
    if (spans[index][0] < spans[index - 1][1]) return 'intervals-overlap';
  }
  return null;
}

/**
 * **Ο ΕΝΑΣ κριτής** — τον καλούν η φόρμα (ανάδραση), ο διακομιστής (εγγύηση) και ο
 * αναγνώστης (παλιό/χειρόγραφο έγγραφο). Τρεις καλούντες, μία κρίση.
 */
export function weeklyHoursDefect(hours: WeeklyHours): WeeklyHoursDefect | null {
  for (const weekday of ISO_WEEKDAYS) {
    const defect = dayDefect(hours[weekday] ?? []);
    if (defect !== null) return defect;
  }
  return null;
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

export type OpenState =
  | { readonly kind: 'open'; readonly closes: string }
  /**
   * `next = null` ⇒ κλειστά **κάθε** μέρα της εβδομάδας.
   *
   * ⚠️ **Το `inDays` δεν είναι περιττό**: Δευτέρα 20:00 με ωράριο μόνο Δευτέρα 09:00 δίνει
   * `weekday: 1` — και χωρίς απόσταση η κάρτα θα έγραφε «ανοίγει σήμερα στις 09:00».
   */
  | {
      readonly kind: 'closed';
      readonly next: { readonly weekday: IsoWeekday; readonly opens: string; readonly inDays: number } | null;
    }
  /** 🔴 **Όχι «κλειστό»**: αργία σημαίνει *«ίσως διαφέρει»* — δεν το δήλωσε ο ίδιος. */
  | { readonly kind: 'holiday'; readonly holiday: GreekPublicHolidayId };

/** Το επόμενο άνοιγμα, ψάχνοντας από σήμερα (μετά το τώρα) έως επτά ημέρες μπροστά. */
function nextOpening(hours: WeeklyHours, clock: AthensClock): OpenState & { kind: 'closed' } {
  for (let offset = 0; offset < 8; offset += 1) {
    const weekday = (((clock.weekday - 1 + offset) % 7) + 1) as IsoWeekday;
    const later = hours[weekday].find(({ opens }) => offset > 0 || (minutesOf(opens) ?? 0) > clock.minutes);
    if (later !== undefined) return { kind: 'closed', next: { weekday, opens: later.opens, inDays: offset } };
  }
  return { kind: 'closed', next: null };
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

  const current = hours[clock.weekday].find(({ opens, closes }) => {
    const from = minutesOf(opens) ?? 0;
    const to = minutesOf(closes) ?? 0;
    return clock.minutes >= from && clock.minutes < to;
  });
  return current !== undefined ? { kind: 'open', closes: current.closes } : nextOpening(hours, clock);
}
