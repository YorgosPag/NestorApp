/**
 * useEntityFiles-purpose-filter — client-side purpose filter helpers.
 *
 * Extracted from useEntityFiles.ts to honour the Google file-size limit
 * (Hook ≤500 lines). Behavior preserved verbatim.
 *
 * ADR-293 Phase 7 Batch 29:
 * - META_TAB_PURPOSES describes tab-level meta purposes. When a caller
 *   passes one (e.g. 'photo', 'building-photo'), the upload entry-point
 *   selector writes sub-purposes ('interior', 'exterior', 'maintenance',
 *   'facade') that would otherwise be excluded at the view layer. With a
 *   meta purpose, category+domain scope already restricts the set and no
 *   sub-purpose discrimination is desired.
 * - The '*-floorplan' strict semantics (generic 'floorplan' matches any
 *   sub-category like 'project-floorplan') is preserved.
 *
 * ADR-866 §3.1 · ADR-905 §7 βήμα 6 (ζωντανό εύρημα 2026-10-07):
 * - `'document'` είναι ο **ίδιος** μετα-σκοπός για τις καρτέλες «Έγγραφα» (ακίνητο · έργο · κτίριο). Όσο έλειπε από
 *   εδώ, ο σκοπός της καρτέλας **έσβηνε** τον σκοπό του τύπου εγγράφου στο ανέβασμα: «Πιστοποιητικό» γραφόταν
 *   `document` αντί `certificate`, και κανένα αρχείο αυτών των καρτελών δεν ικανοποιούσε γραμμή του καταλόγου
 *   μεταβίβασης (ADR-901), που αντιστοιχίζει με τον σκοπό του τύπου.
 *
 * @module components/shared/files/hooks/useEntityFiles-purpose-filter
 */

import type { FileRecord } from '@/types/file-record';

/** Ο μετα-σκοπός των καρτελών «Έγγραφα» — εφεδρεία όταν δεν επιλέχθηκε τύπος, ποτέ ταυτότητα εγγράφου. */
export const DOCUMENTS_TAB_PURPOSE = 'document';

/**
 * Tab-level meta purposes — see module docstring. Ο σκοπός του **τύπου** κερδίζει στο ανέβασμα
 * (`upload-scope.ts`) και η ανάγνωση δεν διακρίνει υπο-σκοπούς.
 */
export const META_TAB_PURPOSES: ReadonlySet<string> = new Set([
  'photo',
  'building-photo',
  'parking-photo',
  'storage-photo',
  DOCUMENTS_TAB_PURPOSE,
]);

/**
 * Build a predicate that matches a FileRecord against the caller's purpose
 * filter. `undefined` purpose → no filter (accept all).
 */
export function buildPurposeFilter(
  purpose: string | undefined,
): (file: Pick<FileRecord, 'purpose'>) => boolean {
  return (file: Pick<FileRecord, 'purpose'>): boolean => {
    if (!purpose) return true;
    if (!file.purpose) return true;
    if (file.purpose === purpose) return true;
    if (META_TAB_PURPOSES.has(purpose)) return true;
    if (file.purpose === 'floorplan' && purpose.endsWith('-floorplan')) return true;
    return false;
  };
}
