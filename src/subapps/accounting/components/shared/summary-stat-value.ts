/**
 * @fileoverview Η τιμή μιας κάρτας σύνοψης — ή «—» όταν η σύνοψη δεν ήρθε (σφάλμα).
 * @see ADR-ACC-010 §2.1.1 (κάρτες σύνοψης) · `hooks/useListSummary.ts`
 *
 * ⚠️ ΠΟΤΕ «0» στη θέση μιας σύνοψης που λείπει: ένα ψεύτικο «Ανεξόφλητο 0 €» ή «Χωρίς αντιστοίχιση 0» είναι χειρότερο
 *    από κανένα νούμερο — λέει «όλα εντάξει» ακριβώς όταν δεν ξέρουμε.
 */

export const SUMMARY_UNAVAILABLE = '—';

export function summaryStatValue<S, V extends string | number>(summary: S | null, pick: (summary: S) => V): V | string {
  return summary === null ? SUMMARY_UNAVAILABLE : pick(summary);
}
