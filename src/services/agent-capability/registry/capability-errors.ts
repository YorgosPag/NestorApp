/**
 * Capability Errors — κλειστό λεξιλόγιο σφαλμάτων του στρώματος L2
 *
 * Οι κωδικοί είναι υποσύνολο του **`google.rpc.Code`** (το λεξιλόγιο που
 * χρησιμοποιούν τα Google Cloud APIs και το gRPC). Δεν εφευρίσκουμε δικό μας:
 * ο πράκτορας και οι μελλοντικοί MCP clients αναγνωρίζουν ήδη αυτά τα ονόματα,
 * και ο χάρτης προς HTTP status είναι τυποποιημένος.
 *
 * ⚠️ **Τα μηνύματα είναι πρωτόκολλο, όχι UI.** Πηγαίνουν σε LLM, όχι σε οθόνη —
 * ίδιο μοτίβο με τα `VALIDATION_ERROR:`/`GOVERNANCE_ERROR:` του `boq-service`
 * και με τους κωδικούς `AllocationWarning.type`. Καμία υποχρέωση i18n (N.11):
 * το UI, αν ποτέ τα δείξει, μεταφράζει τον **κωδικό**.
 *
 * @module services/agent-capability/registry/capability-errors
 * @see ADR-734 §5.4 (η επιβολή ζει σε ντετερμινιστικό στρώμα)
 */

/** Κωδικοί σφάλματος — υποσύνολο `google.rpc.Code`. */
export type CapabilityErrorCode =
  /** Το όνομα δυνατότητας δεν υπάρχει στο registry. */
  | 'NOT_FOUND'
  /** Τα ορίσματα δεν πέρασαν τον έλεγχο της προδιαγραφής. */
  | 'INVALID_ARGUMENT'
  /** Λείπει ταυτότητα/tenant — δεν υπάρχει `companyId` στο context. */
  | 'UNAUTHENTICATED'
  /** Ταυτοποιημένος αλλά χωρίς δικαίωμα (policy του registry). */
  | 'PERMISSION_DENIED'
  /** Απροσδόκητη αστοχία κατά την εκτέλεση — ποτέ δεν διαρρέει stack. */
  | 'INTERNAL';

/**
 * Σφάλμα δυνατότητας.
 *
 * Το `details` είναι **επίπεδο, μηχανικό** (κλειδί → τιμή), ώστε να μπορεί να
 * καταγραφεί και να σειριοποιηθεί χωρίς απώλεια. Ποτέ πρόζα.
 */
export interface CapabilityError {
  readonly code: CapabilityErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, string>>;
}

/** Κατασκευή σφάλματος. Μία πόρτα ⇒ σταθερή μορφή σε όλο το στρώμα. */
export function capabilityError(
  code: CapabilityErrorCode,
  message: string,
  details?: Readonly<Record<string, string>>,
): CapabilityError {
  return details === undefined ? { code, message } : { code, message, details };
}

/**
 * Σφάλμα «δεν βρέθηκε» για πόρο **άλλου** πελάτη.
 *
 * ⚠️ Σκόπιμα `NOT_FOUND` και **όχι** `PERMISSION_DENIED`: το δεύτερο θα
 * επιβεβαίωνε ότι το id **υπάρχει**, δηλαδή θα λειτουργούσε ως μαντείο ύπαρξης
 * για πράκτορα που δοκιμάζει ids. Ο πράκτορας είναι αναξιόπιστη πηγή id
 * (ADR-734 §7 — διόρθωση tenant isolation).
 */
export function notFoundError(resource: string, id: string): CapabilityError {
  return capabilityError('NOT_FOUND', `${resource} not found: ${id}`, { resource, id });
}
