/**
 * Η αναφορά εισαγωγής ETIM xChange (ADR-923 Φάση 7). Χωριστό αρχείο τύπων: τη διαβάζει η παρτίδα, άρα δεν πρέπει να φέρνει τον προσαρμογέα.
 * @module subapps/catalog/interop/etim/xchange-report
 */

export interface XChangeImportReport {
  readonly products: number;
  readonly imported: number;
  /** Οι άλλες κλάσεις του αρχείου: τα προϊόντα τους ανήκουν σε άλλη οικογένεια. */
  readonly otherClasses: readonly string[];
  readonly otherClassProducts: number;
  /** Χαρακτηριστικά της κλάσης χωρίς ιδιότητα. Οι ιντσικοί δίδυμοι δεν μετρούν: λένε το ίδιο με τα μετρικά. */
  readonly unmappedFeatures: readonly string[];
  /** Εύρος τιμών: καμία ιδιότητα καταλόγου δεν το κρατά. */
  readonly rangeFeatures: readonly string[];
  /** Δηλωμένα `NA` / `UN`, που η εισαγωγή δεν γράφει ακόμη ως ρητή απουσία. */
  readonly declaredNoValue: number;
  /** Προϊόντα με πολλά εμπορεύσιμα είδη: κρατήθηκε το πρώτο. */
  readonly extraTradeItems: number;
}
