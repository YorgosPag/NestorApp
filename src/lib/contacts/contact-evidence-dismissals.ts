/**
 * @fileoverview **ΤΟ ΜΗΤΡΩΟ «ΑΓΝΟΗΣΕΩΝ»** ενός αρχείου — καθαρή ανάγνωση και καθαρή αλλαγή (ADR-950 §4.5).
 * @module lib/contacts/contact-evidence-dismissals
 *
 * Σχήμα ADR-759 (`recordDecision` / `isReconciliationCurrent`): **μία** απόφαση ανά γραμμή, η νέα αντικαθιστά την παλιά,
 * και η απόφαση ισχύει **μόνο** για την τιμή του εγγράφου για την οποία πάρθηκε. Ο ΕΝΑΣ γραφέας είναι ο διακομιστής
 * (`server/files/evidence-dismissals-writer`)· εδώ ζει ό,τι δεν χρειάζεται βάση.
 *
 * **Layering**: καθαρή — καμία I/O, κανένα ρολόι.
 */

import {
  EVIDENCE_DISMISS_REASONS,
  EVIDENCE_FIELD_KEYS,
  isEvidenceAddressField,
  isEvidenceIssuerField,
  type EvidenceRowKey,
} from '@/config/contact-document-evidence';
import { isNonEmptyString, isOneOf, isPlainRecord } from '@/lib/type-guards';
import type { EvidenceDismissal } from '@/types/file-record';

/** Το όνομα του πεδίου στο `FileRecord` — ο γραφέας και ο αναγνώστης το παίρνουν **από εδώ**. */
export const EVIDENCE_DISMISSALS_FIELD = 'evidenceDismissals';

/** Είναι κλειδί γραμμής του πίνακα; (πεδίο εκτός διεύθυνσης, ή `address`) */
export function isEvidenceRowKey(value: unknown): value is EvidenceRowKey {
  if (value === 'address') return true;
  return isOneOf(EVIDENCE_FIELD_KEYS, value) && !isEvidenceAddressField(value) && !isEvidenceIssuerField(value);
}

function dismissalOf(raw: unknown): EvidenceDismissal | null {
  if (!isPlainRecord(raw)) return null;
  const { row, documentValueAtDecision, reason, decidedBy, decidedAt } = raw;
  if (!isEvidenceRowKey(row) || !isOneOf(EVIDENCE_DISMISS_REASONS, reason)) return null;
  if (!isNonEmptyString(documentValueAtDecision) || !isNonEmptyString(decidedBy) || !isNonEmptyString(decidedAt)) return null;
  return { row, documentValueAtDecision, reason, decidedBy, decidedAt };
}

/** Ό,τι κρατά ο δίσκος, κριμένο — άκυρη γραμμή **παραλείπεται** (δεν σβήνει τις υπόλοιπες). */
export function readEvidenceDismissals(raw: unknown): readonly EvidenceDismissal[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(dismissalOf).filter((d): d is EvidenceDismissal => d !== null);
}

/** Νέο μητρώο με την απόφαση — αντικαθιστά όποια προηγούμενη για την **ίδια** γραμμή (ιδεμπότητα). */
export function withEvidenceDismissal(
  ledger: readonly EvidenceDismissal[],
  dismissal: EvidenceDismissal,
): readonly EvidenceDismissal[] {
  return [...ledger.filter((d) => d.row !== dismissal.row), dismissal];
}

/** Νέο μητρώο χωρίς την απόφαση της γραμμής — αν δεν υπήρχε, ίδιο περιεχόμενο. */
export function withoutEvidenceDismissal(
  ledger: readonly EvidenceDismissal[],
  row: EvidenceRowKey,
): readonly EvidenceDismissal[] {
  return ledger.filter((d) => d.row !== row);
}
