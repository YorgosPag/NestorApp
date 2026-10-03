/**
 * ADR-901 Φ4.5 — η πόρτα του client για το «Ζήτησε έγγραφο», για **τις δύο** εισόδους (οικοδεσπότης · επαγγελματίας).
 *
 * Το `apiClient` βάζει μόνο του `Idempotency-Key` (ADR-872) και ξετυλίγει το `{ success, data }`. Η άρνηση **όλου** του
 * αιτήματος διαβάζεται απέναντι σε **κλειστό** σύνολο (`apiErrorBodyOf`)· οι αρνήσεις **ανά γραμμή** έρχονται στο σώμα.
 *
 * @module services/conveyance/conveyance-document-request-gateway
 */

import { API_ROUTES } from '@/config/domain-constants';
import { apiClient, apiErrorBodyOf } from '@/lib/api/enterprise-api-client';
import type { CaseFileTarget } from '@/hooks/useCaseFileOpener';
import type { DocumentRequestItemOutcome } from '@/types/conveyance-document-request';

export interface DocumentRequestResponse {
  readonly items: readonly DocumentRequestItemOutcome[];
}

/** «Ζήτησε» (μία γραμμή) και «Ζήτησε όλα» (πολλές) — το ίδιο αίτημα. Ο παραλήπτης **δεν** στέλνεται: τον ορίζει ο server. */
export function requestCaseDocumentsRequest(door: CaseFileTarget, checklistItemIds: readonly string[]): Promise<DocumentRequestResponse> {
  const url = door.kind === 'host'
    ? API_ROUTES.CONVEYANCE_CASES.DOCUMENT_REQUESTS(door.caseId)
    : API_ROUTES.ENGAGEMENTS.DOCUMENT_REQUESTS(door.engagementId);
  return apiClient.post(url, { checklistItemIds });
}

/** Γιατί απορρίφθηκε **όλο** το αίτημα — κλειστό σύνολο· οτιδήποτε άλλο ⇒ `failed`. */
export const DOCUMENT_REQUEST_REJECTIONS = ['case-closed', 'not-found'] as const;
export type DocumentRequestRejection = (typeof DOCUMENT_REQUEST_REJECTIONS)[number] | 'failed';

export function documentRequestRejectionOf(error: unknown): DocumentRequestRejection {
  const value = apiErrorBodyOf(error)?.error;
  return DOCUMENT_REQUEST_REJECTIONS.find((known) => known === value) ?? 'failed';
}
