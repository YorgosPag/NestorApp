/**
 * =============================================================================
 * Η ΩΡΑ ΠΟΥ ΓΡΑΦΕΙ Ο ΔΙΑΚΟΜΙΣΤΗΣ ΣΕ ΑΝΘΡΩΠΟ — πάντα στη ζώνη του φορέα (ADR-877 §6)
 * =============================================================================
 *
 * 🔴 **Γιατί υπάρχει**: email και μηνύματα συντίθενται στον **διακομιστή**, και ο διακομιστής είναι
 * container Docker σε **UTC** (ίδια διαπίστωση με το `server/notifications/email-delivery-clock.ts`).
 * Κάθε `toLocaleString()` / `Intl.DateTimeFormat` **χωρίς** `timeZone` γράφει την ώρα **του
 * μηχανήματος**: η πρόσκληση προμηθευτή έγραφε «λήγει στις 11:17» για σύνδεσμο που λήγει 14:17 ώρα
 * Ελλάδας, και κάθε «σήμερα» μετά τις 21:00 UTC γραφόταν **χθεσινό**. Μετρημένο στον emulator
 * 2026-09-24· στον υπολογιστή ανάπτυξης (ζώνη Αθήνας) το λάθος είναι **αόρατο** — γι' αυτό η άγκυρα
 * τρέχει με `TZ=UTC`.
 *
 * Ήταν **πέντε** μορφοποιητές (email προμηθευτή · `formatEmailDateGreek` · τιμολόγιο · παραγγελία ·
 * ειδοποιήσεις πωλήσεων) + ένας Telegram με `getDay()`. Όλοι ρωτούν πλέον **εδώ**.
 *
 * 🔑 Δύο είδη τιμής, **ένας** δρόμος:
 * - **στιγμή** (`Date`, ms, ISO με ώρα) ⇒ μορφοποιείται στη ζώνη του φορέα·
 * - **ημερολογιακή μέρα** (`YYYY-MM-DD`, π.χ. `invoice.issueDate`) ⇒ αγκυρώνεται στο **μεσημέρι UTC**
 *   (δόγμα `formatCalendarDay`, ADR-841 Α21.21) ⇒ ίδια μέρα σε κάθε ζώνη από −11 έως +11.
 *
 * ⏰ Ρολόι **24 ωρών `h23`**, όχι `hour12: false` (που σε ορισμένα ICU γράφει «24:00»)· ίδιο με
 * `STAY_HOLD_TIME_FORMAT` και `weekly-hours`.
 *
 * @module lib/operator-time-format
 */

import { OPERATOR_TIME_ZONE } from '@/constants/platform-operator';
import { resolveHumanLanguage, type HumanLanguage } from '@/i18n/languages';

/** Ό,τι μπορεί να σημαίνει «πότε» σε ένα πρότυπο. */
export type OperatorTimeValue = Date | string | number;

/**
 * Η γλώσσα → κανόνες γραφής ημερομηνίας. `en-GB` και όχι `en`: ο παραλήπτης μας διαβάζει
 * **μέρα/μήνα** — το αμερικανικό `10/01/2026` είναι η 1η Οκτωβρίου ή η 10η Ιανουαρίου;
 * ⚠️ `Record`, ποτέ `Partial` — νέα γλώσσα δεν μεταγλωττίζεται χωρίς τους κανόνες της.
 */
const INTL_LOCALE: Readonly<Record<HumanLanguage, string>> = { el: 'el-GR', en: 'en-GB' };

const CALENDAR_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

const DATE: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };
const DATE_TIME: Intl.DateTimeFormatOptions = { ...DATE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
const WEEKDAY_DATE: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'numeric' };

/** Τιμή → στιγμή· `null` όταν δεν διαβάζεται (το πρότυπο δεν ρίχνει ποτέ `RangeError`). */
function toInstant(value: OperatorTimeValue): Date | null {
  if (typeof value === 'string') {
    const day = CALENDAR_DAY.exec(value);
    if (day) return new Date(Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3]), 12));
  }
  const instant = value instanceof Date ? value : new Date(value);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

function format(value: OperatorTimeValue, language: string, options: Intl.DateTimeFormatOptions): string {
  const instant = toInstant(value);
  if (!instant) return String(value);
  const locale = INTL_LOCALE[resolveHumanLanguage(language)];
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: OPERATOR_TIME_ZONE }).format(instant);
}

/** `01/10/2026` — ημερομηνία, στη ζώνη του φορέα. */
export function formatOperatorDate(value: OperatorTimeValue, language: string = 'el'): string {
  return format(value, language, DATE);
}

/** `01/10/2026, 14:17` — ημερομηνία και ώρα, στη ζώνη του φορέα. */
export function formatOperatorDateTime(value: OperatorTimeValue, language: string = 'el'): string {
  return format(value, language, DATE_TIME);
}

/** `Τετάρτη 1/10` — μέρα της εβδομάδας + ημερομηνία, στη ζώνη του φορέα. */
export function formatOperatorWeekdayDate(value: OperatorTimeValue, language: string = 'el'): string {
  return format(value, language, WEEKDAY_DATE);
}
