/**
 * @fileoverview **Η άρση διατήρησης ορφανών bytes** — η πηγή μιας γραμμής σβήστηκε **εκτός** εφαρμογής ενώ τη διατηρούσε η
 *               απόδειξη (Φ-Δ.7α), άρα το GCS `temporaryHold` δεν θα το έλυνε ποτέ κανείς (ADR-916 §5.24 · Ο24).
 * @related server/property-handover-delivery/handover-delivery-orphan-release.server.ts (η ΜΙΑ απόφαση)
 * @module types/property-handover-orphan-release
 *
 * 🔑 Purview: *η άρση δεν διαγράφει* — το περιεχόμενο γίνεται «eligible for the standard cleanup process». Εδώ: άρση υπό
 *    συνθήκη + σημάδι υποψηφίου ⇒ ο **υπάρχων** `orphanSweeper` (ADR-694) αποφασίζει, και μένει ο **μόνος** που σβήνει.
 */

/**
 * **Γιατί τα bytes ΚΡΑΤΙΟΥΝΤΑΙ** — κλειστό λεξιλόγιο (κάθε άλλη έκβαση = άρση):
 * - `hold-evidence`: η στοίβα του αρχείου κρατά δέσμευση/record, ή το ίχνος δείχνει `hold_place` χωρίς μεταγενέστερο `hold_release`.
 * - `claimed`: μια `FileRecord` διεκδικεί ακόμη αυτό το όνομα.
 * - `open-proof`: άλλη γραμμή, σε παράδοση που ακόμη οφείλεται, περιμένει απόδειξη από τα ίδια bytes.
 * - `foreign-object`: στο όνομα ζουν **άλλα** bytes (crc32c/μέγεθος ≠ γραμμής) — δεν είναι δικά μας να τα αγγίξουμε.
 * - `unrecognized-path`: το όνομα δεν το αναγνωρίζει ο κανόνας `files` του μητρώου κηδεμονίας ⇒ ο sweeper δεν θα το έκρινε ποτέ.
 * - `unreadable`: κάποια ανάγνωση απέτυχε — «δεν ξέρω» δεν είναι ποτέ «ελεύθερο» (fail-closed).
 */
export const HANDOVER_ORPHAN_RELEASE_KEEP_REASONS = [
  'hold-evidence',
  'claimed',
  'open-proof',
  'foreign-object',
  'unrecognized-path',
  'unreadable',
] as const;
export type HandoverOrphanReleaseKeepReason = (typeof HANDOVER_ORPHAN_RELEASE_KEEP_REASONS)[number];

/** Λόγοι που **μπορεί να αλλάξουν** — το δίχτυ ξαναρωτά (η δέσμευση αίρεται· η άλλη απόδειξη κλείνει· η ανάγνωση πετυχαίνει). */
export const HANDOVER_ORPHAN_RELEASE_RETRYABLE_REASONS = ['hold-evidence', 'open-proof', 'unreadable'] as const satisfies readonly HandoverOrphanReleaseKeepReason[];

/**
 * Οι καταστάσεις του ημερολογίου: `pending` (η πρόθεση γράφτηκε **στη συναλλαγή** που έκλεισε τη γραμμή) · `released` (τα bytes
 * ελεύθερα **και** σημαδεμένα) · `gone` (κανένα αντικείμενο στο όνομα) · `kept` (με λόγο).
 */
export const HANDOVER_ORPHAN_RELEASE_STATES = ['pending', 'released', 'gone', 'kept'] as const;
export type HandoverOrphanReleaseState = (typeof HANDOVER_ORPHAN_RELEASE_STATES)[number];

/** Το ημερολόγιο στη γραμμή καθολικού — όπως το `recovery` της Φ-Δ.7β: δεν αγγίζει **ποτέ** πεδίο απόδειξης. */
export interface HandoverOrphanReleaseJournal {
  readonly state: HandoverOrphanReleaseState;
  readonly reason: HandoverOrphanReleaseKeepReason | null;
  readonly since: string;
  readonly settledAt: string | null;
}
