/**
 * @fileoverview **Τα προτεινόμενα πρότυπα που δεν γράφτηκαν ακόμη — και τι περιμένουν** — καθαρό, ζωντανό (ADR-928
 *   Φ1 απόφαση 5 · Φ3γ-0).
 * @module subapps/procurement/subcontracts/library/seed-template-readiness
 *
 * 🔑 Η σπορά γράφει ένα πρότυπο **μόνο** όταν περνά τον έλεγχο απέναντι στην **εγκεκριμένη** βιβλιοθήκη· τα υπόλοιπα
 *    τα επιστρέφει ως «εκκρεμή με ευρήματα» σε μια αναφορά που **παλιώνει** με την πρώτη έγκριση. Εδώ ο **ίδιος**
 *    `validateTemplateAgainstLibrary` τρέχει πάνω στη **ζωντανή** βιβλιοθήκη της οθόνης: «το πρότυπο περιμένει τις
 *    ρήτρες Χ, Υ» αλλάζει τη στιγμή που εγκρίνεται η Χ, και το «έτοιμο να γραφτεί» λέγεται χωρίς να ρωτηθεί ο διακομιστής.
 * 🔑 Ίδια μορφή εισόδου με τον γραφέα (`readApprovedLibrary`): κλειδί → παράμετροι της έκδοσης σε ισχύ · `null` = υπάρχει
 *    χωρίς έκδοση · απουσία = άγνωστη/αρχειοθετημένη. Η προβολή από την `ApprovedLibrary` είναι **μία** (`libraryParametersOf`).
 */

import type { ApprovedLibrary } from '../agreements/judge-deviations';
import type { SubcontractIssue } from '../clauses/clause-issues';
import { validateTemplateAgainstLibrary } from '../templates/validate-trade-template';
import type { ClauseKey } from '../types/clause';
import type { ClauseParameterDefinition } from '../types/clause-parameter';
import type { SubcontractTradeTemplate, SubcontractTradeTemplateDefinition } from '../types/trade-template';

/** Η είσοδος του `validateTemplateAgainstLibrary`, από τη βιβλιοθήκη του κριτή. */
export function libraryParametersOf(library: ApprovedLibrary): ReadonlyMap<ClauseKey, readonly ClauseParameterDefinition[] | null> {
  return new Map([...library].map(([key, inForce]) => [key, inForce === null ? null : inForce.parameters]));
}

export interface PendingSeedTemplate {
  readonly definition: SubcontractTradeTemplateDefinition;
  /** Κενό ⇒ θα γραφτεί στην επόμενη σπορά. */
  readonly issues: readonly SubcontractIssue[];
  /** Τα κλειδιά των ρητρών του προτύπου που **δεν** έχουν ακόμη έκδοση σε ισχύ — «τι να εγκρίνω». */
  readonly awaitingClauses: readonly ClauseKey[];
}

/**
 * Τα προτεινόμενα πρότυπα που **δεν** υπάρχουν στον χώρο (κατά `code`, και αρχειοθετημένα μετρούν ως υπάρχοντα: η σπορά
 * δεν τα ξαναγράφει), με τα ευρήματά τους απέναντι στη ζωντανή βιβλιοθήκη.
 */
export function pendingSeedTemplatesOf(
  defaults: readonly SubcontractTradeTemplateDefinition[],
  existing: readonly Pick<SubcontractTradeTemplate, 'code'>[],
  library: ApprovedLibrary,
): PendingSeedTemplate[] {
  const written = new Set(existing.map((template) => template.code));
  const parameters = libraryParametersOf(library);
  return defaults
    .filter((definition) => !written.has(definition.code))
    .map((definition) => ({
      definition,
      issues: validateTemplateAgainstLibrary(definition, parameters),
      awaitingClauses: definition.clauses.map((ref) => ref.clauseKey).filter((key) => !parameters.get(key)),
    }));
}
