/**
 * @fileoverview **ΟΙ ΑΡΓΙΕΣ ΤΗΣ ΕΛΛΑΔΑΣ — ΥΠΟΛΟΓΙΣΜΕΝΕΣ, ΟΧΙ ΓΡΑΜΜΕΝΕΣ** (ADR-841 §7 Α21.16).
 * @related lib/calendar/weekly-hours.ts — ο καταναλωτής («ανοιχτό τώρα;»)
 * @module lib/calendar/greek-public-holidays
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΟΛΟΓΙΖΕΤΑΙ ΤΟ ΠΑΣΧΑ ΚΑΙ ΔΕΝ ΓΡΑΦΕΤΑΙ ΣΕ ΠΙΝΑΚΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Τέσσερις από τις αργίες (Καθαρά Δευτέρα · Μ. Παρασκευή · Δευτέρα του Πάσχα · Αγίου
 * Πνεύματος) **κινούνται** με το Ορθόδοξο Πάσχα. Ένας πίνακας ημερομηνιών είναι
 * **ωρολογιακή βόμβα**: τελειώνει κάποια χρονιά, και από εκεί και πέρα η κάρτα λέει
 * «ανοιχτό» την Καθαρά Δευτέρα **χωρίς να σκάσει τίποτα**. Ο αλγόριθμος του Meeus
 * (Ιουλιανό Πάσχα + 13 ημέρες, έγκυρος 1900–2099) δεν τελειώνει ποτέ μέσα στη ζωή του
 * προϊόντος.
 *
 * ⚠️ **Εθνικές αργίες μόνο.** Τοπικές (πολιούχοι) **δεν** ξέρουμε ποιον αφορούν — και
 * η κάρτα σε αργία λέει *«το ωράριο ίσως διαφέρει»*, **ποτέ** «κλειστό». Ούτε η Google
 * ισχυρίζεται κάτι που δεν της δήλωσε ο επαγγελματίας.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, καμία εξάρτηση, ασφαλές και στις δύο πλευρές.
 */

/** Η ταυτότητα μιας αργίας — **κλειδί**, όχι κείμενο (N.11: το όνομα το δίνει το i18n). */
export const GREEK_PUBLIC_HOLIDAY_IDS = [
  'new-year',
  'epiphany',
  'clean-monday',
  'independence-day',
  'good-friday',
  'easter-sunday',
  'easter-monday',
  'labour-day',
  'whit-monday',
  'assumption',
  'ochi-day',
  'christmas',
  'boxing-day',
] as const;

export type GreekPublicHolidayId = (typeof GREEK_PUBLIC_HOLIDAY_IDS)[number];

/** Σταθερές αργίες: `MM-DD`. */
const FIXED: ReadonlyArray<readonly [string, GreekPublicHolidayId]> = [
  ['01-01', 'new-year'],
  ['01-06', 'epiphany'],
  ['03-25', 'independence-day'],
  ['05-01', 'labour-day'],
  ['08-15', 'assumption'],
  ['10-28', 'ochi-day'],
  ['12-25', 'christmas'],
  ['12-26', 'boxing-day'],
];

/** Κινητές αργίες: απόσταση σε ημέρες από την Κυριακή του Πάσχα. */
const MOVABLE: ReadonlyArray<readonly [number, GreekPublicHolidayId]> = [
  [-48, 'clean-monday'],
  [-2, 'good-friday'],
  [0, 'easter-sunday'],
  [1, 'easter-monday'],
  [50, 'whit-monday'],
];

/** `YYYY-MM-DD` από ημερομηνία UTC — η μόνη μορφή κλειδιού που χρησιμοποιεί αυτό το αρχείο. */
function dateKeyOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * **Η Κυριακή του Ορθόδοξου Πάσχα** (Γρηγοριανή), ως `YYYY-MM-DD`.
 *
 * Meeus, *Astronomical Algorithms*: Ιουλιανό Πάσχα, και +13 ημέρες για τη μετατροπή σε
 * Γρηγοριανό — η διαφορά είναι 13 ημέρες για όλο το 1900–2099.
 */
export function orthodoxEasterDateKey(year: number): string {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  return dateKeyOf(new Date(Date.UTC(year, month - 1, day + 13)));
}

/**
 * **Είναι αργία αυτή η ημερολογιακή μέρα;** — `null` όταν όχι.
 *
 * @param dateKey `YYYY-MM-DD` **στην ώρα Ελλάδας** — ο καλών το παράγει από τη στιγμή
 *   (`athensClockAt`), γιατί «ποια μέρα είναι» εξαρτάται από τη ζώνη ώρας.
 */
export function greekPublicHolidayOn(dateKey: string): GreekPublicHolidayId | null {
  const match = /^(\d{4})-(\d{2}-\d{2})$/.exec(dateKey);
  if (match === null) return null;

  const fixed = FIXED.find(([monthDay]) => monthDay === match[2]);
  if (fixed !== undefined) return fixed[1];

  const year = Number(match[1]);
  const [easterYear, easterMonth, easterDay] = orthodoxEasterDateKey(year).split('-').map(Number);
  for (const [offset, id] of MOVABLE) {
    const key = dateKeyOf(new Date(Date.UTC(easterYear, easterMonth - 1, easterDay + offset)));
    if (key === dateKey) return id;
  }
  return null;
}
