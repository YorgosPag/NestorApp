/**
 * ADR-901 Φ1 — η πόρτα του client προς `/api/conveyance-cases` (ίδιο σχήμα με το
 * `legal-contract-mutation-gateway.ts`). Το `apiClient` βάζει μόνο του Idempotency-Key
 * (ADR-872) και ξετυλίγει το `{ success, data }`.
 *
 * @module services/conveyance/conveyance-case-gateway
 */

import { API_ROUTES } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { CaseDocumentTextResult } from '@/lib/conveyance/case-document-text';
import type { ConveyanceCommandRequest } from '@/lib/conveyance/conveyance-commands';
import type { ConveyanceCaseView } from '@/types/conveyance-case';

export function fetchConveyanceCaseView(propertyId: string): Promise<ConveyanceCaseView | null> {
  return apiClient.get<ConveyanceCaseView | null>(
    `${API_ROUTES.CONVEYANCE_CASES.LIST}?propertyId=${encodeURIComponent(propertyId)}`,
  );
}

export function openConveyanceCaseRequest(propertyId: string): Promise<ConveyanceCaseView> {
  return apiClient.post<ConveyanceCaseView>(API_ROUTES.CONVEYANCE_CASES.LIST, { propertyId });
}

export function sendConveyanceCommand(caseId: string, request: ConveyanceCommandRequest): Promise<ConveyanceCaseView> {
  return apiClient.patch<ConveyanceCaseView>(API_ROUTES.CONVEYANCE_CASES.BY_ID(caseId), request);
}

/**
 * ADR-915 §20 — «Ανάγνωση από το έγγραφο»: ο server διαβάζει **το αρχείο που βλέπει** ο άνθρωπος (`fileId` = CAS) και
 * γράφει τα γεγονότα του· η έκβαση γυρίζει **με όνομα** για να τη δει ο άνθρωπος.
 */
export function readCaseDocumentTextRequest(caseId: string, itemId: string, fileId: string): Promise<{ readonly result: CaseDocumentTextResult }> {
  return apiClient.post<{ readonly result: CaseDocumentTextResult }>(API_ROUTES.CONVEYANCE_CASES.DOCUMENT_TEXT(caseId), { itemId, fileId });
}
