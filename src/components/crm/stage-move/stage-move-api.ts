/**
 * @fileoverview **Η κλήση της ΜΙΑΣ πόρτας σταδίου από τον browser** — με τυποποιημένο αποτέλεσμα (ADR-929).
 * @module components/crm/stage-move/stage-move-api
 *
 * Το `apiClient` βάζει μόνο του `Idempotency-Key` (ίδιο σε κάθε επανάληψη) και **δεν** ξαναδοκιμάζει επιχειρησιακό
 * 409 — άρα η σύγκρουση φτάνει εδώ μία φορά, ως γεγονός, όχι ως θόρυβος.
 */

import { API_ROUTES } from '@/config/domain-constants';
import { isOpportunityStage, type OpportunityStage } from '@/config/crm/opportunity-stages';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { ApiClientError } from '@/lib/api/api-client-types';
import type { OpportunityStageBody, OpportunityStageResponse } from '@/services/crm/opportunity-stage-schema';

export type StageMoveResult =
  | { readonly kind: 'ok'; readonly response: OpportunityStageResponse }
  | { readonly kind: 'conflict'; readonly currentStage: OpportunityStage | null }
  | { readonly kind: 'refused' }
  | { readonly kind: 'failed' };

const HTTP_FORBIDDEN = 403;
const HTTP_CONFLICT = 409;

function conflictStageOf(body: unknown): OpportunityStage | null {
  if (body === null || typeof body !== 'object') return null;
  const stage = (body as { currentStage?: unknown }).currentStage;
  return isOpportunityStage(stage) ? stage : null;
}

export async function postStageTransition(opportunityId: string, body: OpportunityStageBody): Promise<StageMoveResult> {
  try {
    const response = await apiClient.post<OpportunityStageResponse>(API_ROUTES.OPPORTUNITIES.STAGE(opportunityId), body);
    return { kind: 'ok', response };
  } catch (error) {
    if (error instanceof ApiClientError && error.statusCode === HTTP_CONFLICT) {
      return { kind: 'conflict', currentStage: conflictStageOf(error.errorBody) };
    }
    if (error instanceof ApiClientError && error.statusCode === HTTP_FORBIDDEN) return { kind: 'refused' };
    return { kind: 'failed' };
  }
}
