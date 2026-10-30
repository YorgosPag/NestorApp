/**
 * @fileoverview **ΚΛΕΙΔΙΑ ΗΜΕΡΟΛΟΓΙΑΚΗΣ ΗΜΕΡΑΣ `YYYY-MM-DD`** — αριθμητική ημερών χωρίς ζώνη ώρας (ADR-841 §7 Α21.21).
 * @related lib/date-local.ts (`utcDateOf` · `localDateOf`) · lib/calendar/hours-timeline.ts · lib/calendar/special-hours.ts
 * @module lib/calendar/date-key
 *
 * 🔑 **Μια ημερολογιακή ημέρα δεν έχει ζώνη ώρας**: «25 Δεκεμβρίου» είναι η ίδια μέρα για όλους. Η αριθμητική
 * γίνεται σε **μεσάνυχτα UTC**, όπου κάθε μέρα έχει ακριβώς 24 ώρες — ποτέ σε τοπική `Date`, όπου η αλλαγή ώρας
 * φτιάχνει μέρα 23 ή 25 ωρών και το «+1 ημέρα» πέφτει στην ίδια ημερομηνία. **Ποια** μέρα είναι τώρα το
 * αποφασίζει ο καλών (`athensClockAt`).
 *
 * **Layering**: leaf — καθαρές συναρτήσεις.
 */

import { addMonthsUTC, localDateOf, MS_PER_DAY, normalizeToMillisOrNull, utcDateOf } from '@/lib/date-local';
import { isCalendarDay, parseCalendarDay } from '@/lib/date/calendar-day';
import type { IsoWeekday } from '@/lib/calendar/weekly-hours';

/** Μεσάνυχτα UTC της ημέρας — `null` για κακογραμμένη **ή ανύπαρκτη** ημέρα (30 Φεβρουαρίου). */
function utcMidnightOf(key: string): number | null {
  const day = parseCalendarDay(key);
  if (day === null) return null;
  const midnight = Date.UTC(day.year, day.month - 1, day.day);
  // Το `Date.UTC` διαβάζει τα έτη 0-99 ως 19xx — η επιστροφή στο ίδιο κλειδί τα κρατά έξω από την αριθμητική.
  return utcDateOf(midnight) === key ? midnight : null;
}

/**
 * Υπαρκτή ημερολογιακή ημέρα `YYYY-MM-DD` — το όνομα του λεξιλογίου «κλειδί ημέρας» για τον **έναν** κριτή του
 * έργου (`isCalendarDay`, `lib/date/calendar-day`, ADR-919). Ο κανόνας δεν ζει εδώ: το `date-local` τον χρειάζεται
 * και δεν μπορεί να εισάγει από αυτό το αρχείο (που το εισάγει).
 */
export function isDateKey(value: unknown): value is string {
  return isCalendarDay(value);
}

/** Η ημέρα `days` μετά (αρνητικό = πριν) — `null` για άκυρο κλειδί. */
export function addDaysToDateKey(key: string, days: number): string | null {
  const midnight = utcMidnightOf(key);
  return midnight === null ? null : utcDateOf(midnight + days * MS_PER_DAY);
}

/**
 * Η ημέρα `months` μήνες μετά (αρνητικό = πριν), **ψαλιδισμένη** στο τέλος του μήνα: `2027-01-31` + 1 ⇒ `2027-02-28`,
 * ποτέ 3 Μαρτίου — ο ΕΝΑΣ τρόπος (`addMonthsUTC` → `addMonthsClampedUtc`, ADR-828 §1). `null` για άκυρο κλειδί.
 * Ήταν στο `document-validity/validity-bounds` (λήξεις εγγράφων)· εδώ ώστε να το μοιράζονται και οι δόσεις.
 */
export function addMonthsToDateKey(key: string, months: number): string | null {
  if (!isCalendarDay(key)) return null;
  const untilMs = normalizeToMillisOrNull(addMonthsUTC(key, months));
  return untilMs === null ? null : utcDateOf(untilMs);
}

/** Πόσες ημέρες από το `from` ως το `to` (αρνητικό = το `to` είναι πριν) — `null` αν κάποιο είναι άκυρο. */
export function daysBetweenDateKeys(from: string, to: string): number | null {
  const start = utcMidnightOf(from);
  const end = utcMidnightOf(to);
  return start === null || end === null ? null : Math.round((end - start) / MS_PER_DAY);
}

/** ISO ημέρα της εβδομάδας (1 = Δευτέρα … 7 = Κυριακή). */
export function isoWeekdayOfDateKey(key: string): IsoWeekday | null {
  const midnight = utcMidnightOf(key);
  if (midnight === null) return null;
  const day = new Date(midnight).getUTCDay();
  return (day === 0 ? 7 : day) as IsoWeekday;
}

/** Κλειδί → τοπική `Date` της **ίδιας** ημέρας, για επιλογέα ημερομηνίας. Αντίστροφο του `localDateOf`. */
export function calendarDateOfDateKey(key: string): Date | null {
  const day = parseCalendarDay(key);
  if (day === null) return null;
  const date = new Date(day.year, day.month - 1, day.day);
  return localDateOf(date) === key ? date : null;
}

/**
 * **Επιλογέας ημερομηνίας ↔ κλειδί** — `null` (κλειδί) ⇔ `undefined` (κενό πεδίο). Ένα ζεύγος για κάθε διάλογο που
 * δηλώνει ημέρες (μεταβίβαση · μητρώο λήξεων, ADR-915 §33)· ήταν ιδιωτικά δίδυμα σε δύο components.
 */
export const pickerDateOfKey = (key: string | null): Date | undefined =>
  key === null ? undefined : calendarDateOfDateKey(key) ?? undefined;

export const dateKeyOfPicker = (date: Date | undefined): string | null => (date ? localDateOf(date) : null);
