/**
 * @fileoverview Το κοινό συμβόλαιο των εφαρμογέων πινακίδας (ADR-745 Φ3β, Τομέας Γ/Δ2).
 *
 * **Κάθε εφαρμογέας επιστρέφει αποτέλεσμα — ποτέ `void`.** Ο κανόνας Γ9 («πρώτα ο στόχος, μετά
 * το binding») είναι **ανεπίβλητος** πάνω σε συνάρτηση που καταπίνει την αποτυχία: αν ο καλών
 * δεν μπορεί να μάθει αν ο στόχος γράφτηκε, θα γράψει provenance για εγγραφή που δεν έγινε —
 * **φάντασμα provenance**, δηλαδή ψέμα με σφραγίδα ανθρώπου πάνω του.
 *
 * Μετρημένο παράδειγμα του τι αποφεύγουμε: το `useLevelOperations.updateLevelContext` είναι
 * `Promise<void>` με `catch { handleError(...) }` — η αποτυχία γίνεται μήνυμα οθόνης και ο
 * καλών βλέπει επιτυχία.
 *
 * @module services/title-block-apply/apply-types
 */

import type { BindingTarget } from '@/types/title-block-binding';

export type ApplyTargetResult =
  | { readonly success: true; readonly detail?: string }
  | { readonly success: false; readonly error: string; readonly errorCode: string };

export interface ApplyTargetContext {
  /** Ο άνθρωπος που πάτησε το κουμπί — **ποτέ κενό**, το απαιτεί ο κανόνας CREATE. */
  readonly userId: string;
  readonly companyId: string;
  /** Τι έγραφε η πινακίδα — μπαίνει στην αιτιολογία της εγγραφής, όχι στη λήψη απόφασης. */
  readonly snapshotValue: string;
  /**
   * Το ποσοστό ιδιοκτησίας που **δήλωσε ο άνθρωπος** (Γ6).
   *
   * Η πινακίδα δίνει **μόνο όνομα**. Απόν όταν ο στόχος δεν είναι οικοπεδούχος.
   */
  readonly landOwnershipPct?: number;
}

export type ApplyTarget = (target: BindingTarget, ctx: ApplyTargetContext) => Promise<ApplyTargetResult>;

export const applyFailed = (error: string, errorCode: string): ApplyTargetResult => ({
  success: false,
  error,
  errorCode,
});
