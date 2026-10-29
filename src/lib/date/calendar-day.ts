/**
 * 📅 **ΥΠΑΡΧΕΙ ΑΥΤΗ Η ΗΜΕΡΑ;** — η μία κρίση «ημερολογιακή ημέρα ISO `YYYY-MM-DD`» του έργου.
 *
 * ## Το ερώτημα που απαντά
 * Το `/^\d{4}-\d{2}-\d{2}$/` απαντά «**μοιάζει** με ημέρα;». Δέχεται `2027-02-30`, `2027-13-01`,
 * `2027-00-10` — τιμές που ταξινομούνται κανονικά ως συμβολοσειρές, πέφτουν σε εύρη όπου δεν ανήκουν
 * και, μόλις κάποιος τις περάσει από `Date`, **κυλούν σιωπηλά** στον επόμενο μήνα (η V8 δέχεται
 * ημέρα ≤ 31 σε κάθε μήνα). Εδώ η απάντηση είναι «**υπάρχει** στο ημερολόγιο;».
 *
 * ## Απόρριψη, ποτέ ψαλίδισμα
 * Ίδια απόφαση με το zod (`z.string().date()` — regex με δίσεκτα) και το date-fns
 * (`isValid(parseISO('2027-02-30'))` ⇒ `false`). Το Temporal ψαλιδίζει από προεπιλογή
 * (`overflow: 'constrain'`) γιατί **κατασκευάζει** ημερομηνία· ένας **κριτής** που ψαλιδίζει θα
 * έλεγε «ναι» σε κάτι που ο άνθρωπος δεν έγραψε. Το ψαλίδισμα ζει εκεί όπου ανήκει, στην
 * **αριθμητική** ({@link module:lib/date/calendar-arithmetic}).
 *
 * ## Τι ΔΕΝ είναι
 * - **Όχι στιγμή, όχι ζώνη ώρας.** `2027-02-28T00:00Z` ✗ — η ώρα σε σύγκριση ημερών αλλάζει σιωπηλά
 *   τη σημασία της. Για στιγμές: `normalizeToDate` (`lib/date-local.ts`).
 * - **Όχι πρόθεμα.** Όποιος ρωτά «αρχίζει με ημερομηνία;» (μορφοποίηση τιμής ιστορικού) ρωτά άλλο
 *   πράγμα και δεν καλεί αυτό.
 * - **Όχι «ή κενό».** Το «δεν συμπληρώθηκε» είναι απόφαση του καλούντος (`value === '' || …`).
 *
 * ## Έτη
 * Τέσσερα ψηφία, προληπτικό Γρηγοριανό (ISO 8601): `0000`…`9999`. Το `0099-01-01` είναι το έτος 99,
 * **όχι** 1999 — γι' αυτό ο έλεγχος είναι αριθμητικός και δεν περνά από `Date.UTC` (βλ. {@link daysInMonth}).
 *
 * @module lib/date/calendar-day
 * @see docs/centralized-systems/reference/adrs/ADR-919-listing-availability-vocabulary.md
 */

// Σχετική διαδρομή επίτηδες: το `lib/date-local.ts` το εισάγουν scripts χωρίς το alias `@/`, και εκείνο εισάγει αυτό.
import { daysInMonth } from './calendar-arithmetic';

/** Ημερολογιακή ημέρα σε συνιστώσες· ο `month` είναι **1-based** (Ιανουάριος = 1), όπως γράφεται. */
export interface CalendarDay {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

const CALENDAR_DAY_SHAPE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * **Σχήμα** `YYYY-MM-DD`, χωρίς κρίση ύπαρξης — μόνο για όποιον πρέπει να διακρίνει «σκέτη ημέρα» από «στιγμή»
 * **πριν** κρίνει: το `2026-02-30` είναι ανύπαρκτη ημέρα (⇒ απόρριψη), **όχι** στιγμή για τον `Date`, που θα το
 * κυλούσε στις 2 Μαρτίου. Για «είναι ημέρα;» η απάντηση είναι πάντα {@link isCalendarDay}.
 */
export function hasCalendarDayShape(value: string): boolean {
  return CALENDAR_DAY_SHAPE.test(value);
}

/**
 * Υπάρχει η ημέρα `year`-`month`-`day` (μήνας 1-based); Για όποιον έχει ήδη τις συνιστώσες από άλλη
 * μορφή (π.χ. `DD/MM/YYYY`) — ο ίδιος κανόνας, χωρίς δεύτερο regex.
 */
export function calendarDayExists(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= daysInMonth(year, month);
}

/** `YYYY-MM-DD` που υπάρχει **στο ημερολόγιο** ⇒ συνιστώσες· οτιδήποτε άλλο ⇒ `null`. */
export function parseCalendarDay(value: unknown): CalendarDay | null {
  if (typeof value !== 'string') return null;
  const parts = CALENDAR_DAY_SHAPE.exec(value);
  if (parts === null) return null;
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  return calendarDayExists(year, month, day) ? { year, month, day } : null;
}

/**
 * **Ο κριτής.** `true` μόνο για `YYYY-MM-DD` που υπάρχει: `2028-02-29` ✓ · `2027-02-29` ✗ ·
 * `2027-02-30` ✗ · `2027-13-01` ✗ · `' 2027-01-01'` ✗ (κανένα σιωπηλό `trim` — το κάνει ο καλών).
 */
export function isCalendarDay(value: unknown): value is string {
  return parseCalendarDay(value) !== null;
}

/** Συνιστώσες ⇒ `YYYY-MM-DD` (μηδενικά μπροστά, και στο έτος). Δεν κρίνει — ο καλών έχει ήδη υπαρκτή ημέρα. */
export function formatCalendarDay(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
