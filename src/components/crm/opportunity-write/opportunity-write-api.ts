/**
 * @fileoverview **Η κλήση της ΜΙΑΣ πόρτας πεδίων ευκαιρίας από τον browser** — δημιουργία · επεξεργασία · διαγραφή,
 * με τυποποιημένο αποτέλεσμα (ADR-930 §3.10).
 * @module components/crm/opportunity-write/opportunity-write-api
 *
 * Η μετάφραση 409/403/400 ζει σε ΕΝΑ σημείο (`../opportunity-door-call`), κοινό με την πόρτα κατόχου. Το `Idempotency-Key`
 * είναι ίδιο σε κάθε επανάληψη ⇒ ένα διπλό κλικ = ΜΙΑ ευκαιρία. Η σύγκρουση εδώ δεν κουβαλά στοιχεία.
 */

import { API_ROUTES } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type {
  OpportunityCreateBody,
  OpportunityCreateResponse,
  OpportunityUpdateBody,
  OpportunityUpdateResponse,
} from '@/services/crm/opportunity-fields-schema';
import { callOpportunityDoor, noConflictDetail, type OpportunityDoorResult } from '../opportunity-door-call';

export type OpportunityWriteResult<T> = OpportunityDoorResult<T>;

function call<T>(request: () => Promise<T>): Promise<OpportunityWriteResult<T>> {
  return callOpportunityDoor(request, noConflictDetail);
}

export function postOpportunity(body: OpportunityCreateBody): Promise<OpportunityWriteResult<OpportunityCreateResponse>> {
  return call(() => apiClient.post<OpportunityCreateResponse>(API_ROUTES.OPPORTUNITIES.LIST, body));
}

export function patchOpportunity(
  opportunityId: string,
  body: OpportunityUpdateBody,
): Promise<OpportunityWriteResult<OpportunityUpdateResponse>> {
  return call(() => apiClient.patch<OpportunityUpdateResponse>(API_ROUTES.OPPORTUNITIES.BY_ID(opportunityId), body));
}

export function deleteOpportunityRequest(opportunityId: string): Promise<OpportunityWriteResult<void>> {
  return call(() => apiClient.delete<void>(API_ROUTES.OPPORTUNITIES.BY_ID(opportunityId)));
}
