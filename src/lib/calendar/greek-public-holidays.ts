/**
 * @fileoverview **ΟΙ ΑΡΓΙΕΣ ΤΗΣ ΕΛΛΑΔΑΣ — ΥΠΟΛΟΓΙΣΜΕΝΕΣ, ΟΧΙ ΓΡΑΜΜΕΝΕΣ** (ADR-841 §7 Α21.16 · Α21.21).
 * @related lib/calendar/hours-timeline.ts — ο καταναλωτής («ανοιχτό τώρα;») · config/greek-holiday-decisions.ts
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
 * 🔴 **Α21.21 — Η ΠΡΩΤΟΜΑΓΙΑ ΔΕΝ ΕΙΝΑΙ ΣΤΑΘΕΡΗ**: μετατίθεται με υπουργική απόφαση (2013 · 2016 · 2021 · 2022 ·
 * 2024). Το **πότε κινδυνεύει** υπολογίζεται εδώ· το **πού πήγε** ζει με πηγή στο `config/greek-holiday-decisions`.
 *
 * ⚠️ **Εθνικές αργίες μόνο.** Τοπικές (πολιούχοι) **δεν** ξέρουμε ποιον αφορούν — τις δηλώνει ο ίδιος ο
 * επαγγελματίας ως ειδική μέρα. Και σε αργία η κάρτα λέει *«το ωράριο ίσως διαφέρει»*, **ποτέ** «κλειστό».
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, ασφαλές και στις δύο πλευρές.
 */

import { GREEK_HOLIDAY_DECISIONS, type GreekHolidayDecision } from '@/config/greek-holiday-decisions';
import { addDaysToDateKey, isoWeekdayOfDateKey } from '@/lib/calendar/date-key';

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

const LABOUR_DAY = '05-01';

/** Σταθερές αργίες: `MM-DD`. */
const FIXED: ReadonlyArray<readonly [string, GreekPublicHolidayId]> = [
  ['01-01', 'new-year'],
  ['01-06', 'epiphany'],
  ['03-25', 'independence-day'],
  [LABOUR_DAY, 'labour-day'],
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

/** Μεγάλη Δευτέρα … Δευτέρα του Πάσχα — το παράθυρο όπου η Πρωτομαγιά μετατίθεται. */
const HOLY_WEEK_FROM = -6;
const HOLY_WEEK_TO = 1;

const DATE = /^(\d{4})-(\d{2}-\d{2})$/;

/** `YYYY-MM-DD` από ημερομηνία UTC. */
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

function labourDayDecision(year: number): GreekHolidayDecision | undefined {
  return GREEK_HOLIDAY_DECISIONS.find((decision) => decision.holiday === 'labour-day' && decision.year === year);
}

/**
 * **Κινδυνεύει να μετατεθεί η Πρωτομαγιά αυτή τη χρονιά;** — πέφτει Κυριακή, ή από τη Μεγάλη Δευτέρα
 * ως τη Δευτέρα του Πάσχα. Προηγούμενα: 2013/2024 (Μ. Τετάρτη) · 2016 (Κυρ. Πάσχα) · 2021 (Μ. Σάββατο) · 2022 (Κυριακή).
 */
export function labourDayContested(year: number): boolean {
  const labourDay = `${year}-${LABOUR_DAY}`;
  if (isoWeekdayOfDateKey(labourDay) === 7) return true;
  const easter = orthodoxEasterDateKey(year);
  const from = addDaysToDateKey(easter, HOLY_WEEK_FROM);
  const to = addDaysToDateKey(easter, HOLY_WEEK_TO);
  return from !== null && to !== null && from <= labourDay && labourDay <= to;
}

/**
 * **Αργία που ίσως μετατεθεί** — η 1η Μαΐου χρονιάς με κίνδυνο, για την οποία **δεν** ξέρουμε ακόμη απόφαση.
 * Η φόρμα το λέει («μπορεί να μετατεθεί»), ώστε ο άνθρωπος να μη δηλώσει βεβαιότητα για λάθος μέρα.
 */
export function isProvisionalHoliday(dateKey: string): boolean {
  const match = DATE.exec(dateKey);
  if (match === null || match[2] !== LABOUR_DAY) return false;
  const year = Number(match[1]);
  return labourDayContested(year) && labourDayDecision(year) === undefined;
}

/**
 * **Είναι αργία αυτή η ημερολογιακή μέρα;** — `null` όταν όχι.
 *
 * @param dateKey `YYYY-MM-DD` **στην ώρα Ελλάδας** — ο καλών το παράγει από τη στιγμή
 *   (`athensClockAt`), γιατί «ποια μέρα είναι» εξαρτάται από τη ζώνη ώρας.
 */
export function greekPublicHolidayOn(dateKey: string): GreekPublicHolidayId | null {
  const match = DATE.exec(dateKey);
  if (match === null) return null;
  const year = Number(match[1]);

  // 🔑 Απόφαση μετάθεσης: η αργία ζει στη ΝΕΑ μέρα, και η 1η Μαΐου είναι απλή μέρα (ή κινητή αργία, π.χ. 2016).
  const decision = labourDayDecision(year);
  if (decision?.date === dateKey) return 'labour-day';
  const fixed = FIXED.find(([monthDay]) => monthDay === match[2] && !(monthDay === LABOUR_DAY && decision !== undefined));
  if (fixed !== undefined) return fixed[1];

  const easter = orthodoxEasterDateKey(year);
  const movable = MOVABLE.find(([offset]) => addDaysToDateKey(easter, offset) === dateKey);
  return movable === undefined ? null : movable[1];
}
