/**
 * SoftDeletableFields — Mixin interface for soft-delete lifecycle
 *
 * Every entity that supports soft-delete intersects with this:
 *   export interface Property extends BaseProperty & SoftDeletableFields { ... }
 *
 * @module types/soft-deletable
 * @enterprise ADR-281 — SSOT Soft-Delete System
 */

/** Firestore-compatible timestamp (server | client | read) */
type FirestoreishTimestamp = Date | { toDate: () => Date };

/**
 * Fields added to every soft-deletable entity.
 * Present ONLY when status='deleted' (or after restore).
 */
export interface SoftDeletableFields {
  /** Timestamp when moved to trash */
  deletedAt?: FirestoreishTimestamp;
  /** UID of user who deleted it */
  deletedBy?: string;
  /** Status before deletion — used for restore */
  previousStatus?: string;
  /**
   * Πότε έγινε η **τελευταία επαναφορά** — από τον κάδο **ή** από το αρχείο. Οι δύο
   * επαναφορές είναι η ίδια πράξη της μηχανής (`reinstate`) και γράφουν την ίδια σφραγίδα·
   * από πού επέστρεψε το λέει το ιστορικό (`restored` έναντι `status_changed`), όχι αυτό το πεδίο.
   */
  restoredAt?: FirestoreishTimestamp;
  /** Ποιος έκανε την τελευταία επαναφορά (από κάδο ή αρχείο). */
  restoredBy?: string;
  /** Πότε μπήκε στο αρχείο — παρόν μόνο όσο `status='archived'` (ADR-329 §3.9). */
  archivedAt?: FirestoreishTimestamp | null;
  /** Ποιος το αρχειοθέτησε (χρήστης ή `system:<διεργασία>`). */
  archivedBy?: string | null;
}

/** Entity types that support soft-delete lifecycle */
export type SoftDeletableEntityType =
  | "contact"
  | "property"
  | "building"
  | "project"
  | "parking"
  | "storage";

/**
 * Ό,τι έκανε μια επαναφορά **πέρα** από την αλλαγή κατάστασης, με όνομα που καταλαβαίνει
 * η οθόνη. Κλειστό σύνολο: ο άνθρωπος που πάτησε «Επαναφορά» δικαιούται να μάθει τι
 * άλλο άλλαξε, και ο πελάτης δεν το μαντεύει από το `restoredStatus`.
 *
 *   `taken-off-market` — η εγγραφή επέστρεψε **εκτός αγοράς** (ακίνητο από το αρχείο).
 *
 * Ζει εδώ (ουδέτερο αρχείο τύπων) γιατί το μιλούν και οι δύο πλευρές: το δηλώνει το
 * `lifecycle-effects` (server-only) και το διαβάζει το `TrashService` (πελάτης).
 */
export type LifecycleOutcome = "taken-off-market";
