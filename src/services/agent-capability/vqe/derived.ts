/**
 * Derived — το κοινό σχήμα «αποτέλεσμα + προειδοποιήσεις»
 *
 * Κάθε παραγωγός τμήματος του φακέλου (βάση, διακυβέρνηση, προέλευση) μπορεί
 * να ανακαλύψει κάτι που ο πράκτορας πρέπει να ξέρει. Επιστρέφουν όλοι το ίδιο
 * ζεύγος ώστε ο `buildEnvelope()` να τα συνθέτει χωρίς ειδικές περιπτώσεις.
 *
 * @module services/agent-capability/vqe/derived
 * @see ADR-734 §6.2
 */

import type { AllocationWarning } from '@/services/measurements/cost-engine';
import type {
  AllocationIssue,
  EnvelopeIssue,
  EnvelopeWarning,
  EnvelopeWarningCode,
} from '@/types/vqe';

/** Παράγωγο τμήμα του φακέλου μαζί με ό,τι επισημάνθηκε κατά την παραγωγή του. */
export interface Derived<T> {
  readonly result: T;
  readonly warnings: readonly EnvelopeWarning[];
}

/** Μεταδεδομένα προειδοποίησης — όλα προαιρετικά, όλα μηχανικά. */
export interface IssueDetails {
  readonly itemIds?: readonly string[];
  readonly field?: string;
  readonly rawValue?: string;
}

/**
 * Κατασκευή προειδοποίησης επιπέδου φακέλου. Τα προαιρετικά πεδία παραλείπονται
 * όταν δεν δόθηκαν, ώστε δύο ισοδύναμες προειδοποιήσεις να κωδικοποιούνται
 * πανομοιότυπα (σημασία για τη ντετερμινιστική ταξινόμηση).
 */
export function envelopeIssue(code: EnvelopeWarningCode, details: IssueDetails = {}): EnvelopeIssue {
  return {
    source: 'envelope',
    code,
    ...(details.itemIds !== undefined ? { itemIds: details.itemIds } : {}),
    ...(details.field !== undefined ? { field: details.field } : {}),
    ...(details.rawValue !== undefined ? { rawValue: details.rawValue } : {}),
  };
}

/**
 * Προσαρμογή των προειδοποιήσεων επιμερισμού κόστους (`allocateCost()`, ADR-329
 * §3.7.2) στο σχήμα του φακέλου. Ένα σημείο μετατροπής για όλα τα εργαλεία —
 * κανένα δεν χρειάζεται να ξέρει πώς τυλίγεται μια `AllocationWarning`.
 */
export function allocationIssues(
  warnings: readonly AllocationWarning[],
): readonly AllocationIssue[] {
  return warnings.map((detail) => ({ source: 'allocation', detail }));
}
