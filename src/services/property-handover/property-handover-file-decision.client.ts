/**
 * @fileoverview **Απόφαση για αρχείο από την οθόνη του γραφείου** — `POST /api/properties/[id]/handover/file-decision`
 *   (ADR-916 §5.18 Φ-Δ.4).
 * @related app/api/properties/[id]/handover/file-decision/route.ts · property-handover-office-action.client.ts (το ΕΝΑ σχήμα πράξης)
 * @module services/property-handover/property-handover-file-decision.client
 */

import { API_ROUTES } from '@/config/domain-constants';
import {
  HANDOVER_FILE_DECISION_REFUSALS,
  HANDOVER_FILE_DECISION_REFUSED,
  type HandoverFileDecisionRefusal,
  type HandoverFileDecisionRequest,
} from '@/types/property-handover-file-decision';

import { postHandoverOfficeAction } from './property-handover-office-action.client';

export type HandoverFileDecisionResult =
  | { readonly kind: 'decided' | 'unchanged' }
  | { readonly kind: 'refused'; readonly reason: HandoverFileDecisionRefusal }
  | { readonly kind: 'failed' };

export async function decideHandoverFileFromScreen(propertyId: string, input: HandoverFileDecisionRequest): Promise<HandoverFileDecisionResult> {
  const result = await postHandoverOfficeAction<{ status: 'decided' | 'unchanged' }, HandoverFileDecisionRefusal>(
    API_ROUTES.PROPERTIES.HANDOVER_FILE_DECISION(propertyId), input,
    { discriminator: HANDOVER_FILE_DECISION_REFUSED, reasons: HANDOVER_FILE_DECISION_REFUSALS },
  );
  return result.kind === 'done' ? { kind: result.body.status } : result;
}
