/**
 * @fileoverview **«Κλείσιμο γραμμής χωρίς πλήρες αποτύπωμα» από την οθόνη του γραφείου** —
 *   `POST /api/properties/[id]/handover/line-closure` (ADR-916 §5.23 Φ-Δ.7γ).
 * @related app/api/properties/[id]/handover/line-closure/route.ts · property-handover-office-action.client.ts (το ΕΝΑ σχήμα πράξης)
 * @module services/property-handover/property-handover-line-closure.client
 *
 * 🔑 **Ποτέ δεν πετά** — βλ. `postHandoverOfficeAction`.
 */

import { API_ROUTES } from '@/config/domain-constants';
import {
  HANDOVER_LINE_CLOSURE_REFUSALS,
  HANDOVER_LINE_CLOSURE_REFUSED,
  type HandoverLineClosureRefusal,
  type HandoverLineClosureRequest,
} from '@/types/property-handover-line-closure';

import { postHandoverOfficeAction } from './property-handover-office-action.client';

/** Ό,τι δίνει η οθόνη — η επιβεβαίωση του μη αναστρέψιμου την προσθέτει **μόνο** αυτή η συνάρτηση, μετά τον διάλογο. */
export type HandoverLineClosureInput = Omit<HandoverLineClosureRequest, 'confirmIrreversible'>;

export type HandoverLineClosureResult =
  | { readonly kind: 'closed' | 'unchanged' }
  | { readonly kind: 'refused'; readonly reason: HandoverLineClosureRefusal }
  | { readonly kind: 'failed' };

export async function closeHandoverLineFromScreen(propertyId: string, input: HandoverLineClosureInput): Promise<HandoverLineClosureResult> {
  const result = await postHandoverOfficeAction<{ status: 'closed' | 'unchanged' }, HandoverLineClosureRefusal>(
    API_ROUTES.PROPERTIES.HANDOVER_LINE_CLOSURE(propertyId), { ...input, confirmIrreversible: true },
    { discriminator: HANDOVER_LINE_CLOSURE_REFUSED, reasons: HANDOVER_LINE_CLOSURE_REFUSALS },
  );
  return result.kind === 'done' ? { kind: result.body.status } : result;
}
