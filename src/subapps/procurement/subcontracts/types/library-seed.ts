/**
 * @fileoverview **Η αναφορά της σποράς της προεπιλεγμένης βιβλιοθήκης** — κοινός τύπος γραφέα και οθόνης (ADR-928 Φ1
 *   απόφαση 5 · Φ3γ-0). Ζει εδώ και όχι στον γραφέα, γιατί εκείνος είναι `server-only`.
 * @module subapps/procurement/subcontracts/types/library-seed
 */

import type { SubcontractIssue } from '../clauses/clause-issues';

export interface DefaultLibrarySeedReport {
  readonly clausesCreated: readonly string[];
  readonly clausesExisting: readonly string[];
  /**
   * Ρήτρες όπου το κείμενο **του Νέστορα** άλλαξε από την τελευταία φορά που το πρόσφερε ⇒ νέα έκδοση `proposed` από το
   * σύστημα, προς έγκριση από άνθρωπο (ADR-928 §5.20). Ποτέ σιωπηλή αντικατάσταση.
   */
  readonly clausesUpdateProposed: readonly string[];
  /** Ίδιο, αλλά υπάρχει ανοιχτή πρόταση **ανθρώπου**: δεν παλεύουμε μαζί της· η επόμενη σπορά την ξαναπροσφέρει. */
  readonly clausesUpdateDeferred: readonly string[];
  readonly templatesCreated: readonly string[];
  readonly templatesExisting: readonly string[];
  /** Πρότυπα που περιμένουν εγκρίσεις ρητρών — με τα ευρήματα, για να ξέρει ο άνθρωπος τι να εγκρίνει. */
  readonly templatesPending: readonly { readonly code: string; readonly issues: readonly SubcontractIssue[] }[];
}
