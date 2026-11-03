/**
 * @fileoverview **Το περιεχόμενο ενός συμφωνητικού από ένα πρόχειρο** — ο ΕΝΑΣ ορισμός για τον γραφέα και την οθόνη
 *   (ADR-928 Φ2 αποφάσεις 4 + 12 · Φ3γ).
 * @module subapps/procurement/subcontracts/agreements/agreement-content-fields
 *
 * 🔑 Ο γραφέας (`agreement-writer.server.ts`) γράφει με αυτό το έγγραφο στη δημιουργία και την αποθήκευση· ο επεξεργαστής
 *    (`project-draft-agreement.ts`) χτίζει με **αυτό** το συμφωνητικό της ζωντανής προεπισκόπησης. Νέο πεδίο του
 *    πρόχειρου μπαίνει εδώ μία φορά και φτάνει και στις δύο πλευρές — η προεπισκόπηση δεν μπορεί να «ξεχάσει» πεδίο
 *    που ο γραφέας αποθηκεύει.
 * 🔑 Τα μέρη, η εμβέλεια και οι κριμένες ρήτρες είναι **είσοδος** (`ResolvedAgreementParts`): τα λύνει ο διακομιστής από
 *    τις πηγές τους· η οθόνη τα παίρνει από το αποθηκευμένο έγγραφο και τον ίδιο κριτή.
 */

import type { AgreementParties, AgreementScope, SubcontractAgreementContent } from '../types/agreement';
import type { ClauseSelection } from '../types/commercial-terms';
import type { SubcontractAgreementDraftInput } from './agreement-draft';

/** Ό,τι δεν γράφει ο άνθρωπος αλλά λύνεται για αυτόν: μέρη από τις πηγές, εμβέλεια με ταυτότητα έργου, ρήτρες κριμένες. */
export interface ResolvedAgreementParts {
  readonly parties: AgreementParties;
  readonly scope: AgreementScope;
  readonly clauses: readonly ClauseSelection[];
}

/** Τα έργα ενός εγγράφου — η **μία** παραγωγή του `projectIds` (Φ2 απόφαση 12). */
export function projectIdsOf(scope: AgreementScope): string[] {
  if (scope.kind === 'single_project') return [scope.project.projectId];
  return [...new Set(scope.assignments.map((assignment) => assignment.project.projectId))];
}

/** Τα πεδία που γράφει ο άνθρωπος + ό,τι λύθηκε — κοινά σε δημιουργία, αποθήκευση και ζωντανή προεπισκόπηση. */
export function contentFieldsOf(input: SubcontractAgreementDraftInput, resolved: ResolvedAgreementParts): SubcontractAgreementContent {
  return {
    documentMode: input.documentMode,
    origin: input.origin,
    trade: input.trade,
    templateId: input.templateId,
    title: input.title,
    parties: resolved.parties,
    scope: resolved.scope,
    projectIds: projectIdsOf(resolved.scope),
    lines: input.lines,
    terms: input.terms,
    clauses: resolved.clauses,
    languages: input.languages,
    validUntil: input.validUntil,
  };
}
