/**
 * Τα **είδη άρνησης** του γραφέα καταλόγου (ADR-923 §5.9) — κλειστό σύνολο, το καθένα με **ένα** HTTP status.
 * Καθαρό αρχείο, χωρίς I/O: το διαβάζουν **και** ο διακομιστής (`CatalogWriteError` → `ApiError`) **και** ο πελάτης
 * (`catalogFailureOf`), ώστε νέο είδος να μην αποκλίνει ποτέ ανάμεσα στους δύο (ήταν χειρόγραφο αντίγραφο ως την 3β).
 * @module subapps/catalog/schema/catalog-write-kinds
 */

export const CATALOG_WRITE_ERROR_KINDS = {
  /** Ανύπαρκτο, διαγραμμένο ή ξένου χώρου — **ίδια** απάντηση και για τα τρία (ξένο ≡ ανύπαρκτο). */
  notFound: 404,
  /** Υπάρχει ήδη ενεργή οντότητα με αυτόν τον κωδικό. */
  duplicateCode: 409,
  /** Κάποιος άλλος άλλαξε την οντότητα από τότε που τη διάβασε ο πελάτης (CAS). */
  revisionMismatch: 409,
  /** Η οντότητα χρησιμοποιείται — η πράξη θα άφηνε ορφανές αναφορές. */
  inUse: 409,
  /** Αλλαγή πεδίου που είναι αμετάβλητο (κωδικός, ή τύπος ιδιότητας σε χρήση). */
  immutable: 422,
  /** Η σημασιολογική επικύρωση βρήκε ευρήματα. */
  invalid: 422,
  /**
   * Η πράξη είναι νόμιμη, αλλά θέλει **ρητή επιβεβαίωση αυτού που είδε ο άνθρωπος** (ADR-923 §5.11 «3β» απόφαση Γ:
   * δημοσίευση με γραμμές πάνω από τον φράχτη). 409, όχι 422: τίποτα δεν είναι λάθος — ο πελάτης δείχνει τη
   * διαφορά και ξαναστέλνει με το αποτύπωμά της.
   */
  confirmationRequired: 409,
} as const;

export type CatalogWriteErrorKind = keyof typeof CATALOG_WRITE_ERROR_KINDS;

export const CATALOG_WRITE_ERROR_KIND_NAMES = Object.keys(CATALOG_WRITE_ERROR_KINDS) as readonly CatalogWriteErrorKind[];
