/**
 * @module lib/http/retry-after
 * @description **Η ανάγνωση του `Retry-After`** — ΜΙΑ φορά (RFC 9110 §10.2.3).
 *
 * Ζούσε ιδιωτικά στον `overpass-client`· ο πελάτης HTTP του έργου τη χρειάστηκε για το
 * `409 IDEMPOTENCY_IN_FLIGHT` (ADR-853 Ε3 Φάση 2). Δεύτερο αντίγραφο = δύο αναγνώσεις που θα αποκλίνουν.
 *
 * ⚠️ Διαβάζεται **μόνο** η μορφή δευτερολέπτων (`delay-seconds`). Η μορφή ημερομηνίας (`HTTP-date`) δεν
 * την εκπέμπει κανείς από όσους ρωτάμε· αν εμφανιστεί, επιστρέφεται `null` και ο καλών πέφτει στο δικό του
 * backoff — ποτέ σε λάθος αναμονή.
 */

/** Η αναμονή που ζητά ο διακομιστής, σε ms, φραγμένη στο `capMs` — ή `null` αν δεν ζήτησε (έγκυρα). */
export function retryAfterMs(response: Pick<Response, 'headers'> | null | undefined, capMs: number): number | null {
  const header = response?.headers.get('retry-after');
  if (header === null || header === undefined) return null;
  const seconds = Number.parseFloat(header);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.min(seconds * 1000, capMs) : null;
}
