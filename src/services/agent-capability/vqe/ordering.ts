/**
 * Deterministic Ordering — ταξινόμηση για **μηχανές**, όχι για μάτια
 *
 * ⚠️ Σκόπιμα ΔΕΝ χρησιμοποιείται το `compareByLocale()` (`@/lib/intl-formatting`).
 * Εκείνο είναι το SSoT ταξινόμησης **προς εμφάνιση** και στηρίζεται στο ICU:
 * το αποτέλεσμά του εξαρτάται από locale και έκδοση ICU του μηχανήματος. Αν
 * έμπαινε σε preimage hash, το ίδιο σύνολο εισόδων θα έδινε **διαφορετικό
 * αποτύπωμα σε δύο διακομιστές** — δηλαδή ψευδή αναφορά μη-αναπαραγωγιμότητας.
 *
 * Εδώ η ταξινόμηση είναι κατά UTF-16 code unit: ορισμένη από τη γλώσσα,
 * αμετάβλητη σε κάθε μηχανή, σε κάθε locale, σε κάθε έκδοση.
 *
 * @module services/agent-capability/vqe/ordering
 * @see ADR-734 §6.3 κανόνας 2
 */

/** Σύγκριση κατά UTF-16 code unit — locale-ανεξάρτητη, σταθερή παντού. */
export function compareCodeUnits(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Νέος ταξινομημένος πίνακας συμβολοσειρών (η είσοδος δεν μεταβάλλεται). */
export function sortStringsCodeUnit(values: readonly string[]): string[] {
  return [...values].sort(compareCodeUnits);
}

/** Μοναδικές, ταξινομημένες συμβολοσειρές — η κανονική μορφή λίστας αναγνωριστικών. */
export function uniqueSortedStrings(values: readonly string[]): string[] {
  return sortStringsCodeUnit([...new Set(values)]);
}
