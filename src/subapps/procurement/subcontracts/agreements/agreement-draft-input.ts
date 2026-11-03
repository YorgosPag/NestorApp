/**
 * @fileoverview **Αποθηκευμένο συμφωνητικό → πρόχειρο** — ό,τι ανοίγει ο επεξεργαστής (ADR-928 Φ3γ).
 * @module subapps/procurement/subcontracts/agreements/agreement-draft-input
 *
 * 🔑 Το αντίστροφο του γραφέα: τα στιγμιότυπα μερών γίνονται ξανά **ids** (Φ2 απόφαση 4), οι κριμένες ρήτρες ξανά είσοδος
 *    με τους λόγους των αποκλίσεων (`selectionInputsOf`). Αποθήκευση του αμετάβλητου πρόχειρου ⇒ ίδιο περιεχόμενο
 *    (στρογγυλή διαδρομή — test).
 */

import type { AgreementScope, ProjectOwnersPresentation, SubcontractAgreement } from '../types/agreement';
import type { AgreementScopeInput, ProjectOwnersInput, SubcontractAgreementDraftInput } from './agreement-draft';
import { selectionInputsOf } from './judge-deviations';

function scopeInputOf(scope: AgreementScope): AgreementScopeInput {
  if (scope.kind === 'multi_project') return { kind: 'multi_project' };
  return { kind: 'single_project', projectId: scope.project.projectId, buildingIds: scope.project.buildingIds };
}

function ownersInputOf(owners: ProjectOwnersPresentation): ProjectOwnersInput {
  if (owners.kind !== 'named') return owners;
  return { kind: 'named', contactIds: owners.owners.map((owner) => owner.contactId) };
}

export function draftInputOf(agreement: SubcontractAgreement): SubcontractAgreementDraftInput {
  return {
    documentMode: agreement.documentMode,
    origin: agreement.origin,
    trade: agreement.trade,
    templateId: agreement.templateId,
    title: agreement.title,
    scope: scopeInputOf(agreement.scope),
    subcontractorContactId: agreement.parties.subcontractor.contactId,
    projectOwners: ownersInputOf(agreement.parties.projectOwners),
    issuerSignatory: agreement.parties.issuerSignatory,
    lines: agreement.lines,
    terms: agreement.terms,
    clauses: selectionInputsOf(agreement.clauses),
    languages: agreement.languages,
    validUntil: agreement.validUntil,
  };
}
