/**
 * @fileoverview **Το συμβόλαιο μιας γενικής ενότητας** του επεξεργαστή υπεργολαβίας (ADR-928 Φ3γ-2 απόφαση 1).
 * @module components/procurement/subcontracts/sections/section-types
 *
 * Η ενότητα κρατά **ένα τμήμα** του εγγράφου (γραμμές · όρους · σχέδιο πληρωμών) και ξέρει μόνο τρία πράγματα:
 *   - την τιμή του και πώς τη δίνει πίσω (`onChange`, πάντα νέο αντικείμενο)·
 *   - το **μονοπάτι** του μέσα στο έγγραφο (`path`): `lines` / `terms` στο συμφωνητικό, `lines` / `defaultTerms` στο
 *     πρότυπο (Φ3γ-0b). Τα ευρήματα του κριτή δένονται με `joinPath(path, …)`, με τα **ίδια** τμήματα που γράφει ο
 *     επικυρωτής·
 *   - τις γλώσσες: της οθόνης (ετικέτες) και τη δεύτερη του εγγράφου (πολύγλωσσα κείμενα).
 * Δεν ξέρει τίποτα για τον επεξεργαστή, την αποθήκευση ή τον γραφέα.
 */

import type { HumanLanguage } from '@/i18n/languages';
import type { BoundTerm, BoundTermsAt } from '@/subapps/procurement/subcontracts/agreements/bound-terms';
import type { SubcontractIssue } from '@/subapps/procurement/subcontracts/clauses/clause-issues';

/**
 * Οι ρήτρες που δένουν πεδία του τμήματος (ADR-928 Φ3γ-2 απόφαση 2). `setReason` = πού γράφεται ο λόγος απόκλισης. Ο
 * επεξεργαστής προτύπου (Φ3γ-0b) δίνει `null`, γιατί το πρότυπο δεν δέχεται αποκλίσεις, μόνο ελεύθερες ζώνες.
 */
export interface BoundTermsView {
  readonly at: BoundTermsAt;
  readonly setReason: ((bound: BoundTerm, reason: string) => void) | null;
  /** Ο τίτλος της ρήτρας στη γλώσσα της οθόνης — ποτέ ο κωδικός μπροστά στον άνθρωπο. */
  readonly titleOf: (clauseKey: string) => string;
}

export interface SectionProps<T> {
  readonly value: T;
  readonly onChange: (next: T) => void;
  readonly path: string;
  /** Όλα τα ευρήματα του εγγράφου — η ενότητα διαλέγει τα δικά της με το `path`. */
  readonly issues: readonly SubcontractIssue[];
  /** Η γλώσσα της οθόνης. */
  readonly language: HumanLanguage;
  /** Η δεύτερη γλώσσα του **εγγράφου** (`null` = μόνο ελληνικά). */
  readonly secondaryLanguage: string | null;
}

/** Ένα πεδίο του τμήματος: η τιμή του, η αλλαγή του, και τα ευρήματα στο μονοπάτι του. */
export interface FieldProps<T> {
  readonly id: string;
  readonly value: T;
  readonly onChange: (next: T) => void;
  readonly path: string;
  readonly issues: readonly SubcontractIssue[];
}
