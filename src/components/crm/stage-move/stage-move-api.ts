/**
 * @fileoverview **Η κλήση της ΜΙΑΣ πόρτας σταδίου από τον browser** — με τυποποιημένο αποτέλεσμα (ADR-930).
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
  /** 403 — `ownerUid` = ποιος ΜΠΟΡΕΙ (ADR-930 «Εξουσία κατόχου»), ώστε το μήνυμα να τον ονομάσει. */
  | { readonly kind: 'refused'; readonly ownerUid: string | null }
  | { readonly kind: 'failed' };

const HTTP_FORBIDDEN = 403;
const HTTP_CONFLICT = 409;

function fieldOf(body: unknown, field: string): unknown {
  return body !== null && typeof body === 'object' ? (body as Record<string, unknown>)[field] : undefined;
}

/** Ένα μη κενό κείμενο του σώματος μιας άρνησης — ή `null`. Κοινό με την πόρτα κατόχου (`owner-transfer-api`). */
export function errorBodyText(body: unknown, field: string): string | null {
  const value = fieldOf(body, field);
  return typeof value === 'string' && value !== '' ? value : null;
}

function conflictStageOf(body: unknown): OpportunityStage | null {
  const stage = fieldOf(body, 'currentStage');
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
    if (error instanceof ApiClientError && error.statusCode === HTTP_FORBIDDEN) {
      return { kind: 'refused', ownerUid: errorBodyText(error.errorBody, 'ownerUid') };
    }
    return { kind: 'failed' };
  }
}
