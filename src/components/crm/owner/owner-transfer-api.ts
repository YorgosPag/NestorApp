/**
 * @fileoverview **Η κλήση της ΜΙΑΣ πόρτας κατόχου από τον browser** — με τυποποιημένο αποτέλεσμα (ADR-930 §3.8).
 * @module components/crm/owner/owner-transfer-api
 *
 * Η μετάφραση 409/403/400 ζει σε ΕΝΑ σημείο (`../opportunity-door-call`), κοινό με την πόρτα πεδίων. Εδώ η σύγκρουση
 * κουβαλά `currentOwnerUid` = ο κάτοχος τώρα (άλλος τη μεταβίβασε στο μεταξύ).
 */

import { API_ROUTES } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type {
  OpportunityOwnerBody,
  OpportunityOwnerCandidatesResponse,
  OpportunityOwnerTransferResponse,
} from '@/services/crm/opportunity-owner-schema';
import { errorBodyText } from '../stage-move/stage-move-api';
import { callOpportunityDoor, type OpportunityDoorResult } from '../opportunity-door-call';

interface OwnerConflictDetail {
  readonly currentOwnerUid: string | null;
}

export type OwnerTransferResult = OpportunityDoorResult<OpportunityOwnerTransferResponse, OwnerConflictDetail>;

function ownerConflictOf(errorBody: unknown): OwnerConflictDetail {
  return { currentOwnerUid: errorBodyText(errorBody, 'currentOwnerUid') };
}

export function postOwnerTransfer(opportunityId: string, body: OpportunityOwnerBody): Promise<OwnerTransferResult> {
  return callOpportunityDoor(
    () => apiClient.post<OpportunityOwnerTransferResponse>(API_ROUTES.OPPORTUNITIES.OWNER(opportunityId), body),
    ownerConflictOf,
  );
}

export function fetchOwnerCandidates(opportunityId: string): Promise<OpportunityOwnerCandidatesResponse> {
  return apiClient.get<OpportunityOwnerCandidatesResponse>(API_ROUTES.OPPORTUNITIES.OWNER(opportunityId));
}
