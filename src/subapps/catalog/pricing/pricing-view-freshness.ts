/**
 * **Πότε μπαγιατεύει μόνη της μια όψη τιμών** (ADR-923 §5.11 «3δ» Ζ · ADR-905 §3 «ρολόι λήξης αντί για polling»).
 *
 * Η «τρέχουσα» έκδοση ενός τιμοκαταλόγου και οι «ισχύουσες» συνθήκες αλλάζουν **χωρίς καμία εγγραφή**: τη στιγμή που
 * αρχίζει μια μελλοντική έκδοση ή που αρχίζει/λήγει μια συνθήκη. Η όψη δηλώνει την **πρώτη** τέτοια στιγμή μετά το
 * «τώρα»· ο πελάτης ξαναρωτά ακριβώς τότε. Χωρίς κανένα όριο μπροστά, ένα ανώτατο ρολόι (δίχτυ) κρατά την όψη
 * πεπερασμένη — για ό,τι δεν φτάνει ούτε ως σήμα ούτε ως όριο.
 *
 * @module subapps/catalog/pricing/pricing-view-freshness
 */

/** Το δίχτυ: καμία όψη τιμών δεν θεωρείται φρέσκια πάνω από 6 ώρες χωρίς επαναβεβαίωση. */
export const PRICING_VIEW_MAX_AGE_MS = 6 * 60 * 60 * 1000;

/** Η πρώτη στιγμή **αυστηρά** μετά το `nowMs` ανάμεσα στα όρια (ISO· `null`/άκυρα αγνοούνται), ή το δίχτυ. */
export function pricingFreshUntil(nowMs: number, boundaries: Iterable<string | null>): string {
  let next = nowMs + PRICING_VIEW_MAX_AGE_MS;
  for (const boundary of boundaries) {
    if (boundary === null) continue;
    const ms = Date.parse(boundary);
    if (Number.isFinite(ms) && ms > nowMs && ms < next) next = ms;
  }
  return new Date(next).toISOString();
}
