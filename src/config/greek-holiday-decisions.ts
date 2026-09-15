/**
 * @fileoverview **ΟΙ ΜΕΤΑΘΕΣΕΙΣ ΑΡΓΙΩΝ ΠΟΥ ΑΠΟΦΑΣΙΣΤΗΚΑΝ** — δεδομένα με πηγή, όχι υπολογισμός (ADR-841 §7 Α21.21).
 * @related lib/calendar/greek-public-holidays.ts (`labourDayContested` · `greekPublicHolidayOn`)
 * @module config/greek-holiday-decisions
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ «ΠΟΤΕ» ΥΠΟΛΟΓΙΖΕΤΑΙ — ΤΟ «ΠΟΥ» ΤΟ ΑΠΟΦΑΣΙΖΕΙ ΥΠΟΥΡΓΟΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η Πρωτομαγιά (Ν.4808/2021 άρθ. 60) μετατίθεται με **υπουργική απόφαση** όταν πέφτει Κυριακή ή από τη
 * Μεγάλη Δευτέρα ως τη Δευτέρα του Πάσχα. **Πότε** υπάρχει κίνδυνος το ξέρει ο κώδικας
 * (`labourDayContested`)· **σε ποια μέρα** πάει, μόνο η απόφαση. Χρονιά με κίνδυνο **χωρίς** γραμμή εδώ ⇒
 * η 1η Μαΐου μένει «το ωράριο ίσως διαφέρει» και η φόρμα λέει «μπορεί να μετατεθεί» — **ποτέ** εικασία.
 *
 * ⚠️ **Προσθήκη ΜΟΝΟ με πηγή** (ΦΕΚ ή ypergasias.gov.gr).
 * 🔶 **Επόμενη χρονιά με κίνδυνο: 2027** — Πάσχα 2/5 ⇒ η 1/5 είναι Μεγάλο Σάββατο.
 */

export interface GreekHolidayDecision {
  readonly holiday: 'labour-day';
  readonly year: number;
  /** Η ημέρα όπου **μετατέθηκε**, `YYYY-MM-DD`. */
  readonly date: string;
  readonly source: string;
}

export const GREEK_HOLIDAY_DECISIONS: readonly GreekHolidayDecision[] = [
  // 1/5 = Μεγάλη Τετάρτη
  { holiday: 'labour-day', year: 2013, date: '2013-05-07', source: 'ΥΑ 9280/196/1.4.2013 (ΦΕΚ Β΄ 774/03-04-2013)' },
  // 1/5 = Κυριακή του Πάσχα
  { holiday: 'labour-day', year: 2016, date: '2016-05-03', source: 'https://www.pwc.com/gr/el/payroll-greek/newsletters-dimosieuseis/prwtomagia-2016.html' },
  // 1/5 = Μεγάλο Σάββατο
  { holiday: 'labour-day', year: 2021, date: '2021-05-04', source: 'https://ypergasias.gov.gr/tin-triti-4-maiou-2021-metatithetai-i-argia-tis-protomagias/' },
  // 1/5 = Κυριακή
  { holiday: 'labour-day', year: 2022, date: '2022-05-02', source: 'https://www.kepea.gr/aarticle.php?id=2649' },
  // 1/5 = Μεγάλη Τετάρτη
  { holiday: 'labour-day', year: 2024, date: '2024-05-07', source: 'https://ypergasias.gov.gr/domna-michailidou-tin-triti-7-maiou-metatithetai-i-argia-tis-protomagias/' },
];
