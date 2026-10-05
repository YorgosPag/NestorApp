/**
 * Οι δύο αποσύρσεις μιας εγγραφής — κάδος και αρχείο — ως **δεδομένα**.
 *
 * Ο μηχανισμός είναι ένας (`soft-delete-engine`: `retire` · `reinstate`)· εδώ ζει μόνο ό,τι
 * διαφέρει. Το διαβάζουν οι μεταβάσεις και η ανάγνωση των λιστών, ώστε «ποια τιμή σημαίνει
 * αρχείο» να μην γράφεται δύο φορές.
 *
 * @module lib/firestore/lifecycle-retirements
 * @enterprise ADR-281 — SSOT Soft-Delete System · ADR-329 §3.9
 */

import "server-only";

import { ARCHIVED_STATUS, TRASHED_STATUS } from "./trashed-status";
import type { AuditAction } from "@/types/audit-trail";

// ============================================================================
// ΟΙ ΔΥΟ ΑΠΟΣΥΡΣΕΙΣ — ως δεδομένα
// ============================================================================

/** Ό,τι διαφέρει ανάμεσα σε κάδο και αρχείο. Ο μηχανισμός είναι ένας. */
export interface Retirement {
  /** Η τιμή του `status` όσο η εγγραφή είναι εκεί. */
  readonly status: string;
  /** Οι σφραγίδες «πότε» και «ποιος» — υπάρχουν μόνο όσο η εγγραφή είναι εκεί. */
  readonly atField: string;
  readonly byField: string;
  /** Η πράξη που γράφεται στο ιστορικό όταν η εγγραφή μπαίνει εκεί. */
  readonly action: AuditAction;
  /**
   * Η πράξη όταν η εγγραφή **επιστρέφει** από εκεί. Το `restored` σημαίνει ρητά «από τον
   * κάδο» για τον αναγνώστη του ιστορικού· η επιστροφή από το αρχείο είναι αλλαγή κατάστασης.
   */
  readonly restoreAction: AuditAction;
  /** Για τα μηνύματα άρνησης (`is not in trash`). */
  readonly place: string;
}

export const TRASH: Retirement = {
  status: TRASHED_STATUS,
  atField: "deletedAt",
  byField: "deletedBy",
  action: "soft_deleted",
  restoreAction: "restored",
  place: "trash",
};

export const ARCHIVE: Retirement = {
  status: ARCHIVED_STATUS,
  atField: "archivedAt",
  byField: "archivedBy",
  action: "status_changed",
  restoreAction: "status_changed",
  place: "archive",
};

export const RETIREMENTS: readonly Retirement[] = [TRASH, ARCHIVE];
