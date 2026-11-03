/**
 * @fileoverview **Οι πράξεις του συμφωνητικού υπεργολαβίας, όπως τις στέλνει η οθόνη** — μεταφορά, όχι κρίση (ADR-928
 *   §5.14 · §5.15 · Φ3α-2).
 * @related subapps/procurement/subcontracts/subcontract-routes.ts (οι διαδρομές) · app/api/subcontracts/agreements/**
 *   (ο αυθεντικός γραφέας) · services/procurement/subcontracts/subcontract-failure.ts (η ερμηνεία της άρνησης)
 * @module services/procurement/subcontracts/subcontract-agreements-api.client
 *
 * 🔑 **Καμία κρίση εδώ**: η οθόνη κρίνει με τους **ίδιους** καθαρούς κριτές (`validateAgreementDraft`,
 *    `judgeClauseSelections`, `refuseTransition`) και ο γραφέας ξανακρίνει (αυθεντία).
 * 🔑 **`apiClient`, όχι `fetch`**: `Idempotency-Key` σε κάθε εγγραφή (CHECK 3.92) — η αυτόματη επανάληψη μετά από
 *    διακοπή δικτύου δεν γεννά δεύτερο συμφωνητικό ούτε δεύτερο αριθμό εγγράφου· κρατά το σώμα της άρνησης ώστε τα
 *    ευρήματα να φτάσουν δίπλα στο πεδίο τους.
 * 🔑 **Οι αναγνώσεις δεν περνούν από εδώ**: η λίστα ακούει απευθείας τη Firestore (`useProjectSubcontractAgreements`).
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import type { SubcontractAgreementDraftInput } from '@/subapps/procurement/subcontracts/agreements/agreement-draft';
import { SUBCONTRACT_API } from '@/subapps/procurement/subcontracts/subcontract-routes';
import type {
  AgreementAssignmentInput,
  AgreementDeviationDecisionInput,
  AgreementTransitionInput,
  AgreementTransitionResult,
  SubcontractAgreement,
  SubcontractAgreementTransition,
} from '@/subapps/procurement/subcontracts/types/agreement';

const routes = SUBCONTRACT_API.agreements;

/** Νέο έγγραφο σε πρόχειρο — μέρη και έργο τα λύνει ο διακομιστής από τα ids. */
export function createSubcontractAgreement(draft: SubcontractAgreementDraftInput): Promise<SubcontractAgreement> {
  return apiClient.post<SubcontractAgreement>(routes.collection, { draft });
}

/** Αποθήκευση πρόχειρου με CAS: 409 `revisionMismatch` ⇒ άλλαξε από άλλον, ποτέ σιωπηλή αντικατάσταση. */
export function updateSubcontractAgreementDraft(
  id: string,
  expectedRevision: number,
  draft: SubcontractAgreementDraftInput,
): Promise<SubcontractAgreement> {
  return apiClient.patch<SubcontractAgreement>(routes.item(id), { expectedRevision, draft });
}

/** Μετάβαση κύκλου ζωής (`issue` · `accept` · `mobilize` · …). */
export function transitionSubcontractAgreement(
  id: string,
  transition: SubcontractAgreementTransition,
  input: AgreementTransitionInput,
): Promise<AgreementTransitionResult> {
  return apiClient.post<AgreementTransitionResult>(routes.transition(id, transition), input);
}

/** Εντολή εργασίας: ανάθεση εργοταξίου σε κύρια σύμβαση (κρίνεται στο **έργο-στόχο**, §5.15). */
export function assignSubcontractAgreement(id: string, input: AgreementAssignmentInput): Promise<SubcontractAgreement> {
  return apiClient.post<SubcontractAgreement>(routes.assignments(id), input);
}

/** Απόφαση απόκλισης — από **άλλον** από τον αιτούντα (403 `selfApproval` αλλιώς). */
export function decideSubcontractAgreementDeviation(
  id: string,
  input: AgreementDeviationDecisionInput,
): Promise<SubcontractAgreement> {
  return apiClient.post<SubcontractAgreement>(routes.decideDeviation(id), input);
}
