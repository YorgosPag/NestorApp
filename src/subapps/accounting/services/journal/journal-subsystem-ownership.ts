/**
 * @fileoverview Βιβλίο Ε-Ε — ποιες εγγραφές ανήκουν σε υποσύστημα (SSoT, καθαρό)
 * @description Εγγραφή που γέννησε υποσύστημα (σήμερα: αποσβέσεις) αλλάζει ΜΟΝΟ από το υποσύστημα· κατηγορία που
 *   ανήκει σε υποσύστημα ΔΕΝ δέχεται χειροκίνητη εγγραφή.
 *
 * 🔴 ΓΙΑΤΙ (2026-10-15, ADR-ACC-010 §2.1.1 Φάση 5):
 *   - διαγραφή/αλλαγή της εγγραφής απόσβεσης από τη γενική διαδρομή ⇒ η εγγραφή απόσβεσης λέει «καταχωρήθηκε», το
 *     βιβλίο όχι — και η επανεκτέλεση την περνά ξανά ή (χειρότερα) τη βρίσκει «σωστή» και το έξοδο χάνεται·
 *   - χειροκίνητη εγγραφή `depreciation` + εκτέλεση αποσβέσεων ⇒ ΔΙΠΛΟ έξοδο·
 *   - `POST /journal` είναι `passthrough` ⇒ ένας πελάτης θα μπορούσε να στείλει δικό του `source`.
 *   SAP: οι λογαριασμοί του Asset Accounting είναι «reconciliation accounts» — καμία χειροκίνητη εγγραφή, διόρθωση
 *   μόνο μέσα από το υποσύστημα (repeat run / reversal).
 *
 * @see ADR-ACC-010 §2.1.1 (Φάση 5) · ADR-ACC-007 §5.1
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { AccountCategory } from '../../types/common';
import type { JournalEntry } from '../../types/journal';

/** Οι κατηγορίες που γράφει ΜΟΝΟ υποσύστημα — ποτέ χειροκίνητη εγγραφή. */
export const SUBSYSTEM_OWNED_CATEGORIES: ReadonlySet<AccountCategory> = new Set<AccountCategory>(['depreciation']);

/** Ανήκει η εγγραφή σε υποσύστημα; (από την προέλευσή της ή από την κατηγορία της) */
export function isSubsystemOwnedEntry(entry: Pick<JournalEntry, 'source' | 'category'>): boolean {
  return entry.source !== undefined || SUBSYSTEM_OWNED_CATEGORIES.has(entry.category);
}

/** Επιτρέπεται χειροκίνητη εγγραφή με αυτό το σώμα; (ούτε κατηγορία υποσυστήματος, ούτε δηλωμένη προέλευση) */
export function isManualPostingAllowed(body: { readonly category: string; readonly source?: unknown }): boolean {
  return body.source === undefined && !SUBSYSTEM_OWNED_CATEGORIES.has(body.category as AccountCategory);
}
